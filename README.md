# Playas e Ventajas — MVP

Aplicação web (React + Vite) para vitrine pública de ofertas, geração de cupom com QR e área do comerciante (login, ofertas, validação de cupom). **Firebase** em produção (Auth, Firestore, Storage) com regras versionadas no repositório.

---

## Stack

| Camada | Tecnologia |
|--------|------------|
| **Front** | React 19, TypeScript, Vite 6, Tailwind CSS 3 |
| **Dados / auth** | Firebase (Firestore, Authentication, Storage) |
| **QR** | `qrcode.react`, leitura com `jsqr` no scanner |

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
| `npm run deploy:playas` | Build + `firebase deploy` (Hosting + regras Firestore + Storage) no projeto `playas-e-ventajas` |

Deploy exige **Firebase CLI** (`npm i -g firebase-tools`) e permissão no projeto.

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
| `functions/` | Cloud Functions (se habilitadas no projeto) |

---

## Segurança

- Não commitar `.env.local`, secrets ou `serviceAccountKey.json`.
- Chaves `REACT_APP_*` no front são públicas por natureza; segredos de backend ficam só no GCP/Firebase/Secrets.

---

## Licença / uso

Uso interno do produto; ajustar conforme política da equipe.
