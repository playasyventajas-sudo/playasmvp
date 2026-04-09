#!/usr/bin/env node
/**
 * Diagnóstico somente leitura: localiza oferta(s) por substring no título e imprime
 * campos relevantes para permission-denied em cupom (gerar ou validar).
 * Opcionalmente lista cupons da oferta (query por offerId).
 *
 * Requer token do Firebase CLI (~/.config/configstore/firebase-tools.json), igual aos outros scripts.
 *
 * Uso:
 *   node scripts/diagnose-offer-coupon.mjs
 *   TITLE_SUBSTRING="Alpinismo" node scripts/diagnose-offer-coupon.mjs
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "playas-e-ventajas";
const TITLE_SUBSTRING = (process.env.TITLE_SUBSTRING || "Alpinismo").trim();

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
  if (!res.ok) throw new Error(`List offers: ${res.status} ${await res.text()}`);
  return res.json();
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

async function runQueryCouponsByOfferId(accessToken, offerId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "coupons" }],
      where: {
        fieldFilter: {
          field: { fieldPath: "offerId" },
          op: "EQUAL",
          value: { stringValue: offerId }
        }
      },
      limit: 25
    }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`runQuery coupons: ${res.status} ${await res.text()}`);
  return res.json();
}

function mainPrintOffer(id, flat) {
  const title = String(flat.title ?? "");
  const ownerUid = flat.ownerUid ?? "(ausente)";
  const mc = flat.maxCoupons;
  const issued = flat.couponsIssued;
  const isActive = flat.isActive;
  const hasLimit = mc != null && Number(mc) >= 5;

  console.log("\n--- Oferta encontrada ---");
  console.log(`  id:           ${id}`);
  console.log(`  title:        ${title.slice(0, 80)}${title.length > 80 ? "…" : ""}`);
  console.log(`  ownerUid:     ${ownerUid}`);
  console.log(`  maxCoupons:   ${mc === undefined ? "(sem)" : JSON.stringify(mc)}`);
  console.log(`  couponsIssued:${issued === undefined ? "(sem)" : JSON.stringify(issued)}`);
  console.log(`  isActive:     ${JSON.stringify(isActive)}`);
  console.log(`  validUntil:   ${flat.validUntil ?? "(sem)"}`);
  console.log(`  publishIntent:${JSON.stringify(flat.publishIntent)}`);
  console.log(`  hasLimit>=5:  ${hasLimit}`);
  console.log("\n  Fluxo Firestore ao GERAR cupom:");
  if (hasLimit) {
    console.log("  → Transação escreve: couponLocks + coupons + UPDATE offers (couponsIssued, isActive).");
    console.log("  → permission-denied no Commit: quase sempre regra do UPDATE em offers.");
  } else {
    console.log("  → Transação escreve: couponLocks + coupons (sem UPDATE em offers).");
    console.log("  → permission-denied: create em coupons ou couponLocks.");
  }
  console.log("\n  Fluxo ao VALIDAR (scanner):");
  console.log("  → get/update em coupons/{id}; merchantUid do cupom deve ser == auth.uid do login.");
}

function printCouponRows(runQueryResult) {
  const rows = Array.isArray(runQueryResult) ? runQueryResult : [];
  let n = 0;
  for (const row of rows) {
    if (!row.document) continue;
    const name = row.document.name || "";
    const id = name.split("/").pop();
    const flat = flattenFields(row.document.fields || {});
    n++;
    console.log(`  [${n}] coupon id: ${id}`);
    console.log(`      merchantUid: ${JSON.stringify(flat.merchantUid)}`);
    console.log(`      status:      ${JSON.stringify(flat.status)}`);
    console.log(`      userEmail:   ${String(flat.userEmail || "").slice(0, 40)}`);
  }
  if (n === 0) console.log("  (nenhum cupom retornado para esta oferta nesta query)");
}

async function main() {
  console.log(`Projeto: ${PROJECT}`);
  console.log(`Busca título contendo: "${TITLE_SUBSTRING}" (case-insensitive)\n`);

  const cfg = loadFirebaseTools();
  const accessToken = await getAccessToken(cfg);

  const matches = [];
  let pageToken;
  do {
    const data = await listOffers(accessToken, pageToken);
    for (const doc of data.documents || []) {
      const flat = flattenFields(doc.fields || {});
      const title = String(flat.title ?? "");
      if (title.toLowerCase().includes(TITLE_SUBSTRING.toLowerCase())) {
        matches.push({ id: doc.name.split("/").pop(), flat });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  if (matches.length === 0) {
    console.log("Nenhuma oferta com esse substring no título. Ajuste TITLE_SUBSTRING.");
    process.exit(0);
  }

  for (const { id, flat } of matches) {
    mainPrintOffer(id, flat);
    try {
      const rq = await runQueryCouponsByOfferId(accessToken, id);
      console.log("\n  Amostra de cupons (offerId == esta oferta):");
      printCouponRows(rq);
    } catch (e) {
      console.log("\n  (Query de cupons falhou — índice ou API; veja no Console.)", e.message || e);
    }
  }

  console.log("\n--- Como identificar o fluxo no navegador (F12 → Rede) ---");
  console.log("  Gerar cupom: falha em operação batch/Commit tocando offers + coupons + couponLocks.");
  console.log("  Scanner:     falha em get ou patch em documents/coupons/...");
  console.log("");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
