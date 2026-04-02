import {
  Timestamp,
  collection,
  getDocs,
  getDoc,
  addDoc,
  deleteDoc,
  doc,
  updateDoc,
  query,
  where,
  runTransaction,
  deleteField,
  onSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage, isFirebaseConfigured } from "./firebaseConfig";
import {
  Offer,
  Coupon,
  ConsumerStat,
  ConsumerEmailAggregate,
  MerchantConsumerDashboard
} from "../types";

// --- Mock Data for Demo (fallback) ---
const MOCK_OWNER_UID = "mock-user-123";

/** Demo: atualiza nome exibido em todas as ofertas do dono (sem Firebase). */
export function updateMockOffersMerchantName(ownerUid: string, merchantName: string): void {
  MOCK_OFFERS.forEach((o) => {
    if (o.ownerUid === ownerUid) o.merchantName = merchantName;
  });
}

let MOCK_OFFERS: Offer[] = [
  {
    id: "1",
    ownerUid: MOCK_OWNER_UID,
    title: "Caipirinha em Dobro",
    description: "Aproveite uma caipirinha grátis na compra de qualquer prato principal ao pôr do sol.",
    discount: "2 por 1",
    merchantName: "Quiosque Sol e Mar",
    validFrom: "2026-01-01",
    validUntil: "2026-12-31",
    imageUrl: "https://picsum.photos/400/300?random=1",
    isActive: true,
    categories: ['bar', 'restaurant']
  },
  {
    id: "2",
    ownerUid: MOCK_OWNER_UID,
    title: "Aula de Surf Iniciante",
    description: "Aula de surf para iniciantes com aluguel de prancha incluso na Praia do Forte.",
    discount: "20% OFF",
    merchantName: "Escola de Surf Onda Azul",
    validFrom: "2026-06-01",
    validUntil: "2026-11-15",
    imageUrl: "https://picsum.photos/400/300?random=2",
    isActive: true,
    categories: ['experience']
  },
  {
    id: "3",
    ownerUid: MOCK_OWNER_UID,
    title: "Jantar de Frutos do Mar",
    description: "Prato de peixe fresco do dia para duas pessoas com vista para o mar.",
    discount: "15% OFF",
    merchantName: "Restaurante Mar Aberto",
    validFrom: "2026-05-01",
    validUntil: "2026-10-20",
    imageUrl: "https://picsum.photos/400/300?random=3",
    isActive: true,
    categories: ['restaurant']
  },
  {
    id: "4",
    ownerUid: MOCK_OWNER_UID,
    title: "Hospedagem com Café",
    description: "Fique 3 noites e pague 2. Café da manhã tropical incluso.",
    discount: "3x2 Diárias",
    merchantName: "Pousada Brisa do Mar",
    validFrom: "2026-01-01",
    validUntil: "2026-12-31",
    imageUrl: "https://picsum.photos/400/300?random=4",
    isActive: true,
    categories: ['lodging']
  }
];

let MOCK_COUPONS: Coupon[] = [
  {
    id: "DEMO-C1",
    offerId: "1",
    offerTitle: "Caipirinha em Dobro",
    discount: "2 por 1",
    userEmail: "tatiana@demo.com",
    createdAt: 1_700_000_000_000,
    status: "USED",
    merchantUid: MOCK_OWNER_UID
  },
  {
    id: "DEMO-C2",
    offerId: "2",
    offerTitle: "Aula de Surf Iniciante",
    discount: "20% OFF",
    userEmail: "tatiana@demo.com",
    createdAt: 1_700_000_100_000,
    status: "VALID",
    merchantUid: MOCK_OWNER_UID
  },
  {
    id: "DEMO-C3",
    offerId: "3",
    offerTitle: "Jantar de Frutos do Mar",
    discount: "15% OFF",
    userEmail: "tatiana@demo.com",
    createdAt: 1_700_000_200_000,
    status: "USED",
    merchantUid: MOCK_OWNER_UID
  },
  {
    id: "DEMO-C4",
    offerId: "1",
    offerTitle: "Caipirinha em Dobro",
    discount: "2 por 1",
    userEmail: "joana@demo.com",
    createdAt: 1_700_000_300_000,
    status: "VALID",
    merchantUid: MOCK_OWNER_UID
  },
  {
    id: "DEMO-C5",
    offerId: "2",
    offerTitle: "Aula de Surf Iniciante",
    discount: "20% OFF",
    userEmail: "joana@demo.com",
    createdAt: 1_700_000_400_000,
    status: "VALID",
    merchantUid: MOCK_OWNER_UID
  }
];

/** Erro quando a oferta esgotou cupons ou está inativa (turista). */
export const COUPON_SOLD_OUT = "COUPON_SOLD_OUT";

/** Já existe cupom para este e-mail nesta oferta (1 por oferta). */
export const COUPON_ALREADY_CLAIMED = "COUPON_ALREADY_CLAIMED";

/** Campo de e-mail vazio ao gerar cupom (obrigatório preencher algo). */
export const COUPON_INVALID_EMAIL = "COUPON_INVALID_EMAIL";

/** Texto gravado no cupom: trim; formato livre (aceita qualquer texto não vazio). */
export function normalizeCouponEmail(email: string): string {
  return (email || "").trim();
}

/** ID estável do doc em `couponLocks` (1 cupom por oferta + e-mail). */
function couponLockDocId(offerId: string, normalizedEmail: string): string {
  const raw = `${offerId}\n${normalizedEmail}`;
  const b = btoa(unescape(encodeURIComponent(raw)));
  return b.replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/** Mock: chaves já “reservadas” para deduplicação. */
const MOCK_COUPON_LOCK_KEYS = new Set<string>();

function mockLockKey(offerId: string, normalizedEmail: string): string {
  return `${offerId}|${normalizedEmail}`;
}

// --- Service Methods ---

/** Firestore/import às vezes gravam números como string; a UI precisa de inteiros estáveis. */
function coerceNumberField(v: unknown): number | undefined {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

/**
 * Converte valor vindo do Firestore ou do formulário em `YYYY-MM-DD` canônico.
 * Evita comparações lexicográficas erradas (ex.: 2026-4-5 vs 2026-04-05) e suporta Timestamp.
 */
export function toCanonicalYmd(v: unknown): string | undefined {
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
  if (v instanceof Timestamp) {
    const d = v.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "object" && v !== null && "seconds" in (v as object)) {
    const sec = (v as { seconds: number }).seconds;
    if (typeof sec === "number" && Number.isFinite(sec)) {
      const d = new Date(sec * 1000);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    }
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = v;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return undefined;
}

/** Normaliza campos numéricos ao ler `offers` do Firestore. */
export function normalizeOfferFromFirestore(id: string, data: Record<string, unknown>): Offer {
  const o = { id, ...data } as Offer;
  const mc = coerceNumberField(data.maxCoupons);
  if (mc !== undefined) o.maxCoupons = mc;
  const ci = coerceNumberField(data.couponsIssued);
  if (ci !== undefined) o.couponsIssued = ci;
  const vf = toCanonicalYmd(data.validFrom) ?? toCanonicalYmd(o.validFrom as unknown);
  if (vf !== undefined) o.validFrom = vf;
  const vu = toCanonicalYmd(data.validUntil) ?? toCanonicalYmd(o.validUntil as unknown);
  if (vu !== undefined) o.validUntil = vu;
  if (typeof data.isActive === "string") {
    o.isActive = data.isActive === "true" || data.isActive === "1";
  }
  return o;
}

/** Card + modal: “restam X de Y” e barra de progresso. */
export function getOfferCouponLimitInfo(offer: Offer): {
  hasLimit: boolean;
  max: number;
  issued: number;
  remaining: number | null;
  pctRemaining: number;
} {
  const max = coerceNumberField(offer.maxCoupons as unknown);
  const issued = coerceNumberField(offer.couponsIssued as unknown) ?? 0;
  const hasLimit = max != null && max >= 5;
  const remaining = hasLimit ? Math.max(0, max - issued) : null;
  const pctRemaining =
    hasLimit && max > 0 && remaining != null ? Math.round((remaining / max) * 100) : 100;
  return { hasLimit, max: max ?? 0, issued, remaining, pctRemaining };
}

export const countCouponsForOffer = async (offerId: string): Promise<number> => {
  if (!offerId) return 0;
  if (isFirebaseConfigured()) {
    const q = query(collection(db, "coupons"), where("offerId", "==", offerId));
    const snap = await getDocs(q);
    return snap.size;
  }
  return MOCK_COUPONS.filter((c) => c.offerId === offerId).length;
};

/** Ofertas públicas (home): apenas documentos ativos; filtro de datas continua no cliente. */
export const getPublicOffers = async (): Promise<Offer[]> => {
  const now = new Date().toISOString().split('T')[0];

  if (isFirebaseConfigured()) {
    const q = query(collection(db, "offers"), where("isActive", "==", true));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) =>
      normalizeOfferFromFirestore(d.id, d.data() as Record<string, unknown>)
    );
  }

  await new Promise(r => setTimeout(r, 500));
  MOCK_OFFERS.forEach(offer => {
    if (offer.isActive && offer.validUntil < now) {
      offer.isActive = false;
    }
  });
  return [...MOCK_OFFERS].filter(o => o.isActive);
};

/** Home pública: atualização em tempo real quando cupons são gerados (Firestore). */
export const subscribePublicOffers = (callback: (offers: Offer[]) => void): (() => void) => {
  if (!isFirebaseConfigured()) {
    getPublicOffers().then(callback);
    return () => {};
  }
  const q = query(collection(db, "offers"), where("isActive", "==", true));
  return onSnapshot(q, (snapshot) => {
    callback(
      snapshot.docs.map((d) => normalizeOfferFromFirestore(d.id, d.data() as Record<string, unknown>))
    );
  });
};

/** Painel do comerciante: só ofertas cujo ownerUid corresponde ao usuário logado. */
export const getMerchantOffers = async (ownerUid: string): Promise<Offer[]> => {
  if (!ownerUid) return [];

  if (isFirebaseConfigured()) {
    const q = query(collection(db, "offers"), where("ownerUid", "==", ownerUid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) =>
      normalizeOfferFromFirestore(d.id, d.data() as Record<string, unknown>)
    );
  }

  await new Promise(r => setTimeout(r, 300));
  return MOCK_OFFERS.filter(o => o.ownerUid === ownerUid);
};

/** @deprecated Use getPublicOffers ou getMerchantOffers */
export const getOffers = getPublicOffers;

function stripOfferInternalFields(patch: Partial<Offer>): Partial<Offer> {
  const rest = { ...patch };
  delete rest.ownerUid;
  delete rest.couponsIssued;
  return rest;
}

export type OfferUpdateInput = Partial<Offer> & {
  removeCouponLimit?: boolean;
  /** Ao adicionar limite em oferta que não tinha, define contador = cupons já gerados */
  syncCouponsIssued?: number;
};

export const createOffer = async (
  offer: Omit<Offer, "id">,
  ownerUid: string
): Promise<Offer> => {
  const { maxCoupons: maxRaw, couponsIssued: _drop, ...rest } = offer;
  const hasLimit = typeof maxRaw === "number" && maxRaw >= 5;
  const payload: Omit<Offer, "id"> & { ownerUid: string } = hasLimit
    ? { ...rest, ownerUid, maxCoupons: maxRaw, couponsIssued: 0 }
    : { ...rest, ownerUid };

  if (isFirebaseConfigured()) {
    const docRef = await addDoc(collection(db, "offers"), payload);
    return { id: docRef.id, ...payload };
  }

  const newOffer = { ...payload, id: Math.random().toString(36).substr(2, 9) };
  MOCK_OFFERS.push(newOffer);
  return newOffer;
};

function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export const updateOffer = async (id: string, offer: OfferUpdateInput): Promise<void> => {
  const { removeCouponLimit, syncCouponsIssued, ...raw } = offer;
  let patch: Partial<Offer> = stripOfferInternalFields(raw);
  /** Desconto/tipo de promo é fixo após criar a oferta; nunca persistir alterações via update. */
  delete patch.discount;
  if (syncCouponsIssued != null) {
    patch = { ...patch, couponsIssued: syncCouponsIssued };
  }

  if (isFirebaseConfigured()) {
    const ref = doc(db, "offers", id);
    if (removeCouponLimit) {
      const cleaned = omitUndefined(patch as Record<string, unknown>);
      await updateDoc(ref, {
        ...cleaned,
        maxCoupons: deleteField(),
        couponsIssued: deleteField()
      });
      return;
    }
    const toWrite = omitUndefined(patch as Record<string, unknown>);
    if (Object.keys(toWrite).length > 0) {
      await updateDoc(ref, toWrite as Record<string, unknown>);
    }
  } else {
    const index = MOCK_OFFERS.findIndex((o) => o.id === id);
    if (index !== -1) {
      if (removeCouponLimit) {
        const cur = { ...MOCK_OFFERS[index] };
        delete cur.maxCoupons;
        delete cur.couponsIssued;
        MOCK_OFFERS[index] = { ...cur, ...patch };
      } else {
        MOCK_OFFERS[index] = { ...MOCK_OFFERS[index], ...patch };
      }
    } else {
      console.warn(`Offer with id ${id} not found in mock data.`);
    }
  }
};

export const deleteOffer = async (id: string): Promise<void> => {
  if (isFirebaseConfigured()) {
    await deleteDoc(doc(db, "offers", id));
  } else {
    // Ensure we are filtering correctly and updating the reference
    const index = MOCK_OFFERS.findIndex(o => o.id === id);
    if (index !== -1) {
      MOCK_OFFERS.splice(index, 1);
      console.log(`Deleted offer ${id}. Remaining: ${MOCK_OFFERS.length}`);
    } else {
      console.warn(`Offer with id ${id} not found in mock data.`);
    }
  }
};

function sanitizeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 120) || "file";
}

export const uploadImage = async (file: File, ownerUid: string): Promise<string> => {
  if (isFirebaseConfigured()) {
    try {
      const uid = ownerUid || "anon";
      const safe = sanitizeFileName(file.name);
      const storageRef = ref(storage, `offers/${uid}/${Date.now()}_${safe}`);
      const snapshot = await uploadBytes(storageRef, file);
      return await getDownloadURL(snapshot.ref);
    } catch (error) {
      console.error("Error uploading to Firebase Storage:", error);
      throw error;
    }
  } else {
    // Demo mode: Convert to Base64
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Enfileira e-mail via coleção `mail` (extensão Firebase "Trigger Email" + SMTP). Falha silenciosa se fila falhar. */
async function queueCouponEmail(
  to: string,
  offer: Offer,
  couponId: string
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  const siteUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://playasyventajas.com";
  const subject = `[Playas e Ventajas] Seu cupom - ${offer.title}`;
  const html = `
    <p>Olá,</p>
    <p>Seu cupom foi gerado com sucesso.</p>
    <p><strong>Oferta:</strong> ${escapeHtml(offer.title)}<br/>
    <strong>Desconto:</strong> ${escapeHtml(offer.discount)}<br/>
    <strong>Código do cupom:</strong> <code>${escapeHtml(couponId)}</code></p>
    <p>Apresente o QR Code no estabelecimento ou informe o código acima.</p>
    <p><a href="${siteUrl}">${escapeHtml(siteUrl)}</a></p>
  `.trim();
  try {
    await addDoc(collection(db, "mail"), {
      to: [to],
      message: { subject, html }
    });
    return true;
  } catch (e) {
    console.warn("queueCouponEmail:", e);
    return false;
  }
}

/** Agrega cupons por (e-mail + oferta) para base de clientes no painel. */
function buildConsumerStatsFromCoupons(
  coupons: Coupon[],
  merchantUid: string
): ConsumerStat[] {
  const map = new Map<
    string,
    {
      couponCount: number;
      validatedCount: number;
      lastCouponAt: number;
      offerTitle: string;
      email: string;
      offerId: string;
    }
  >();
  coupons.forEach((c) => {
    if (c.merchantUid !== merchantUid) return;
    const raw = (c.userEmail || "").trim().toLowerCase();
    if (!raw) return;
    const offerId = (c.offerId || "").trim();
    const key = `${raw}::${offerId || "__no_offer__"}`;
    const prev = map.get(key);
    const title = (c.offerTitle || "").trim();
    const used = c.status === "USED";
    map.set(key, {
      email: raw,
      offerId,
      offerTitle: (prev?.offerTitle || title) || "",
      couponCount: (prev?.couponCount || 0) + 1,
      validatedCount: (prev?.validatedCount || 0) + (used ? 1 : 0),
      lastCouponAt: Math.max(prev?.lastCouponAt || 0, c.createdAt || 0)
    });
  });
  return Array.from(map.values())
    .sort((a, b) => b.couponCount - a.couponCount || b.lastCouponAt - a.lastCouponAt)
    .slice(0, 50);
}

/** Ranking por e-mail: ofertas distintas e cupons validados (USED). */
function buildEmailAggregatesFromCoupons(
  coupons: Coupon[],
  merchantUid: string
): ConsumerEmailAggregate[] {
  const map = new Map<
    string,
    { offerIds: Set<string>; validatedCouponCount: number; lastCouponAt: number }
  >();
  coupons.forEach((c) => {
    if (c.merchantUid !== merchantUid) return;
    const raw = (c.userEmail || "").trim().toLowerCase();
    if (!raw) return;
    const offerKey = (c.offerId || "").trim() || "__no_offer__";
    const prev =
      map.get(raw) || {
        offerIds: new Set<string>(),
        validatedCouponCount: 0,
        lastCouponAt: 0
      };
    prev.offerIds.add(offerKey);
    if (c.status === "USED") prev.validatedCouponCount += 1;
    prev.lastCouponAt = Math.max(prev.lastCouponAt, c.createdAt || 0);
    map.set(raw, prev);
  });
  return Array.from(map.entries())
    .map(([email, v]) => ({
      email,
      distinctOfferCount: v.offerIds.size,
      validatedCouponCount: v.validatedCouponCount,
      lastCouponAt: v.lastCouponAt
    }))
    .sort(
      (a, b) =>
        b.distinctOfferCount - a.distinctOfferCount ||
        b.validatedCouponCount - a.validatedCouponCount ||
        b.lastCouponAt - a.lastCouponAt
    )
    .slice(0, 50);
}

function buildMerchantConsumerDashboard(
  coupons: Coupon[],
  merchantUid: string
): MerchantConsumerDashboard {
  return {
    byOffer: buildConsumerStatsFromCoupons(coupons, merchantUid),
    byEmail: buildEmailAggregatesFromCoupons(coupons, merchantUid)
  };
}

async function fetchCouponsForMerchant(merchantUid: string): Promise<Coupon[]> {
  if (!merchantUid) return [];
  if (isFirebaseConfigured()) {
    const q = query(
      collection(db, "coupons"),
      where("merchantUid", "==", merchantUid)
    );
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) => {
      const data = d.data() as Coupon;
      return { ...data, id: d.id };
    });
  }
  return MOCK_COUPONS.filter((c) => c.merchantUid === merchantUid);
}

/** Uma leitura: detalhe por oferta + ranking por e-mail (ofertas distintas e validados). */
export const getMerchantConsumerDashboard = async (
  merchantUid: string
): Promise<MerchantConsumerDashboard> => {
  if (!merchantUid) return { byOffer: [], byEmail: [] };
  const list = await fetchCouponsForMerchant(merchantUid);
  return buildMerchantConsumerDashboard(list, merchantUid);
};

/** @deprecated Prefer getMerchantConsumerDashboard para evitar segunda leitura quando precisar dos dois blocos. */
export const getMerchantConsumerStats = async (
  merchantUid: string
): Promise<ConsumerStat[]> => {
  const d = await getMerchantConsumerDashboard(merchantUid);
  return d.byOffer;
};

export const generateCoupon = async (
  offer: Offer,
  email: string
): Promise<{ coupon: Coupon; mailQueued: boolean }> => {
  const norm = normalizeCouponEmail(email);
  if (!norm) {
    throw new Error(COUPON_INVALID_EMAIL);
  }

  const merchantUid = offer.ownerUid?.trim() || "";
  const newCouponData: Omit<Coupon, "id"> = {
    offerId: offer.id,
    offerTitle: offer.title,
    discount: offer.discount,
    userEmail: norm,
    createdAt: Date.now(),
    status: "VALID",
    merchantUid
  };

  const maxClient = coerceNumberField(offer.maxCoupons as unknown);
  const hasLimit = maxClient != null && maxClient >= 5;

  const lockId = couponLockDocId(offer.id, norm);
  const lockRef = doc(db, "couponLocks", lockId);

  if (isFirebaseConfigured()) {
    if (hasLimit) {
      const coupon = await runTransaction(db, async (transaction) => {
        const lockSnap = await transaction.get(lockRef);
        if (lockSnap.exists()) {
          throw new Error(COUPON_ALREADY_CLAIMED);
        }
        const offerRef = doc(db, "offers", offer.id);
        const offerSnap = await transaction.get(offerRef);
        if (!offerSnap.exists()) {
          throw new Error(COUPON_SOLD_OUT);
        }
        const odRaw = offerSnap.data() as Record<string, unknown>;
        const mc = coerceNumberField(odRaw.maxCoupons);
        if (mc == null || mc < 5) {
          throw new Error(COUPON_SOLD_OUT);
        }
        const issued = coerceNumberField(odRaw.couponsIssued) ?? 0;
        const isAct = odRaw.isActive === true;
        if (!isAct || issued >= mc) {
          throw new Error(COUPON_SOLD_OUT);
        }
        const newIssued = issued + 1;
        const stillActive = newIssued < mc;
        const couponRef = doc(collection(db, "coupons"));
        transaction.set(lockRef, {
          offerId: offer.id,
          email: norm,
          createdAt: Date.now()
        });
        transaction.set(couponRef, newCouponData);
        transaction.update(offerRef, {
          couponsIssued: newIssued,
          isActive: stillActive
        });
        return { id: couponRef.id, ...newCouponData };
      });
      const mailQueued = await queueCouponEmail(norm, offer, coupon.id);
      return { coupon, mailQueued };
    }
    const coupon = await runTransaction(db, async (transaction) => {
      const lockSnap = await transaction.get(lockRef);
      if (lockSnap.exists()) {
        throw new Error(COUPON_ALREADY_CLAIMED);
      }
      const couponRef = doc(collection(db, "coupons"));
      transaction.set(lockRef, {
        offerId: offer.id,
        email: norm,
        createdAt: Date.now()
      });
      transaction.set(couponRef, newCouponData);
      return { id: couponRef.id, ...newCouponData };
    });
    const mailQueued = await queueCouponEmail(norm, offer, coupon.id);
    return { coupon, mailQueued };
  }

  const mk = mockLockKey(offer.id, norm);
  if (MOCK_COUPON_LOCK_KEYS.has(mk)) {
    throw new Error(COUPON_ALREADY_CLAIMED);
  }
  if (MOCK_COUPONS.some((c) => c.offerId === offer.id && normalizeCouponEmail(c.userEmail) === norm)) {
    throw new Error(COUPON_ALREADY_CLAIMED);
  }

  if (hasLimit) {
    const o = MOCK_OFFERS.find((x) => x.id === offer.id);
    if (!o || !o.isActive) {
      throw new Error(COUPON_SOLD_OUT);
    }
    const mc = o.maxCoupons ?? 0;
    const issued = o.couponsIssued ?? 0;
    if (mc < 5 || issued >= mc) {
      throw new Error(COUPON_SOLD_OUT);
    }
    o.couponsIssued = issued + 1;
    o.isActive = o.couponsIssued < mc;
    const coupon = {
      ...newCouponData,
      id: `CPN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
    };
    MOCK_COUPONS.push(coupon);
    MOCK_COUPON_LOCK_KEYS.add(mk);
    return { coupon, mailQueued: false };
  }

  const coupon = {
    ...newCouponData,
    id: `CPN-${Math.random().toString(36).substr(2, 6).toUpperCase()}`
  };
  MOCK_COUPONS.push(coupon);
  MOCK_COUPON_LOCK_KEYS.add(mk);
  return { coupon, mailQueued: false };
};

export const validateCoupon = async (
  couponId: string,
  scannerMerchantUid?: string
): Promise<{ success: boolean; message: string; coupon?: Coupon }> => {
  if (isFirebaseConfigured()) {
    const cref = doc(db, "coupons", couponId);
    const snap = await getDoc(cref);
    if (!snap.exists()) {
      return { success: false, message: "Coupon not found." };
    }
    const data = snap.data() as Coupon;
    const coupon = { id: snap.id, ...data };
    if (
      scannerMerchantUid &&
      coupon.merchantUid &&
      coupon.merchantUid !== scannerMerchantUid
    ) {
      return { success: false, message: "Coupon wrong merchant." };
    }
    if (coupon.status === "USED") {
      return { success: false, message: "Coupon already used." };
    }
    await updateDoc(cref, { status: "USED" });
    return { success: true, message: "Coupon Validated Successfully!", coupon: { ...coupon, status: "USED" } };
  }

  const coupon = MOCK_COUPONS.find((c) => c.id === couponId);
  if (!coupon) return { success: false, message: "Coupon not found." };
  if (
    scannerMerchantUid &&
    coupon.merchantUid &&
    coupon.merchantUid !== scannerMerchantUid
  ) {
    return { success: false, message: "Coupon wrong merchant." };
  }
  if (coupon.status === "USED") return { success: false, message: "Coupon already used." };
  coupon.status = "USED";
  return { success: true, message: "Coupon Validated Successfully!", coupon };
};