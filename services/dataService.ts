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
  onSnapshot,
  type QueryDocumentSnapshot
} from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { getFunctions, httpsCallable } from "firebase/functions";
import { app, db, storage, isFirebaseConfigured } from "./firebaseConfig";
import {
  Offer,
  OfferCity,
  Coupon,
  ConsumerStat,
  ConsumerEmailAggregate,
  MerchantConsumerDashboard
} from "../types";
import {
  clipString,
  COMPANY_NAME_MAX,
  OFFER_DESCRIPTION_MAX,
  OFFER_DISCOUNT_MAX,
  OFFER_TITLE_MAX
} from "../src/offerLimits";
import { clipOfferI18nFields, offerDiscount, offerTitle } from "../src/offerI18n";
import type { Language } from "../src/translations";

// --- Mock Data for Demo (fallback) ---
const MOCK_OWNER_UID = "mock-user-123";

/** Demo: atualiza nome exibido em todas as ofertas do dono (sem Firebase). */
export function updateMockOffersMerchantName(ownerUid: string, merchantName: string): void {
  MOCK_OFFERS.forEach((o) => {
    if (o.ownerUid === ownerUid) o.merchantName = merchantName;
  });
}

/** Sem Firebase: lista vazia (sem ofertas de exemplo no repositório). */
let MOCK_OFFERS: Offer[] = [];

/** Sem Firebase: sem cupons de exemplo. */
let MOCK_COUPONS: Coupon[] = [];

/** Região das Cloud Functions (deve coincidir com `functions/translateOffer.js`). */
const FUNCTIONS_REGION = "southamerica-east1";
export const COSTA_DO_SOL_AND_METRO_CITIES: readonly OfferCity[] = [
  "Araruama",
  "Armação dos Búzios",
  "Arraial do Cabo",
  "Cabo Frio",
  "Casimiro de Abreu",
  "Iguaba Grande",
  "Rio das Ostras",
  "São Pedro da Aldeia",
  "Saquarema",
  "Silva Jardim",
  "Rio de Janeiro",
  "Niterói"
] as const;
export const LEGACY_DEFAULT_CITY: OfferCity = "Cabo Frio";

/** Erro quando a oferta esgotou cupons ou está inativa (turista). */
export const COUPON_SOLD_OUT = "COUPON_SOLD_OUT";

/** Já existe cupom para este e-mail nesta oferta (1 por oferta). */
export const COUPON_ALREADY_CLAIMED = "COUPON_ALREADY_CLAIMED";

/** Campo de e-mail vazio ao gerar cupom (obrigatório preencher algo). */
export const COUPON_INVALID_EMAIL = "COUPON_INVALID_EMAIL";

/** Oferta ainda não entrou em vigência (validFrom > hoje local). */
export const COUPON_OFFER_NOT_YET_VALID = "COUPON_OFFER_NOT_YET_VALID";

export function localDateYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function parseBoolishField(v: unknown): boolean | undefined {
  if (v == null) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "number") return v !== 0;
  return undefined;
}

function normalizeOfferCity(v: unknown): OfferCity | undefined {
  if (typeof v !== "string") return undefined;
  const city = v.trim() as OfferCity;
  return COSTA_DO_SOL_AND_METRO_CITIES.includes(city) ? city : undefined;
}

/** Valor efetivo gravado no Firestore: intenção + vigência local + limite de cupons. */
export function computePersistedIsActive(args: {
  publishIntent: boolean;
  validFrom?: string;
  validUntil: string;
  nowYmd: string;
  couponsIssued: number;
  maxCoupons?: number;
}): boolean {
  if (!args.publishIntent) return false;
  const vuRaw =
    toCanonicalYmd(args.validUntil) ??
    (typeof args.validUntil === "string"
      ? args.validUntil.trim().slice(0, 10)
      : String(args.validUntil ?? "").trim().slice(0, 10));
  if (!vuRaw || !/^\d{4}-\d{2}-\d{2}$/.test(vuRaw)) return false;
  if (vuRaw < args.nowYmd) return false;
  // validFrom no futuro NÃO desliga isActive persistido: o painel do comerciante continua vendo a oferta como “ativa” até o início;
  // na vitrine pública, `App.tsx` filtra `validFrom > hoje`. generateCoupon / assertOfferDatesAllowCoupon bloqueiam cupom até a data.
  const mc = args.maxCoupons;
  const issued = args.couponsIssued ?? 0;
  const hasLimit = mc != null && mc >= 5;
  if (hasLimit && issued >= mc) return false;
  return true;
}

/** Compara com o boolean gravado no doc (legado true se ausente). */
function parseStoredIsActiveFromRaw(data: Record<string, unknown>): boolean {
  const v = data.isActive;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "number") return v !== 0;
  if (v == null) return true;
  return true;
}

/** Bloqueia cupom fora da vigência (datas locais, alinhado à home). */
function assertOfferDatesAllowCoupon(offer: Offer): void {
  const nowYmd = localDateYmd();
  const vf = offer.validFrom ? toCanonicalYmd(offer.validFrom as unknown) : undefined;
  const vu = toCanonicalYmd(offer.validUntil as unknown);
  if (vu && vu < nowYmd) {
    throw new Error(COUPON_SOLD_OUT);
  }
  if (vf && vf > nowYmd) {
    throw new Error(COUPON_OFFER_NOT_YET_VALID);
  }
}

/** Texto gravado no cupom: trim + minúsculas (mesmo e-mail em qualquer idioma/UI = mesma identidade). */
export function normalizeCouponEmail(email: string): string {
  return (email || "").trim().toLowerCase();
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
    const n = parseInt(v.trim(), 10);
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

export function computePersistedIsActiveFromOffer(o: Offer): boolean {
  const vuRaw = o.validUntil as unknown;
  const vu = toCanonicalYmd(vuRaw) ?? (typeof vuRaw === "string" ? vuRaw.trim().slice(0, 10) : "");
  const vf = o.validFrom ? toCanonicalYmd(o.validFrom as unknown) : undefined;
  const issued = coerceNumberField(o.couponsIssued as unknown) ?? 0;
  const mc = coerceNumberField(o.maxCoupons as unknown);
  return computePersistedIsActive({
    publishIntent: o.publishIntent !== false,
    validFrom: vf,
    validUntil: vu || "",
    nowYmd: localDateYmd(),
    couponsIssued: issued,
    maxCoupons: mc
  });
}

/** Normaliza oferta do Firestore (datas, publishIntent legado, isActive efetivo). */
export function normalizeOfferFromFirestore(id: string, data: Record<string, unknown>): Offer {
  const o = { id, ...data } as Offer;
  o.city = normalizeOfferCity(data.city) ?? LEGACY_DEFAULT_CITY;
  const mc = coerceNumberField(data.maxCoupons);
  if (mc !== undefined) o.maxCoupons = mc;
  const ci = coerceNumberField(data.couponsIssued);
  if (ci !== undefined) o.couponsIssued = ci;
  const vf = toCanonicalYmd(data.validFrom) ?? toCanonicalYmd(o.validFrom as unknown);
  if (vf !== undefined) o.validFrom = vf;
  const vu = toCanonicalYmd(data.validUntil) ?? toCanonicalYmd(o.validUntil as unknown);
  if (vu !== undefined) o.validUntil = vu;
  const pPub = parseBoolishField(data.publishIntent);
  const pAct = parseBoolishField(data.isActive);
  o.publishIntent = pPub !== undefined ? pPub : pAct !== false;
  o.isActive = computePersistedIsActiveFromOffer(o);
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

/**
 * Conta cupons da oferta **para o comerciante** (merchantUid obrigatório no Firebase).
 * Query só por `offerId` falha nas regras: leitura de `coupons` exige `merchantUid == auth.uid`;
 * sem o segundo filtro o Firestore pode negar a listagem inteira (`permission-denied`).
 */
export const countCouponsForOffer = async (
  offerId: string,
  merchantUid: string
): Promise<number> => {
  if (!offerId) return 0;
  if (isFirebaseConfigured()) {
    const q = query(
      collection(db, "coupons"),
      where("offerId", "==", offerId),
      where("merchantUid", "==", merchantUid)
    );
    const snap = await getDocs(q);
    return snap.size;
  }
  return MOCK_COUPONS.filter(
    (c) => c.offerId === offerId && c.merchantUid === merchantUid
  ).length;
};

/** Mescla queries por isActive (boolean true, string "true", int 1 — legado/Console). */
function mergeActiveOfferDocs(...groups: QueryDocumentSnapshot[][]): Offer[] {
  const byId = new Map<string, Offer>();
  for (const group of groups) {
    for (const d of group) {
      byId.set(d.id, normalizeOfferFromFirestore(d.id, d.data() as Record<string, unknown>));
    }
  }
  return Array.from(byId.values());
}

/**
 * Ofertas públicas (home): documentos com isActive true (boolean) ou "true" (string no Console).
 * A query precisa filtrar por isActive — senão, para usuário anônimo, o Firestore
 * rejeita listagens na coleção inteira (regras não são "filtro" pós-query).
 * Ofertas legadas sem o campo: rodar `npm run backfill:isactive`.
 */
export const getPublicOffers = async (): Promise<Offer[]> => {
  if (isFirebaseConfigured()) {
    const col = collection(db, "offers");
    const qBool = query(col, where("isActive", "==", true));
    const qStr = query(col, where("isActive", "==", "true"));
    const qInt = query(col, where("isActive", "==", 1));
    const [snapBool, snapStr, snapInt] = await Promise.all([
      getDocs(qBool),
      getDocs(qStr),
      getDocs(qInt)
    ]);
    return mergeActiveOfferDocs(snapBool.docs, snapStr.docs, snapInt.docs);
  }

    await new Promise(r => setTimeout(r, 500));
  return MOCK_OFFERS.filter((o) => computePersistedIsActiveFromOffer(o));
};

/** Home pública: atualização em tempo real quando cupons são gerados (Firestore). */
export const subscribePublicOffers = (callback: (offers: Offer[]) => void): (() => void) => {
  if (!isFirebaseConfigured()) {
    getPublicOffers().then(callback);
    return () => {};
  }
  const col = collection(db, "offers");
  const qBool = query(col, where("isActive", "==", true));
  const qStr = query(col, where("isActive", "==", "true"));
  const qInt = query(col, where("isActive", "==", 1));
  let docsBool: QueryDocumentSnapshot[] = [];
  let docsStr: QueryDocumentSnapshot[] = [];
  let docsInt: QueryDocumentSnapshot[] = [];
  const emit = () => {
    callback(mergeActiveOfferDocs(docsBool, docsStr, docsInt));
  };
  const onErr = (err: unknown) => console.error("[subscribePublicOffers]", err);
  const unsub1 = onSnapshot(
    qBool,
    (snap) => {
      docsBool = snap.docs;
      emit();
    },
    onErr
  );
  const unsub2 = onSnapshot(
    qStr,
    (snap) => {
      docsStr = snap.docs;
      emit();
    },
    onErr
  );
  const unsub3 = onSnapshot(
    qInt,
    (snap) => {
      docsInt = snap.docs;
      emit();
    },
    onErr
  );
  return () => {
    unsub1();
    unsub2();
    unsub3();
  };
};

/** Atualiza `isActive` no Firestore quando vigência/limite mudou o valor efetivo (ex.: virada de dia). */
async function syncOfferLifecycleForOwner(ownerUid: string): Promise<void> {
  if (!ownerUid) return;
  if (!isFirebaseConfigured()) {
    for (const o of MOCK_OFFERS) {
      if (o.ownerUid !== ownerUid) continue;
      const computed = computePersistedIsActiveFromOffer(o);
      if (o.isActive !== computed) o.isActive = computed;
    }
    return;
  }
  const q = query(collection(db, "offers"), where("ownerUid", "==", ownerUid));
  const snap = await getDocs(q);
  for (const d of snap.docs) {
    const raw = d.data() as Record<string, unknown>;
    const o = normalizeOfferFromFirestore(d.id, raw);
    const stored = parseStoredIsActiveFromRaw(raw);
    if (stored !== o.isActive) {
      await updateDoc(d.ref, { isActive: o.isActive });
    }
  }
}

/** Painel do comerciante: só ofertas cujo ownerUid corresponde ao usuário logado. */
export const getMerchantOffers = async (ownerUid: string): Promise<Offer[]> => {
  if (!ownerUid) return [];

  if (isFirebaseConfigured()) {
    await syncOfferLifecycleForOwner(ownerUid);
    const q = query(collection(db, "offers"), where("ownerUid", "==", ownerUid));
    const querySnapshot = await getDocs(q);
    return querySnapshot.docs.map((d) =>
      normalizeOfferFromFirestore(d.id, d.data() as Record<string, unknown>)
    );
  }

  await syncOfferLifecycleForOwner(ownerUid);
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
  const { maxCoupons: maxRaw, couponsIssued: _drop, isActive: _ia, ...rest } = offer;
  const vfRaw = (rest.validFrom ?? "").trim();
  const vuRaw = (rest.validUntil ?? "").trim();
  const publishIntent = rest.publishIntent !== false;
  const hasLimit = typeof maxRaw === "number" && maxRaw >= 5;
  const nowYmd = localDateYmd();
  const vfCanon = vfRaw ? toCanonicalYmd(vfRaw) ?? vfRaw.slice(0, 10) : undefined;
  const vuCanon = toCanonicalYmd(vuRaw) ?? vuRaw.slice(0, 10);
  const isActive = computePersistedIsActive({
    publishIntent,
    validFrom: vfCanon,
    validUntil: vuCanon,
    nowYmd,
    couponsIssued: 0,
    maxCoupons: hasLimit ? maxRaw : undefined
  });
  const i18n = clipOfferI18nFields(rest);
  const city = normalizeOfferCity(rest.city) ?? LEGACY_DEFAULT_CITY;
  const restClipped = {
    ...rest,
    ...i18n,
    city,
    validFrom: vfCanon || undefined,
    validUntil: vuCanon,
    title: clipString((rest.title ?? "").trim(), OFFER_TITLE_MAX),
    description: clipString((rest.description ?? "").trim(), OFFER_DESCRIPTION_MAX),
    discount: clipString((rest.discount ?? "").trim(), OFFER_DISCOUNT_MAX),
    merchantName: clipString((rest.merchantName ?? "").trim(), COMPANY_NAME_MAX),
    publishIntent,
    isActive
  };
  const payload: Omit<Offer, "id"> & { ownerUid: string } = hasLimit
    ? { ...restClipped, ownerUid, maxCoupons: maxRaw, couponsIssued: 0 }
    : { ...restClipped, ownerUid };

  if (isFirebaseConfigured()) {
    const docRef = await addDoc(collection(db, "offers"), payload);
    return { id: docRef.id, ...payload };
  }

  const newOffer = { ...payload, id: Math.random().toString(36).substr(2, 9) };
    MOCK_OFFERS.push(newOffer);
    return newOffer;
};

/**
 * Chama a Cloud Function que preenche titleEn/Es, descriptionEn/Es, discountEn/Es no Firestore.
 * A chave da API de tradução fica só no servidor (Google ADC). Falhas são ignoradas (log no console).
 */
export async function requestOfferAutoTranslation(offerId: string): Promise<void> {
  if (!isFirebaseConfigured() || !offerId?.trim()) return;
  try {
    const functions = getFunctions(app, FUNCTIONS_REGION);
    const translateFn = httpsCallable(functions, "translateOfferFields");
    const res = await translateFn({ offerId: offerId.trim() });
    const data = res.data as { ok?: boolean; code?: string };
    if (data && data.ok === false) {
      console.warn("[requestOfferAutoTranslation]", data.code || "failed", data);
    }
  } catch (e) {
    console.warn("[requestOfferAutoTranslation]", e);
  }
}

function omitUndefined<T extends Record<string, unknown>>(obj: T): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const k of Object.keys(obj)) {
    const v = obj[k];
    if (v !== undefined) out[k] = v;
  }
  return out;
}

/** Após criar a oferta, só vigência e limite de cupons (e publishIntent; isActive é recalculado) podem ser alterados pelo painel. */
const OFFER_UPDATE_ALLOWED: (keyof Offer)[] = [
  "city",
  "validFrom",
  "validUntil",
  "maxCoupons",
  "publishIntent",
  "couponsIssued",
  "titleEn",
  "titleEs",
  "descriptionEn",
  "descriptionEs",
  "discountEn",
  "discountEs"
];

function pickAllowedOfferPatch(patch: Partial<Offer>): Partial<Offer> {
  const out: Partial<Offer> = {};
  for (const key of OFFER_UPDATE_ALLOWED) {
    if (patch[key] !== undefined) {
      (out as Record<string, unknown>)[key as string] = patch[key];
    }
  }
  return out;
}

export const updateOffer = async (id: string, offer: OfferUpdateInput): Promise<void> => {
  const { removeCouponLimit, syncCouponsIssued, ...raw } = offer;
  let patch: Partial<Offer> = stripOfferInternalFields(raw);
  /** Desconto/tipo de promo é fixo após criar a oferta; nunca persistir alterações via update. */
  delete patch.discount;
  delete patch.isActive;
  patch = pickAllowedOfferPatch(patch);
  if (patch.city !== undefined) {
    patch.city = normalizeOfferCity(patch.city) ?? LEGACY_DEFAULT_CITY;
  }
  if (syncCouponsIssued != null) {
    patch = { ...patch, couponsIssued: syncCouponsIssued };
  }

  if (isFirebaseConfigured()) {
    const ref = doc(db, "offers", id);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      console.warn(`Offer ${id} not found.`);
      return;
    }
    const current = normalizeOfferFromFirestore(id, snap.data() as Record<string, unknown>);

    if (removeCouponLimit) {
      const merged: Offer = {
        ...current,
        ...patch,
        maxCoupons: undefined,
        couponsIssued: undefined
      };
      const isActive = computePersistedIsActiveFromOffer(merged);
      const cleaned = omitUndefined(patch as Record<string, unknown>);
      await updateDoc(ref, {
        ...cleaned,
        maxCoupons: deleteField(),
        couponsIssued: deleteField(),
        isActive
      } as Record<string, unknown>);
      return;
    }

    const merged: Offer = { ...current, ...patch };
    const isActive = computePersistedIsActiveFromOffer(merged);
    const cleaned = omitUndefined(patch as Record<string, unknown>);
    await updateDoc(ref, { ...cleaned, isActive } as Record<string, unknown>);
  } else {
    const index = MOCK_OFFERS.findIndex((o) => o.id === id);
    if (index === -1) {
      console.warn(`Offer with id ${id} not found in mock data.`);
      return;
    }
    let merged: Offer = { ...MOCK_OFFERS[index] };
    if (removeCouponLimit) {
      delete merged.maxCoupons;
      delete merged.couponsIssued;
    }
    merged = { ...merged, ...patch };
    if (removeCouponLimit) {
      merged.maxCoupons = undefined;
      merged.couponsIssued = undefined;
    }
    merged.isActive = computePersistedIsActiveFromOffer(merged);
    MOCK_OFFERS[index] = merged;
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
  couponId: string,
  lang: Language = "pt"
): Promise<boolean> {
  if (!isFirebaseConfigured()) return false;
  const siteUrl =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : "https://playasyventajas.com";
  const tit = offerTitle(offer, lang);
  const disc = offerDiscount(offer, lang);
  const subject = `[Playas e Ventajas] Seu cupom - ${tit}`;
  const html = `
    <p>Olá,</p>
    <p>Seu cupom foi gerado com sucesso.</p>
    <p><strong>Oferta:</strong> ${escapeHtml(tit)}<br/>
    <strong>Desconto:</strong> ${escapeHtml(disc)}<br/>
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

/** Ranking por e-mail: prioriza validações (USED); se o comerciante ainda não tiver nenhuma validação, prioriza quem mais gerou cupons. */
function buildEmailAggregatesFromCoupons(
  coupons: Coupon[],
  merchantUid: string
): ConsumerEmailAggregate[] {
  const map = new Map<
    string,
    {
      offerIds: Set<string>;
      claimedCouponCount: number;
      validatedCouponCount: number;
      lastCouponAt: number;
    }
  >();
  coupons.forEach((c) => {
    if (c.merchantUid !== merchantUid) return;
    const raw = (c.userEmail || "").trim().toLowerCase();
    if (!raw) return;
    const offerKey = (c.offerId || "").trim() || "__no_offer__";
    const prev =
      map.get(raw) || {
        offerIds: new Set<string>(),
        claimedCouponCount: 0,
        validatedCouponCount: 0,
        lastCouponAt: 0
      };
    prev.offerIds.add(offerKey);
    prev.claimedCouponCount += 1;
    if (c.status === "USED") prev.validatedCouponCount += 1;
    prev.lastCouponAt = Math.max(prev.lastCouponAt, c.createdAt || 0);
    map.set(raw, prev);
  });

  const merchantHasAnyValidation = coupons.some(
    (c) => c.merchantUid === merchantUid && c.status === "USED"
  );

  return Array.from(map.entries())
    .map(([email, v]) => ({
      email,
      distinctOfferCount: v.offerIds.size,
      claimedCouponCount: v.claimedCouponCount,
      validatedCouponCount: v.validatedCouponCount,
      lastCouponAt: v.lastCouponAt
    }))
    .sort((a, b) => {
      if (merchantHasAnyValidation) {
        return (
          b.validatedCouponCount - a.validatedCouponCount ||
          b.claimedCouponCount - a.claimedCouponCount ||
          b.distinctOfferCount - a.distinctOfferCount ||
          b.lastCouponAt - a.lastCouponAt
        );
      }
      return (
        b.claimedCouponCount - a.claimedCouponCount ||
        b.distinctOfferCount - a.distinctOfferCount ||
        b.validatedCouponCount - a.validatedCouponCount ||
        b.lastCouponAt - a.lastCouponAt
      );
    })
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
  email: string,
  lang: Language = "pt"
): Promise<{ coupon: Coupon; mailQueued: boolean }> => {
  const norm = normalizeCouponEmail(email);
  if (!norm) {
    throw new Error(COUPON_INVALID_EMAIL);
  }

  assertOfferDatesAllowCoupon(offer);

  const merchantUid = offer.ownerUid?.trim() || "";
  // Firestore omite chaves com valor `undefined`; a regra exige hasAll(offerTitle, discount, …) → permission-denied.
  const couponPayloadBase = (od: Offer): Omit<Coupon, "id"> => ({
    offerId: od.id,
    offerTitle: clipString((offerTitle(od, lang) ?? "").trim(), OFFER_TITLE_MAX),
    discount: clipString((offerDiscount(od, lang) ?? "").trim(), OFFER_DISCOUNT_MAX),
    userEmail: norm,
    createdAt: Date.now(),
    status: "VALID",
    merchantUid
  });
  const newCouponData: Omit<Coupon, "id"> = couponPayloadBase(offer);

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
        const odNorm = normalizeOfferFromFirestore(offer.id, odRaw);
        if (!odNorm.isActive || issued >= mc) {
          throw new Error(COUPON_SOLD_OUT);
        }
        const newIssued = issued + 1;
        // maxCoupons deve vir do snapshot (mc): se odNorm perder maxCoupons na normalização,
        // computePersistedIsActiveFromOffer pode achar “sem limite” e isActive=true no último cupom.
        // Regra Firestore: isActive deve bater com (newIssued < max) — forçamos estoque com mc do snapshot.
        const mergedAfter = { ...odNorm, couponsIssued: newIssued, maxCoupons: mc };
        const stillActive =
          computePersistedIsActiveFromOffer(mergedAfter) && newIssued < mc;
        const payload = couponPayloadBase(odNorm);
        const couponRef = doc(collection(db, "coupons"));
        transaction.set(lockRef, {
          offerId: offer.id,
          email: norm,
          createdAt: Date.now()
        });
        transaction.set(couponRef, payload);
        transaction.update(offerRef, {
          couponsIssued: newIssued,
          isActive: stillActive
        });
        return { id: couponRef.id, ...payload };
      });
      const snapMail = await getDoc(doc(db, "offers", offer.id));
      const odMail = snapMail.exists()
        ? normalizeOfferFromFirestore(offer.id, snapMail.data() as Record<string, unknown>)
        : offer;
      const mailQueued = await queueCouponEmail(norm, odMail, coupon.id, lang);
      return { coupon, mailQueued };
    }
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
      const odNorm = normalizeOfferFromFirestore(offer.id, offerSnap.data() as Record<string, unknown>);
      assertOfferDatesAllowCoupon(odNorm);
      if (!odNorm.isActive) {
        throw new Error(COUPON_SOLD_OUT);
      }
      const payload = couponPayloadBase(odNorm);
      const couponRef = doc(collection(db, "coupons"));
      transaction.set(lockRef, {
        offerId: offer.id,
        email: norm,
        createdAt: Date.now()
      });
      transaction.set(couponRef, payload);
      return { id: couponRef.id, ...payload };
    });
    const snapMail2 = await getDoc(doc(db, "offers", offer.id));
    const odMail2 = snapMail2.exists()
      ? normalizeOfferFromFirestore(offer.id, snapMail2.data() as Record<string, unknown>)
      : offer;
    const mailQueued = await queueCouponEmail(norm, odMail2, coupon.id, lang);
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
    o.isActive = computePersistedIsActiveFromOffer(o);
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

/** Erro ao gravar status USED (regras/rede); não confundir com cupom de outro comerciante. */
export const COUPON_VALIDATE_WRITE_FAILED = "COUPON_VALIDATE_WRITE_FAILED";

export const validateCoupon = async (
  couponId: string,
  scannerMerchantUid?: string
): Promise<{ success: boolean; message: string; coupon?: Coupon }> => {
  if (isFirebaseConfigured()) {
    const cref = doc(db, "coupons", couponId);
    const permissionDenied = (e: unknown) =>
      typeof e === "object" &&
      e !== null &&
      "code" in e &&
      String((e as { code: unknown }).code) === "permission-denied";

    let snap;
    try {
      snap = await getDoc(cref);
    } catch (e: unknown) {
      if (permissionDenied(e)) {
        return { success: false, message: "Coupon wrong merchant." };
      }
      throw e;
    }
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
    try {
      await updateDoc(cref, { status: "USED" });
    } catch (e: unknown) {
      if (permissionDenied(e)) {
        return { success: false, message: COUPON_VALIDATE_WRITE_FAILED };
      }
      throw e;
    }
    return {
      success: true,
      message: "Coupon Validated Successfully!",
      coupon: { ...coupon, status: "USED" }
    };
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