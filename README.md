# Playas e Ventajas

<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

Aplicação web progressiva (PWA) que conecta turistas a ofertas exclusivas em estabelecimentos locais (bares, restaurantes, hotéis, experiências) na Costa do Sol, Rio de Janeiro. Empresas cadastram ofertas; turistas geram cupons via QR Code para resgate presencial.

---

## Funcionalidades

### Para Turistas
- Visualização de ofertas com filtros por categoria (Bar, Restaurante, Experiência, Hospedagem, Outros)
- Quando o comerciante define limite de cupons (QR), o card da oferta mostra **quantos restam** e atualiza em **tempo real** (Firestore `onSnapshot`)
- Geração de cupom via QR Code (e-mail obrigatório no campo)
- Interface responsiva e multilíngue (PT, EN, ES)
- Mensagem de gamificação incentivando uso recorrente do mesmo e-mail

### Para Empresas (Área do Comerciante)
- Login e cadastro seguro
- Painel administrativo: criar, editar (vigência, limite de cupons, publicar/pausar) e excluir ofertas
- Upload de imagens (máx. 2MB): Firebase Storage em produção
- Definir validade, categorias e status (Ativo/Inativo)
- **Limite opcional de cupons (QR):** número inteiro mínimo **5**; ao atingir o limite, a oferta passa a **inativa** e **some da home** pública. Vazio = sem limite. A home usa `subscribePublicOffers` para o contador **restam X de Y** acompanhar novos pedidos (Firestore: `maxCoupons`, `couponsIssued`; ver `firestore.rules` e `README_DEPLOY.md`)
- **Base de clientes:** tabela detalhada por e-mail × oferta; **ranking por e-mail** prioriza quem mais **validou** cupons no estabelecimento; se ainda não houver nenhuma validação nos dados daquele comerciante, o ranking usa quem mais **gerou** cupons
- QR Scanner para validar cupons (câmera ou código manual)

---

## Rodar Localmente

**Pré-requisitos:** Node.js 18+

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`. Sem as credenciais Firebase, o app roda em **modo demo** com dados mock em memória (sem ofertas/cupons pré-carregados).

---

## Configurar Produção (Firebase)

Para usar o banco real, crie `.env.local` na raiz com:

```env
REACT_APP_FIREBASE_API_KEY=sua_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=seu_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=seu_projeto.appspot.com
REACT_APP_FIREBASE_SENDER_ID=123456789
REACT_APP_FIREBASE_APP_ID=1:123456789:web:abcdef
```

### Segurança do `.env.local` (importante)
- **Nunca** versionar/commitar `.env.local` (este projeto já ignora `*.local` no `.gitignore`).
- Não cole o conteúdo do `.env.local` em README, issues, prints ou mensagens públicas.
- As chaves do `firebaseConfig` (apiKey/authDomain/etc.) não são “segredos” no frontend, mas ainda assim devem ficar no `.env.local` por organização.
- Segredos reais (ex.: credenciais de provedor de e-mail para Cloud Functions) devem ficar **somente** no backend/Secrets do provedor, nunca no frontend.

Guia detalhado: [README_DEPLOY.md](README_DEPLOY.md)

---

## Stack Técnico

- **Frontend:** React 19, TypeScript, Vite
- **Estilização:** Tailwind CSS 3
- **Backend:** Firebase (Auth, Firestore, Storage) com fallback mock
- **QR Code:** qrcode.react

---

## Estrutura do Banco (Firestore)

Um único projeto Firebase, três coleções:

| Coleção    | Descrição                                      |
|-----------|-------------------------------------------------|
| `companies` | Dados das empresas (uid, email, companyName, cnpj) |
| `offers`    | Ofertas (inclui `ownerUid`, título, desconto, imagem, validade, categorias, `isActive`; opcionalmente `maxCoupons` ≥ 5 e `couponsIssued` para limite de cupons) |
| `coupons`   | Cupons gerados (id, offerId, userEmail, status) |

---

## Testes (automatizado local)

| Data       | Comando / verificação |
|------------|------------------------|
| 2026-03-31 | `npm run build` concluído com sucesso (Vite + TypeScript). |

Testes manuais recomendados após alterar regras: `firebase deploy --only firestore:rules` e gerar cupons até o limite em oferta com `maxCoupons` definido.

---

## Changelog / Correções Aplicadas

### Ranking por e-mail no painel (2026-03-31)
- Ordenação do bloco **ranking por e-mail** prioriza **validações** (`USED`); se o comerciante ainda não tiver nenhuma validação nos cupons retornados, ordena por **mais cupons gerados**. Ver `buildEmailAggregatesFromCoupons` em `services/dataService.ts`.

### Limite de cupons por oferta (2026-03-31)
- **Painel:** campo opcional “Máximo de cupons (QR)” (mín. 5 se preenchido; vazio = ilimitado).
- **Firestore:** `maxCoupons`, `couponsIssued`; geração com transação quando há limite; ao esgotar, `isActive: false` (some da query pública).
- **Regras:** `offers` permite `update` sem login apenas para incremento atômico de `couponsIssued` + `isActive` quando a oferta já tem `maxCoupons` (≥ 5). Publicar regras atualizadas no deploy.
- **Turista:** se esgotado, modal exibe mensagem (`COUPON_SOLD_OUT`).
- **Código:** `services/dataService.ts` (`generateCoupon`, `createOffer`, `updateOffer`, `countCouponsForOffer`), `App.tsx` (AdminPanel + CouponModal), `types.ts`, `src/translations.ts`, `firestore.rules`, `README_DEPLOY.md` (bloco de regras espelhado).
- **Docs:** `GUIA_SIMPLES_CLIENTE.md` (lista de campos da oferta); relatório técnico: ver secção sugerida abaixo em [RELATORIO_TECNICO_CLIENTE.md](RELATORIO_TECNICO_CLIENTE.md).

### Segurança
- Removida injeção desnecessária de `GEMINI_API_KEY` no bundle (não usada no projeto)
- Variáveis Firebase passadas corretamente via `vite.config.ts` para funcionar em produção
- **Ofertas com dono (`ownerUid`):** painel do comerciante só lista ofertas do usuário logado; home pública usa apenas ofertas ativas; uploads no Storage por pasta `offers/{uid}/`
- **Validação de cupom no Firestore:** comerciante autenticado pode marcar cupom como usado (regras no `README_DEPLOY.md`)
- **URLs de imagem:** função `safeImageUrl` para reduzir risco de URLs maliciosas em `<img>`
- **Hosting:** cabeçalhos `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` em `firebase.json`
- **Regras Firebase versionadas:** `firestore.rules` e `storage.rules` na raiz; publicar com `firebase deploy --only firestore:rules,storage` (veja `README_DEPLOY.md`)

### CSS e Build
- Tailwind instalado como dependência (antes via CDN, inadequado para produção)
- Removida referência quebrada a `index.css`
- Tema customizado (cores `sea` e `sand`) migrado para `tailwind.config.js`

### Funcionalidades
- **Botão de lixeira (excluir oferta):** Corrigido layout que impedia cliques em alguns navegadores
- **Mensagem de gamificação:** Texto curto no modal do cupom incentivando uso do mesmo e-mail (PT, EN, ES)

### Validações
- Ofertas: criação com todos os campos; **edição** no painel limitada a datas de vigência, limite de cupons (QR), publicar/pausar (demais campos fixos após criar; ver `updateOffer` em `dataService.ts`)

---

## Scripts

| Comando       | Descrição            |
|---------------|----------------------|
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Build para produção   |
| `npm run preview` | Preview do build      |
| `npm run deploy:playas` | Build + deploy só no Firebase **`playas-e-ventajas`** (regras + hosting); requer `firebase login` com conta do projeto |

---

## Documentação Adicional

- [README_DEPLOY.md](README_DEPLOY.md): Guia de deploy Firebase
- [README_DOSSIE.md](README_DOSSIE.md): Dossiê técnico detalhado
- [RELATORIO_TECNICO_CLIENTE.md](RELATORIO_TECNICO_CLIENTE.md): Status tecnico, testes e seguranca do MVP
- [GUIA_SIMPLES_CLIENTE.md](GUIA_SIMPLES_CLIENTE.md): Manual simples para cliente e equipe

---

© 2026 Playas e Ventajas. Desenvolvido por [Konzup](https://konzup.com).
