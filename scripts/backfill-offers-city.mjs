#!/usr/bin/env node
/**
 * Backfill de `city` em documentos de `offers` que ainda não têm cidade.
 * Padrão definido: "Cabo Frio".
 *
 * Uso:
 *   node scripts/backfill-offers-city.mjs
 * Dry-run:
 *   DRY_RUN=1 node scripts/backfill-offers-city.mjs
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "playas-e-ventajas";
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";
const DEFAULT_CITY = "Cabo Frio";

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

async function patchCity(accessToken, docName, city) {
  const id = docName.split("/").pop();
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/offers/${encodeURIComponent(id)}?updateMask.fieldPaths=city`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      fields: {
        city: { stringValue: city }
      }
    })
  });
  if (!res.ok) throw new Error(`PATCH ${id}: ${res.status} ${await res.text()}`);
}

function fieldStringValue(f) {
  if (!f) return undefined;
  if (typeof f.stringValue === "string") return f.stringValue.trim();
  return undefined;
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
      const currentCity = fieldStringValue(fields.city);
      if (currentCity) {
        unchanged++;
        continue;
      }
      const id = doc.name.split("/").pop();
      console.log(`${id}: city ausente -> ${DEFAULT_CITY}`);
      if (!DRY) {
        await patchCity(accessToken, doc.name, DEFAULT_CITY);
      }
      updated++;
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(
    DRY
      ? `\n[DRY_RUN] Ofertas sem cidade (seriam atualizadas): ${updated}. Sem mudança: ${unchanged}.`
      : `\nConcluído. Ofertas atualizadas: ${updated}. Sem mudança: ${unchanged}.`
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
