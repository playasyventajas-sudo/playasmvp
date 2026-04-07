/**
 * Sincroniza `offers.isActive` com vigência local + publishIntent + limite de cupons.
 * Roda a cada 15 min para virada de dia sem depender do painel (home pública usa query isActive).
 */
const { onSchedule } = require("firebase-functions/v2/scheduler");
const admin = require("firebase-admin");

admin.initializeApp();
const db = admin.firestore();

function parseBool(v) {
  if (v == null) return undefined;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "number") return v !== 0;
  return undefined;
}

function localDateYmd() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toCanonicalYmd(v) {
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
  if (v && typeof v.toDate === "function") {
    const d = v.toDate();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (typeof v === "object" && v !== null && typeof v.seconds === "number") {
    const d = new Date(v.seconds * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  if (v instanceof Date && !isNaN(v.getTime())) {
    const d = v;
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }
  return undefined;
}

function coerceNumber(v) {
  if (v == null) return undefined;
  if (typeof v === "number" && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === "string" && v.trim() !== "") {
    const n = parseInt(v, 10);
    if (!Number.isNaN(n)) return n;
  }
  return undefined;
}

function computePersistedIsActive({
  publishIntent,
  validFrom,
  validUntil,
  nowYmd,
  couponsIssued,
  maxCoupons
}) {
  if (!publishIntent) return false;
  const vuRaw =
    toCanonicalYmd(validUntil) ??
    (typeof validUntil === "string"
      ? validUntil.trim().slice(0, 10)
      : String(validUntil ?? "").trim().slice(0, 10));
  if (!vuRaw || !/^\d{4}-\d{2}-\d{2}$/.test(vuRaw)) return false;
  if (vuRaw < nowYmd) return false;
  // Mesma regra que dataService: vigência futura não zera isActive na listagem.
  const mc = maxCoupons;
  const issued = couponsIssued ?? 0;
  const hasLimit = mc != null && mc >= 5;
  if (hasLimit && issued >= mc) return false;
  return true;
}

function computeFromDoc(data) {
  const vf = toCanonicalYmd(data.validFrom);
  const vu = toCanonicalYmd(data.validUntil);
  const pPub = parseBool(data.publishIntent);
  const pAct = parseBool(data.isActive);
  const publishIntent = pPub !== undefined ? pPub : pAct !== false;
  const issued = coerceNumber(data.couponsIssued) ?? 0;
  const mc = coerceNumber(data.maxCoupons);
  return computePersistedIsActive({
    publishIntent,
    validFrom: vf,
    validUntil: vu || "",
    nowYmd: localDateYmd(),
    couponsIssued: issued,
    maxCoupons: mc
  });
}

function parseStoredIsActive(data) {
  const v = data.isActive;
  if (typeof v === "boolean") return v;
  if (typeof v === "string") return v === "true" || v === "1";
  if (typeof v === "number") return v !== 0;
  if (v == null) return true;
  return true;
}

exports.syncOfferLifecycle = onSchedule(
  {
    schedule: "every 15 minutes",
    timeZone: "America/Argentina/Buenos_Aires",
    retryCount: 1
  },
  async () => {
    const snap = await db.collection("offers").get();
    let batch = db.batch();
    let opsInBatch = 0;
    for (const doc of snap.docs) {
      const data = doc.data();
      const computed = computeFromDoc(data);
      const stored = parseStoredIsActive(data);
      if (stored !== computed) {
        batch.update(doc.ref, { isActive: computed });
        opsInBatch++;
        if (opsInBatch >= 500) {
          await batch.commit();
          batch = db.batch();
          opsInBatch = 0;
        }
      }
    }
    if (opsInBatch > 0) {
      await batch.commit();
    }
  }
);
