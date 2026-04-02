import {
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
import { Offer, Coupon, ConsumerStat } from "../types";

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

let MOCK_COUPONS: Coupon[] = [];

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
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Offer));
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
    callback(snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as Offer)));
  });
};

/** Painel do comerciante: só ofertas cujo ownerUid corresponde ao usuário logado. */
export const getMerchantOffers = async (ownerUid: string): Promise<Offer[]> => {
  if (!ownerUid) return [];

  if (isFirebaseConfigured()) {
    const q = query(collection(db, "offers"), where("ownerUid", "==", ownerUid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map(d => ({ id: d.id, ...d.data() } as Offer));
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
    { couponCount: number; lastCouponAt: number; offerTitle: string; email: string; offerId: string }
  >();
  coupons.forEach((c) => {
    if (c.merchantUid !== merchantUid) return;
    const raw = (c.userEmail || "").trim().toLowerCase();
    if (!raw) return;
    const offerId = (c.offerId || "").trim();
    const key = `${raw}::${offerId || "__no_offer__"}`;
    const prev = map.get(key);
    const title = (c.offerTitle || "").trim();
    map.set(key, {
      email: raw,
      offerId,
      offerTitle: (prev?.offerTitle || title) || "",
      couponCount: (prev?.couponCount || 0) + 1,
      lastCouponAt: Math.max(prev?.lastCouponAt || 0, c.createdAt || 0)
    });
  });
  return Array.from(map.values())
    .sort((a, b) => b.couponCount - a.couponCount || b.lastCouponAt - a.lastCouponAt)
    .slice(0, 50);
}

/** Cupons gerados para ofertas deste comerciante: agrega por e-mail e oferta (base de clientes + top consumidores). */
export const getMerchantConsumerStats = async (
  merchantUid: string
): Promise<ConsumerStat[]> => {
  if (!merchantUid) return [];

  if (isFirebaseConfigured()) {
    const q = query(
      collection(db, "coupons"),
      where("merchantUid", "==", merchantUid)
    );
    const querySnapshot = await getDocs(q);
    const list: Coupon[] = querySnapshot.docs.map((d) => {
      const data = d.data() as Coupon;
      return { ...data, id: d.id };
    });
    return buildConsumerStatsFromCoupons(list, merchantUid);
  }

  return buildConsumerStatsFromCoupons(MOCK_COUPONS, merchantUid);
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

  const hasLimit =
    offer.maxCoupons != null &&
    typeof offer.maxCoupons === "number" &&
    offer.maxCoupons >= 5;

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
        const od = offerSnap.data() as Offer;
        const mc = od.maxCoupons;
        if (mc == null || mc < 5) {
          throw new Error(COUPON_SOLD_OUT);
        }
        const issued = od.couponsIssued ?? 0;
        if (!od.isActive || issued >= mc) {
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