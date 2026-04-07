# Playas e Ventajas — MVP

Aplicação web (React + Vite) para vitrine pública de ofertas, geração de cupom com QR e área do comerciante (login, ofertas, validação de cupom). **Firebase** em produção (Auth, Firestore, Storage) com regras versionadas no repositório.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| **Front** | React 19, TypeScript, Vite 6, Tailwind CSS 3 |
| **Dados / auth** | Firebase (Firestore, Authentication, Storage) |
| **QR** | `qrcode.react`, leitura com `jsqr` no scanner |
| **Tradução ofertas** | Cloud Function `translateOfferFields` + Google Cloud Translation (chave só no GCP, nunca no front) |

---

## Pré-requisitos

- **Node.js** 18+
- **npm** (ou compatível)
- Conta com acesso ao projeto Firebase abaixo **para deploy** (`firebase login`)

---

## Configuração local

```bash
npm install
```

Crie **`.env.local`** na raiz (não commitar — já ignorado por `*.local`):

```env
REACT_APP_FIREBASE_API_KEY=
REACT_APP_FIREBASE_AUTH_DOMAIN=
REACT_APP_FIREBASE_PROJECT_ID=
REACT_APP_FIREBASE_STORAGE_BUCKET=
REACT_APP_FIREBASE_SENDER_ID=
REACT_APP_FIREBASE_APP_ID=
```

Valores em **Firebase Console** → Configurações do projeto → Seu app Web.  
Sem `.env.local`, o app usa **modo demo** (mock em memória, sem dados reais).

---

## Cloud / Firebase (produção)

| Item | Valor |
|------|--------|
| **ID do projeto (GCP / Firebase)** | `playas-e-ventajas` |
| **Arquivo de projeto** | `.firebaserc` (default `playas-e-ventajas`) |
| **Hosting (exemplo)** | `https://playas-e-ventajas.web.app` |
| **Domínio customizado** | conforme configurado no Hosting (ex.: `playasyventajas.com`) |

**Regras e deploy:** `firestore.rules`, `storage.rules` e `firebase.json` na raiz são a fonte da verdade; publicam com o script de deploy.

**Coleções Firestore usadas pelo app:** `offers`, `coupons`, `couponLocks`, `companies`, `mail` (fila de e-mail, se extensão/trigger configurada).

**Storage:** imagens de ofertas (upload pelo painel).

---

## Comandos úteis

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Servidor de desenvolvimento (porta 3000) |
| `npm run build` | Build de produção → pasta `dist/` |
| `npm run deploy:playas` | Build + `firebase deploy` (Hosting, regras Firestore/Storage e **Cloud Functions**) no projeto `playas-e-ventajas` |
| `npm run deploy:push` | `deploy:playas` + `git push` para o remote `origin` ([playasyventajas-sudo/playasmvp](https://github.com/playasyventajas-sudo/playasmvp), branch `main`) |

Deploy exige **Firebase CLI** (`npm i -g firebase-tools`) e permissão no projeto. Plano **Blaze** pode ser necessário para Functions com APIs Google.

### Vitrine pública (home)

- **`validUntil`**: ofertas com fim de vigência já passado não aparecem (data local `YYYY-MM-DD`).
- **`validFrom` futuro**: se a oferta começa amanhã, **só entra na lista no dia de início** (inclusive). O painel do comerciante continua enxergando a oferta como ativa até lá; cupom segue bloqueado até a data (`generateCoupon`).
- **Limite de cupons esgotado** e **pausa** (`publishIntent`): o filtro da home usa a mesma regra que o app usa para o estado efetivo (`computePersistedIsActiveFromOffer`), para não exibir card se os dados indicam esgotado/fora de vigência mesmo quando o campo `isActive` no Firestore estiver defasado. Ao emitir o último cupom, a transação grava `isActive: false`. Para alinhar documentos antigos: `npm run recompute:isactive`.

### Tradução automática EN/ES (ofertas)

- Ao **criar** uma oferta (textos em português), o app chama a callable **`translateOfferFields`** (região `southamerica-east1`), que grava `titleEn`, `titleEs`, `descriptionEn`, `descriptionEs`, `discountEn`, `discountEs` no Firestore.
- **Não há formulário de tradução manual** no painel; a vitrine usa esses campos quando o visitante escolhe EN ou ES na navbar, com fallback para PT se estiverem vazios.
- **Configuração GCP:** ative [Cloud Translation API](https://cloud.google.com/translate) no mesmo projeto do Firebase. A function usa credencial de serviço do runtime (ADC), sem `REACT_APP_*` de tradução. Detalhes em `functions/translateOffer.js`.
- Se a API falhar, a oferta continua em PT; o erro aparece no log da Function / console do navegador (`requestOfferAutoTranslation`).

---

## Estrutura relevante (raiz)

| Caminho | Função |
|---------|--------|
| `App.tsx` | UI principal (home, ofertas, modal, admin, scanner) |
| `services/dataService.ts` | Firestore / mock |
| `services/authService.ts` | Auth |
| `services/firebaseConfig.ts` | Config Firebase |
| `src/translations.ts` | i18n PT / EN / ES |
| `firestore.rules` / `storage.rules` | Segurança |
| `functions/` | Cloud Functions: `syncOfferLifecycle` (agendada) e `translateOfferFields` (tradução EN/ES) |

---

## Segurança

- Não commitar `.env.local`, secrets ou `serviceAccountKey.json`.
- Chaves `REACT_APP_*` no front são públicas por natureza; segredos de backend ficam só no GCP/Firebase/Secrets.

---

## Licença / uso

Uso interno do produto; ajustar conforme política da equipe.
