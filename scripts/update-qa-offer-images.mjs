/**
 * Atualiza imageUrl das ofertas QA existentes para URLs estáticas em /promo-qa/ (após deploy do Hosting).
 * Só funciona se o login for do MESMO usuário dono (`ownerUid`) desses documentos no Firestore.
 *
 *   QA_LOGIN_EMAIL=... QA_LOGIN_PASSWORD='...' node scripts/update-qa-offer-images.mjs
 *
 * Opcional: PUBLIC_SITE_URL=https://playas-e-ventajas.web.app
 * Opcional: QA_OFFER_IDS=id1,id2,id3 (padrão: os três IDs de demo históricos)
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, updateDoc, getDoc } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  try {
    const p = join(root, ".env.local");
    const raw = readFileSync(p, "utf8");
    for (const line of raw.split("\n")) {
      const m = line.match(/^([^#=]+)=(.*)$/);
      if (m) process.env[m[1].trim()] = m[2].trim();
    }
  } catch {
    /* opcional */
  }
}

loadEnv();

const cfg = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID
};

const PUBLIC_BASE =
  process.env.PUBLIC_SITE_URL || "https://playas-e-ventajas.web.app";

const DEFAULT_IDS = [
  "pxafSOxasfOrGrfvBB36",
  "jdan8joQsoyRUENC6Qjq",
  "gstJuuoDj90FnyzbXzTV"
];

const FILES = [
  "playas-qa-restaurant.png",
  "playas-qa-hotel.png",
  "playas-qa-surf.png"
];

async function main() {
  const email = process.env.QA_LOGIN_EMAIL;
  const password = process.env.QA_LOGIN_PASSWORD;
  if (!email || !password) {
    console.error(
      "Defina QA_LOGIN_EMAIL e QA_LOGIN_PASSWORD (dono das ofertas no Firestore)."
    );
    process.exit(1);
  }

  const ids = (process.env.QA_OFFER_IDS || DEFAULT_IDS.join(","))
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (ids.length !== FILES.length) {
    console.error(
      `Esperado ${FILES.length} IDs (ou ajuste FILES no script). Recebido: ${ids.length}`
    );
    process.exit(1);
  }

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);
  const { user } = await signInWithEmailAndPassword(auth, email, password);

  for (let i = 0; i < ids.length; i++) {
    const id = ids[i];
    const imageUrl = `${PUBLIC_BASE}/promo-qa/${FILES[i]}`;
    const snap = await getDoc(doc(db, "offers", id));
    if (!snap.exists()) {
      console.warn("Documento inexistente, pulando:", id);
      continue;
    }
    const data = snap.data();
    if (data.ownerUid !== user.uid) {
      console.error(
        `Sem permissão: oferta ${id} pertence a outro usuário (ownerUid diferente).`
      );
      process.exit(1);
    }
    await updateDoc(doc(db, "offers", id), { imageUrl });
    console.log("Atualizado", id, imageUrl);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
