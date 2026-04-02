#!/usr/bin/env node
/**
 * Remove ofertas de demonstração (título com [TESTE] ou merchantName "QA Playas (demo)"),
 * e antes disso cupons e couponLocks que apontam para esses IDs.
 *
 * Uso:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/chave.json
 *   node scripts/delete-qa-test-data.mjs
 *
 * Dry-run: DRY_RUN=1 node scripts/delete-qa-test-data.mjs
 */

import { readFileSync, existsSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadCredential() {
  const envPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (envPath && existsSync(envPath)) {
    return JSON.parse(readFileSync(envPath, "utf8"));
  }
  const fallback = join(root, "serviceAccountKey.json");
  if (existsSync(fallback)) {
    return JSON.parse(readFileSync(fallback, "utf8"));
  }
  throw new Error(
    "Defina GOOGLE_APPLICATION_CREDENTIALS ou coloque serviceAccountKey.json na raiz (não commite)."
  );
}

const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

function isQaOffer(data) {
  const title = (data.title || "").trim();
  const merchant = (data.merchantName || "").trim();
  return title.includes("[TESTE]") || merchant === "QA Playas (demo)";
}

async function commitInBatches(db, refs) {
  const chunkSize = 450;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = db.batch();
    for (const ref of refs.slice(i, i + chunkSize)) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

async function main() {
  const { default: admin } = await import("firebase-admin");
  const cred = loadCredential();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  const db = admin.firestore();

  if (DRY) console.log("[DRY_RUN] Nada será apagado.\n");

  const offersSnap = await db.collection("offers").get();
  const offerRefsToDelete = [];
  const offerIds = new Set();
  for (const d of offersSnap.docs) {
    if (isQaOffer(d.data())) {
      offerRefsToDelete.push(d.ref);
      offerIds.add(d.id);
    }
  }
  console.log(`Ofertas QA/teste encontradas: ${offerRefsToDelete.length}`);

  const couponsSnap = await db.collection("coupons").get();
  const couponRefs = [];
  for (const d of couponsSnap.docs) {
    const oid = d.data().offerId;
    if (oid && offerIds.has(oid)) {
      couponRefs.push(d.ref);
    }
  }
  console.log(`Cupons a remover (antes das ofertas): ${couponRefs.length}`);
  if (!DRY && couponRefs.length) {
    await commitInBatches(db, couponRefs);
  }

  const locksSnap = await db.collection("couponLocks").get();
  const lockRefs = [];
  for (const d of locksSnap.docs) {
    const oid = d.data().offerId;
    if (oid && offerIds.has(oid)) {
      lockRefs.push(d.ref);
    }
  }
  console.log(`couponLocks a remover: ${lockRefs.length}`);
  if (!DRY && lockRefs.length) {
    await commitInBatches(db, lockRefs);
  }

  if (!DRY && offerRefsToDelete.length) {
    await commitInBatches(db, offerRefsToDelete);
  }

  console.log(
    DRY
      ? "\n[DRY_RUN] Fim. Rode sem DRY_RUN=1 para apagar."
      : "\nConcluído."
  );
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
