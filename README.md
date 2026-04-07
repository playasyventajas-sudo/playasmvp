# Playas e Ventajas — MVP

Aplicação web (React + Vite) para vitrine pública de ofertas, geração de cupom com QR e área do comerciante (login, ofertas, validação de cupom). **Firebase** em produção (Auth, Firestore, Storage) com regras versionadas no repositório.

**Código-fonte:** [github.com/playasyventajas-sudo/playasmvp](https://github.com/playasyventajas-sudo/playasmvp) (`origin` / branch `main`).

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
- **Selo “Poucos cupons”** no card: só quando ainda restam de **2 a 5** cupons **e** `restantes < máximo` (estoque cheio, ex. 5/5, não exibe selo). **“Último cupom”** quando resta **1**.

### Cupom na página pública (visitante)

- **Um cupom por e-mail por oferta** (dedupe em `couponLocks` + transação). Trocar o idioma da interface (PT/EN/ES) **não** apaga um cupom já gerado; um segundo pedido com o mesmo e-mail na mesma oferta retorna “já reivindicado”.
- **E-mail** é normalizado com `trim` + **minúsculas** antes de gravar lock/cupom (`normalizeCouponEmail` em `dataService.ts`).
- **Regras Firestore (`offers`)**: update anônimo que incrementa `couponsIssued` tolera formatos legados de `maxCoupons` / `couponsIssued` como **inteiro**, **float inteiro** (ex. `5.0`) e **string numérica** (ex. `"5"`). Isso elimina `permission-denied` intermitente entre ofertas antigas e novas sem mudar a regra de negócio do último cupom.
- **Cálculo de `isActive` na transação**: ao incrementar `couponsIssued`, o cliente usa **`maxCoupons` lido do snapshot da oferta** (`mc`) no objeto passado a `computePersistedIsActiveFromOffer`, não só o normalizado — assim o último cupom grava `isActive: false` quando bate o limite e evita `permission-denied` no `Commit` se a normalização não trouxer `maxCoupons`.
- **Payload do documento `coupons`**: `offerTitle` e `discount` são sempre **strings** (vazio se preciso); o SDK omite campos `undefined` e a regra exige as chaves presentes.

### Verificação recente (cupom + idiomas)

- **2026-04-07**: paridade de chaves PT/EN/ES em `src/translations.ts` (**238** caminhos folha por idioma, script com `tsx`); smoke manual na home em produção (`playas-e-ventajas.web.app`): troca de idioma **PT → EN → ES** com textos da navbar e hero corretos em cada um.
- **Histórico**: bateria anterior **18/18** (6 ofertas ativas × 3 idiomas), cupons com e-mails fictícios únicos.
- Comportamento esperado: visitante pode resgatar até o último cupom; ao atingir o limite, a oferta é inativada (`isActive: false`).

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

## Playbook de diagnóstico (rápido)

Use quando algo falhar em produção ou após editar ofertas no Console.

1. **`permission-denied` ao gerar cupom**  
   - No **Firestore** → documento `offers/{id}`: confira `maxCoupons` e `couponsIssued` (tipo e valor). Devem ser números coerentes; se estiverem como texto estranho ou inconsistentes, alinhe no Console ou rode `npm run recompute:isactive` (ajusta `isActive` conforme regra do app).  
   - No **navegador** (F12 → Console): anote o código completo do `FirebaseError` (ex.: `permission-denied` na coleção `offers`, `coupons` ou `couponLocks`).

2. **Cupom “já reivindicado” sem ter usado**  
   - É esperado se o **mesmo e-mail** (após normalização em minúsculas) já gerou cupom nessa oferta. Teste com **outro e-mail** ou outra oferta.  
   - Se suspeitar de lock órfão: em `couponLocks`, existe documento cujo id corresponde à oferta + e-mail (dedupe atômico).

3. **Oferta errada na vitrine** (some cedo, não some quando esgotou, contador estranho)  
   - Rode `npm run recompute:isactive` para alinhar `isActive` no Firestore com vigência + limite de cupons.  
   - Confira no doc: `validUntil`, `validFrom`, `publishIntent`, `maxCoupons`, `couponsIssued`.

4. **Deploy**  
   - Após mudar regras ou front que afete visitantes: `npm run deploy:playas` na raiz do repositório.

---

## Segurança

- Não commitar `.env.local`, secrets ou `serviceAccountKey.json`.
- Chaves `REACT_APP_*` no front são públicas por natureza; segredos de backend ficam só no GCP/Firebase/Secrets.

---

## Licença / uso

Uso interno do produto; ajustar conforme política da equipe.
