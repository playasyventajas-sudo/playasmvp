/**
 * Tradução automática PT → EN/ES para campos da oferta.
 *
 * Configuração (sem chave no app web):
 * 1. No Google Cloud do mesmo projeto do Firebase, ative "Cloud Translation API".
 * 2. Garanta que a conta de serviço usada pelo Cloud Functions 2ª geração tenha
 *    o papel "Cloud Translation API User" (roles/cloudtranslate.user).
 *    Em muitos projetos o padrão já funciona após ativar a API.
 *
 * A chave de API do Google NÃO é necessária: o cliente @google-cloud/translate
 * usa Application Default Credentials no ambiente das Functions.
 */

const { onCall, HttpsError } = require("firebase-functions/v2/https");

const TITLE_MAX = 60;
const DESC_MAX = 500;
const DISC_MAX = 80;

function clip(s, max) {
  if (s == null || max <= 0) return "";
  const str = String(s);
  const arr = [...str];
  return arr.length <= max ? str : arr.slice(0, max).join("");
}

/**
 * @param {import("firebase-admin/firestore").Firestore} db
 */
function registerTranslateOffer(db) {
  return {
    translateOfferFields: onCall(
      {
        region: "southamerica-east1",
        timeoutSeconds: 120,
        memory: "512MiB"
      },
      async (request) => {
        if (!request.auth?.uid) {
          throw new HttpsError("unauthenticated", "Login necessário.");
        }
        const offerId = request.data?.offerId;
        if (!offerId || typeof offerId !== "string") {
          throw new HttpsError("invalid-argument", "offerId inválido.");
        }

        const ref = db.collection("offers").doc(offerId);
        const snap = await ref.get();
        if (!snap.exists) {
          throw new HttpsError("not-found", "Oferta não encontrada.");
        }
        const data = snap.data();
        if (data.ownerUid !== request.auth.uid) {
          throw new HttpsError("permission-denied", "Esta oferta não é sua.");
        }

        const title = String(data.title ?? "").trim();
        const description = String(data.description ?? "").trim();
        const discount = String(data.discount ?? "").trim();

        if (!title && !description && !discount) {
          return { ok: true, skipped: true };
        }

        let Translate;
        try {
          ({ Translate } = require("@google-cloud/translate").v2);
        } catch (e) {
          console.error("translateOfferFields: pacote @google-cloud/translate", e);
          return { ok: false, code: "TRANSLATE_MODULE" };
        }

        const translate = new Translate();

        /** Placeholder mínimo para a API aceitar strings “vazias” no batch. */
        const pad = (s) => (s && String(s).trim() ? String(s) : "\u200b");

        try {
          const batch = [pad(title), pad(description), pad(discount)];
          const [enArr] = await translate.translate(batch, "en");
          const [esArr] = await translate.translate(batch, "es");
          const clean = (s) => String(s ?? "").replace(/\u200b/g, "").trim();

          await ref.update({
            titleEn: clip(clean(enArr[0]), TITLE_MAX),
            titleEs: clip(clean(esArr[0]), TITLE_MAX),
            descriptionEn: clip(clean(enArr[1]), DESC_MAX),
            descriptionEs: clip(clean(esArr[1]), DESC_MAX),
            discountEn: clip(clean(enArr[2]), DISC_MAX),
            discountEs: clip(clean(esArr[2]), DISC_MAX)
          });

          return { ok: true };
        } catch (err) {
          console.error("translateOfferFields", err);
          return {
            ok: false,
            code: "TRANSLATE_API",
            message: err.message || String(err)
          };
        }
      }
    )
  };
}

module.exports = { registerTranslateOffer };
