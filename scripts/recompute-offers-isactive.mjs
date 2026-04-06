#!/usr/bin/env node
/**
 * Recalcula `isActive` em todos os documentos de `offers` com a mesma lógica do app
 * (`normalizeOfferFromFirestore` + `computePersistedIsActiveFromOffer`), igual ao
 * `syncOfferLifecycleForOwner` do painel do comerciante — mas para toda a coleção.
 *
 * Corrige divergências entre o boolean gravado e o valor esperado (vigência, limite de cupons, etc.).
 *
 * Uso: node scripts/recompute-offers-isactive.mjs
 * Dry-run: DRY_RUN=1 node scripts/recompute-offers-isactive.mjs
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "playas-e-ventajas";
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
/** Só grava quando isActive no banco é false mas o cálculo diz true (reaparecer na vitrine). Não desativa ofertas. */
const ONLY_RESTORE = process.env.ONLY_RESTORE === "1" || process.env.ONLY_RESTORE === "true";

const FIREBASE_TOOLS_JSON = join(
  homedir(),
  ".config",
  "configstore",
  "firebase-tools.json"
);

const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";

function loadFirebaseTools() {
  if (!existsSync(FIREBASE_TOOLS_JSON)) {
    throw new Error(`Arquivo não encontrado: ${FIREBASE_TOOLS_JSON}. Rode: firebase login`);
  }
  return JSON.parse(readFileSync(FIREBASE_TOOLS_JSON, "utf8"));
}

async function refreshAccessToken(refreshToken) {
  const body = new URLSearchParams({
    client_id: FIREBASE_CLI_CLIENT_ID,
    grant_type: "refresh_token",
    refresh_token: refreshToken
  });
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body
  });
  if (!res.ok) throw new Error(`OAuth refresh: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function getAccessToken(cfg) {
  const { tokens } = cfg;
  const now = Date.now();
  if (tokens.access_token && tokens.expires_at && tokens.expires_at > now + 60_000) {
    return tokens.access_token;
  }
  return refreshAccessToken(tokens.refresh_token);
}

async function listOffers(accessToken, pageToken) {
  let url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/offers?pageSize=300`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!res.ok) throw new Error(`List: ${res.status} ${await res.text()}`);
  return res.json();
}

async function patchIsActive(accessToken, docName, value) {
  const id = docName.split("/").pop();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/offers/${encodeURIComponent(id)}?updateMask.fieldPaths=isActive`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        isActive: { booleanValue: value }
      }
    })
  });
  if (!res.ok) throw new Error(`PATCH ${id}: ${res.status} ${await res.text()}`);
}

function valueFromField(f) {
  if (!f) return undefined;
  if (f.nullValue !== undefined) return null;
  if (f.stringValue !== undefined) return f.stringValue;
  if (f.booleanValue !== undefined) return f.booleanValue;
  if (f.integerValue !== undefined) return parseInt(String(f.integerValue), 10);
  if (f.doubleValue !== undefined) return f.doubleValue;
  if (f.timestampValue !== undefined) {
    const d = new Date(f.timestampValue);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return undefined;
}

function flattenFields(fields) {
  const o = {};
  for (const [k, v] of Object.entries(fields || {})) {
    o[k] = valueFromField(v);
  }
  return o;
}

function localDateYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function coerceNumberField(v) {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function toCanonicalYmd(v) {
  if (v == null || v === "") return undefined;
  if (typeof v === "string") {
    const t = v.trim().slice(0, 10);
    if (/^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
    const m = v.trim().match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      if (y >= 1000 && y <= 9999 && mo >= 1 && mo <= 12 && d >= 1 && d <= 31) {
        return `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      }
    }
    return undefined;
  }
  return undefined;
}

function parseBoolishField(v) {
  if (v == null) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "number") return v !== 0;
  return undefined;
}

function parseStoredIsActiveFromRaw(data) {
  const v = data.isActive;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "number") return v !== 0;
  if (v == null) return true;
  return true;
}

function computePersistedIsActive(args) {
  if (!args.publishIntent) return false;
  const vuRaw =
    toCanonicalYmd(args.validUntil) ??
    (typeof args.validUntil === "string" ? args.validUntil.trim().slice(0, 10) : String(args.validUntil ?? "").trim().slice(0, 10));
  if (!vuRaw || !/^\d{4}-\d{2}-\d{2}$/.test(vuRaw)) return false;
  if (vuRaw < args.nowYmd) return false;
  const vf = args.validFrom ? toCanonicalYmd(args.validFrom) ?? args.validFrom : undefined;
  if (vf && vf > args.nowYmd) return false;
  const mc = args.maxCoupons;
  const issued = args.couponsIssued ?? 0;
  const hasLimit = mc != null && mc >= 5;
  if (hasLimit && issued >= mc) return false;
  return true;
}

function computePersistedIsActiveFromOffer(o) {
  const vuRaw = o.validUntil;
  const vu =
    toCanonicalYmd(vuRaw) ?? (typeof vuRaw === "string" ? vuRaw.trim().slice(0, 10) : "");
  const vf = o.validFrom ? toCanonicalYmd(o.validFrom) : undefined;
  const issued = coerceNumberField(o.couponsIssued) ?? 0;
  const mc = coerceNumberField(o.maxCoupons);
  return computePersistedIsActive({
    publishIntent: o.publishIntent !== false,
    validFrom: vf,
    validUntil: vu || "",
    nowYmd: localDateYmd(),
    couponsIssued: issued,
    maxCoupons: mc
  });
}

function normalizeComputedIsActive(id, data) {
  const o = { id, ...data };
  const mc = coerceNumberField(data.maxCoupons);
  if (mc !== undefined) o.maxCoupons = mc;
  const ci = coerceNumberField(data.couponsIssued);
  if (ci !== undefined) o.couponsIssued = ci;
  const vf = toCanonicalYmd(data.validFrom) ?? toCanonicalYmd(o.validFrom);
  if (vf !== undefined) o.validFrom = vf;
  const vu = toCanonicalYmd(data.validUntil) ?? toCanonicalYmd(o.validUntil);
  if (vu !== undefined) o.validUntil = vu;
  const pPub = parseBoolishField(data.publishIntent);
  const pAct = parseBoolishField(data.isActive);
  o.publishIntent = pPub !== undefined ? pPub : pAct !== false;
  return computePersistedIsActiveFromOffer(o);
}

async function main() {
  const cfg = loadFirebaseTools();
  const accessToken = await getAccessToken(cfg);

  let pageToken;
  let updated = 0;
  let unchanged = 0;
  do {
    const data = await listOffers(accessToken, pageToken);
    for (const doc of data.documents || []) {
      const fields = doc.fields || {};
      const flat = flattenFields(fields);
      const id = doc.name.split("/").pop();
      const stored = parseStoredIsActiveFromRaw(flat);
      const computed = normalizeComputedIsActive(id, flat);
      if (stored !== computed) {
        if (ONLY_RESTORE && !(stored === false && computed === true)) {
          unchanged++;
          continue;
        }
        console.log(`${id}: stored=${stored} -> computed=${computed}`);
        if (!DRY) {
          await patchIsActive(accessToken, doc.name, computed);
        }
        updated++;
      } else {
        unchanged++;
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(
    DRY
      ? `\n[DRY_RUN] Documentos com divergência (seriam atualizados): ${updated}. Sem mudança: ${unchanged}.`
      : `\nConcluído. Documentos atualizados: ${updated}. Sem mudança: ${unchanged}.`
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
