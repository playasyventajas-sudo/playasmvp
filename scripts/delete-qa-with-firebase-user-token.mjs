#!/usr/bin/env node
/**
 * Lista e apaga ofertas de teste ([TESTE] ou merchantName "QA Playas (demo)") usando o
 * mesmo login do `firebase login` (~/.config/configstore/firebase-tools.json).
 * Não usa service account; roda na máquina de quem tem acesso ao projeto no Firebase CLI.
 *
 * Uso: node scripts/delete-qa-with-firebase-user-token.mjs
 * Dry-run: DRY_RUN=1 node scripts/delete-qa-with-firebase-user-token.mjs
 */

import { readFileSync, existsSync } from "fs";
import { homedir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT = process.env.GOOGLE_CLOUD_PROJECT || "playas-e-ventajas";
const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

const FIREBASE_TOOLS_JSON = join(
  homedir(),
  ".config",
  "configstore",
  "firebase-tools.json"
);

/** Cliente OAuth público usado pelo Firebase CLI (instalado). */
const FIREBASE_CLI_CLIENT_ID =
  "563584335869-fgrhgmd47bqnekij5i8b5pr03ho849e6.apps.googleusercontent.com";

function loadFirebaseTools() {
  if (!existsSync(FIREBASE_TOOLS_JSON)) {
    throw new Error(
      `Arquivo não encontrado: ${FIREBASE_TOOLS_JSON}. Rode: firebase login`
    );
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Falha ao renovar token OAuth: ${res.status} ${t}`);
  }
  const j = await res.json();
  return j.access_token;
}

async function getAccessToken(cfg) {
  const { tokens } = cfg;
  if (!tokens?.refresh_token) {
    throw new Error("Sem refresh_token no firebase-tools.json. Rode: firebase login");
  }
  const now = Date.now();
  if (tokens.access_token && tokens.expires_at && tokens.expires_at > now + 60_000) {
    return tokens.access_token;
  }
  return refreshAccessToken(tokens.refresh_token);
}

/** API Firestore v1: list documents */
async function listOffers(accessToken, pageToken) {
  let url = `https://firestore.googleapis.com/v1/projects/${PROJECT}/databases/(default)/documents/offers?pageSize=300`;
  if (pageToken) url += `&pageToken=${encodeURIComponent(pageToken)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`List offers failed: ${res.status} ${t}`);
  }
  return res.json();
}

async function deleteDoc(accessToken, docName) {
  const url = `https://firestore.googleapis.com/v1/${docName}`;
  const res = await fetch(url, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` }
  });
  if (!res.ok && res.status !== 404) {
    const t = await res.text();
    throw new Error(`Delete failed: ${res.status} ${t}`);
  }
}

async function listCouponsForOffer(accessToken, offerId) {
  const parent = `projects/${PROJECT}/databases/(default)/documents`;
  const url = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`runQuery coupons: ${res.status} ${t}`);
  }
  return res.json();
}

async function listLocksForOffer(accessToken, offerId) {
  const parent = `projects/${PROJECT}/databases/(default)/documents`;
  const url = `https://firestore.googleapis.com/v1/${parent}:runQuery`;
  const body = {
    structuredQuery: {
      from: [{ collectionId: "couponLocks" }],
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
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`runQuery locks: ${res.status} ${t}`);
  }
  return res.json();
}

function docNameFromResultRow(row) {
  return row.document?.name;
}

async function main() {
  const cfg = loadFirebaseTools();
  let accessToken = await getAccessToken(cfg);

  const toDelete = [];
  let pageToken;
  do {
    let data;
    try {
      data = await listOffers(accessToken, pageToken);
    } catch (e) {
      if (String(e.message).includes("401")) {
        accessToken = await refreshAccessToken(cfg.tokens.refresh_token);
        data = await listOffers(accessToken, pageToken);
      } else throw e;
    }
    for (const doc of data.documents || []) {
      const name = doc.name;
      const fields = [];
      const raw = doc.fields || {};
      for (const [k, v] of Object.entries(raw)) {
        fields.push({ fieldName: k, field: v });
      }
      let title = "";
      let merchant = "";
      if (raw.title?.stringValue) title = raw.title.stringValue;
      if (raw.merchantName?.stringValue) merchant = raw.merchantName.stringValue;
      const id = name.split("/").pop();
      if (title.includes("[TESTE]") || merchant === "QA Playas (demo)") {
        toDelete.push({ id, name, title, merchant });
      }
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  console.log(`Ofertas QA/teste encontradas: ${toDelete.length}`);
  for (const o of toDelete) {
    console.log(` - ${o.id}: ${o.title || "(sem titulo)"}`);
  }

  if (DRY) {
    console.log("\n[DRY_RUN] Nada apagado.");
    return;
  }

  for (const o of toDelete) {
    const offerId = o.id;

    const couponRows = await listCouponsForOffer(accessToken, offerId);
    for (const row of couponRows) {
      const dn = docNameFromResultRow(row);
      if (dn) {
        await deleteDoc(accessToken, dn);
        console.log(`Cupom apagado: ${dn.split("/").pop()}`);
      }
    }

    const lockRows = await listLocksForOffer(accessToken, offerId);
    for (const row of lockRows) {
      const dn = docNameFromResultRow(row);
      if (dn) {
        await deleteDoc(accessToken, dn);
        console.log(`Lock apagado: ${dn.split("/").pop()}`);
      }
    }

    await deleteDoc(accessToken, o.name);
    console.log(`Oferta apagada: ${offerId}`);
  }

  console.log("\nConcluído.");
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
