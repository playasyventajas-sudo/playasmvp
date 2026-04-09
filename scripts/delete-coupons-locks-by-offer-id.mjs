#!/usr/bin/env node
/**
 * Apaga cupons e couponLocks ligados a um offerId (Firebase CLI admin, ignora regras).
 * Uso: OFFER_ID=xxx node scripts/delete-coupons-locks-by-offer-id.mjs
 */
import { execSync } from "child_process";
import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { join } from "path";

const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "playas-e-ventajas";
const OFFER_ID = (process.env.OFFER_ID || "").trim();
if (!OFFER_ID) {
  console.error("Defina OFFER_ID");
  process.exit(1);
}

const FIREBASE_TOOLS_JSON = join(homedir(), ".config", "configstore", "firebase-tools.json");
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";

function loadFirebaseTools() {
  if (!existsSync(FIREBASE_TOOLS_JSON)) throw new Error(`Arquivo não encontrado: ${FIREBASE_TOOLS_JSON}`);
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

async function runQuery(accessToken, collectionId, offerId) {
  const url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: "offerId" },
          op: "EQUAL",
          value: { stringValue: offerId }
        }
      },
      limit: 500
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
  if (!res.ok) throw new Error(`runQuery ${collectionId}: ${res.status} ${await res.text()}`);
  return res.json();
}

function docIdsFromRunQuery(rows) {
  const ids = [];
  for (const row of rows || []) {
    if (!row.document?.name) continue;
    ids.push(row.document.name.split("/").pop());
  }
  return ids;
}

function firestoreDelete(path) {
  execSync(`firebase firestore:delete "${path}" --project ${PROJECT} -f`, {
    stdio: "inherit",
    env: process.env
  });
}

async function main() {
  const cfg = loadFirebaseTools();
  const accessToken = await getAccessToken(cfg);

  for (const col of ["coupons", "couponLocks"]) {
    const rq = await runQuery(accessToken, col, OFFER_ID);
    const ids = docIdsFromRunQuery(Array.isArray(rq) ? rq : []);
    console.log(`${col}: ${ids.length} documento(s)`);
    for (const id of ids) {
      firestoreDelete(`${col}/${id}`);
    }
  }
  console.log("Concluído.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
