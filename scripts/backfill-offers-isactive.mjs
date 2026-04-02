#!/usr/bin/env node
/**
 * Grava isActive=true em ofertas que não têm o campo (legado / bug).
 * Necessário para a query pública where("isActive","==",true) encontrar o documento.
 *
 * Uso: node scripts/backfill-offers-isactive.mjs
 * Dry-run: DRY_RUN=1 node scripts/backfill-offers-isactive.mjs
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "playas-e-ventajas";
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

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

/** PATCH só o campo isActive */
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

function hasIsActiveField(fields) {
  return fields && Object.prototype.hasOwnProperty.call(fields, "isActive");
}

async function main() {
  const cfg = loadFirebaseTools();
  let accessToken = await getAccessToken(cfg);

  let pageToken;
  let fixed = 0;
  do {
    const data = await listOffers(accessToken, pageToken);
    for (const doc of data.documents || []) {
      const fields = doc.fields || {};
      if (!hasIsActiveField(fields)) {
        const id = doc.name.split("/").pop();
        console.log(`Sem isActive: ${id}`);
        if (!DRY) {
          await patchIsActive(accessToken, doc.name, true);
          fixed++;
        }
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(
    DRY
      ? `\n[DRY_RUN] Seriam corrigidos documentos sem isActive (veja lista acima).`
      : `\nConcluído. Documentos atualizados com isActive=true: ${fixed}.`
  );
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
