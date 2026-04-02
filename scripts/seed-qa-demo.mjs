/**
 * Cria usuário QA + 3 ofertas [TESTE] com imagens em /public/promo-qa (URL pública após deploy).
 * Uso:
 *   QA_SEED_EMAIL=seu@email.com QA_SEED_PASSWORD='SenhaForte123!' node scripts/seed-qa-demo.mjs
 *
 * Se o usuário já existir, use o mesmo e-mail/senha (sign-in).
 */
import { readFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { initializeApp } from "firebase/app";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword
} from "firebase/auth";
import { getFirestore, doc, setDoc, addDoc, collection } from "firebase/firestore";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");

function loadEnv() {
  const p = join(root, ".env.local");
  const raw = readFileSync(p, "utf8");
  for (const line of raw.split("\n")) {
    const m = line.match(/^([^#=]+)=(.*)$/);
    if (m) process.env[m[1].trim()] = m[2].trim();
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

const email = process.env.QA_SEED_EMAIL;
const password = process.env.QA_SEED_PASSWORD;

const offers = [
  {
    title: "[TESTE] Jantar Frutos do Mar",
    discount: "20% OFF",
    categories: ["restaurant"],
    image: "playas-qa-restaurant.png"
  },
  {
    title: "[TESTE] Hospedagem 2x1",
    discount: "2x1",
    categories: ["lodging"],
    image: "playas-qa-hotel.png"
  },
  {
    title: "[TESTE] Aula de Surf",
    discount: "30% OFF",
    categories: ["experience"],
    image: "playas-qa-surf.png"
  }
];

async function main() {
  if (!email || !password) {
    console.error(
      "Defina QA_SEED_EMAIL e QA_SEED_PASSWORD (ex.: variáveis no shell antes do comando)."
    );
    process.exit(1);
  }

  const app = initializeApp(cfg);
  const auth = getAuth(app);
  const db = getFirestore(app);

  let user;
  try {
    const c = await createUserWithEmailAndPassword(auth, email, password);
    user = c.user;
    console.log("Usuario criado:", email);
  } catch {
    const s = await signInWithEmailAndPassword(auth, email, password);
    user = s.user;
    console.log("Usuario existente, login OK:", email);
  }

  await setDoc(doc(db, "companies", user.uid), {
    uid: user.uid,
    email,
    companyName: "QA Playas (demo)",
    cnpj: "00.000.000/0001-00"
  });

  for (const o of offers) {
    const imageUrl = `${PUBLIC_BASE}/promo-qa/${o.image}`;
    const ref = await addDoc(collection(db, "offers"), {
      title: o.title,
      description:
        "Oferta de demonstração com imagem gerada para o MVP. Texto mantido como teste.",
      discount: o.discount,
      merchantName: "QA Playas (demo)",
      validFrom: "2026-03-01",
      validUntil: "2026-12-31",
      imageUrl,
      isActive: true,
      categories: o.categories,
      ownerUid: user.uid
    });
    console.log("Oferta criada:", ref.id, o.title);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
