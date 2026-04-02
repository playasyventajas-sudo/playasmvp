#!/usr/bin/env node
/**
 * Apaga no Firestore ofertas e cupons cujo dono (ownerUid / merchantUid) NÃO é o UID informado.
 * Útil antes de entregar o projeto: o app não permite apagar documentos de outros usuários.
 *
 * Requisitos:
 * - Conta de serviço com permissão no projeto (Firebase Console → Project settings → Service accounts).
 * - Variável de ambiente GOOGLE_APPLICATION_CREDENTIALS apontando para o JSON da chave, OU
 *   arquivo ./serviceAccountKey.json na raiz do repositório (não versionar).
 *
 * Uso:
 *   export GOOGLE_APPLICATION_CREDENTIALS=/caminho/para/chave.json
 *   export KEEP_OWNER_UID=<UID do Firebase Auth que você quer manter>
 *   node scripts/firestore-delete-non-owner.mjs
 *
 * Dry-run (só lista o que seria apagado):
 *   DRY_RUN=1 node scripts/firestore-delete-non-owner.mjs
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
    "Defina GOOGLE_APPLICATION_CREDENTIALS ou coloque serviceAccountKey.json na raiz do projeto (não commite a chave)."
  );
}

const KEEP = process.env.KEEP_OWNER_UID?.trim();
if (!KEEP) {
  console.error("Defina KEEP_OWNER_UID com o UID da conta Firebase Auth que deve permanecer.");
  process.exit(1);
}

const DRY = process.env.DRY_RUN === "1" || process.env.DRY_RUN === "true";

async function main() {
  const { default: admin } = await import("firebase-admin");
  const cred = loadCredential();
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(cred) });
  }
  const db = admin.firestore();

  if (DRY) {
    console.log("[DRY_RUN] Nenhum documento será apagado.\n");
  }

  // 1) offers
  const offersSnap = await db.collection("offers").get();
  let toDeleteOffers = [];
  for (const d of offersSnap.docs) {
    const ownerUid = d.data().ownerUid;
    if (ownerUid !== KEEP) {
      toDeleteOffers.push(d.ref);
    }
  }
  console.log(`Ofertas a remover: ${toDeleteOffers.length}`);
  if (!DRY && toDeleteOffers.length) {
    await commitInBatches(db, toDeleteOffers);
  }

  // 2) coupons
  const couponsSnap = await db.collection("coupons").get();
  let toDeleteCoupons = [];
  for (const d of couponsSnap.docs) {
    const merchantUid = d.data().merchantUid;
    if (merchantUid !== KEEP) {
      toDeleteCoupons.push(d.ref);
    }
  }
  console.log(`Cupons a remover: ${toDeleteCoupons.length}`);
  if (!DRY && toDeleteCoupons.length) {
    await commitInBatches(db, toDeleteCoupons);
  }

  // 3) couponLocks órfãos ou de ofertas que não pertencem ao KEEP
  const locksSnap = await db.collection("couponLocks").get();
  let toDeleteLocks = [];
  for (const d of locksSnap.docs) {
    const offerId = d.data().offerId;
    if (!offerId || typeof offerId !== "string") {
      toDeleteLocks.push(d.ref);
      continue;
    }
    const offerDoc = await db.collection("offers").doc(offerId).get();
    if (!offerDoc.exists) {
      toDeleteLocks.push(d.ref);
      continue;
    }
    if (offerDoc.data().ownerUid !== KEEP) {
      toDeleteLocks.push(d.ref);
    }
  }
  console.log(`couponLocks a remover: ${toDeleteLocks.length}`);
  if (!DRY && toDeleteLocks.length) {
    await commitInBatches(db, toDeleteLocks);
  }

  console.log(DRY ? "\n[DRY_RUN] Concluído." : "\nConcluído.");
}

/**
 * @param {FirebaseFirestore.Firestore} db
 * @param {FirebaseFirestore.DocumentReference[]} refs
 */
async function commitInBatches(db, refs) {
  const chunkSize = 450;
  for (let i = 0; i < refs.length; i += chunkSize) {
    const batch = db.batch();
    const slice = refs.slice(i, i + chunkSize);
    for (const ref of slice) {
      batch.delete(ref);
    }
    await batch.commit();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
