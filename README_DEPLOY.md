# Playas e Ventajas - Guia de Deploy no Firebase

## 1. Resumo do Projeto
O **Playas e Ventajas** é uma aplicação web progressiva (PWA) desenvolvida para conectar turistas a ofertas exclusivas em estabelecimentos locais (bares, restaurantes, hotéis, experiências) na região da Costa do Sol, Rio de Janeiro.

### Funcionalidades Principais:
- **Para Turistas:**
  - Visualização de ofertas com filtros por categoria (Bar, Restaurante, etc).
  - Geração de cupom via QR Code (requer apenas e-mail).
  - Interface responsiva e multilíngue (PT, EN, ES).
- **Para Empresas (Área do Comerciante):**
  - Login/Cadastro seguro.
  - Painel Administrativo para criar, editar e excluir ofertas.
  - Upload de imagens reais das ofertas.
  - Definição de validade e status (Ativo/Inativo).
  - **QR Scanner:** Leitor de QR Code integrado para validar cupons dos turistas.

## 2. Tecnologias Utilizadas
- **Frontend:** React 19, TypeScript, Vite.
- **Estilização:** Tailwind CSS (com animações e design responsivo).
- **Ícones:** Lucide React (via componentes SVG otimizados).
- **Backend (Híbrido):**
  - **Modo Demo:** Dados locais (mock) sem Firebase; por padrão **sem ofertas/cupons de exemplo** no código.
  - **Modo Produção:** Integração completa com **Firebase** (Auth, Firestore, Storage).

## 3. Estrutura de Arquivos Importantes
- `App.tsx`: Componente principal contendo a lógica de navegação e os sub-componentes (Navbar, OfferCard, AdminPanel, MerchantPanel).
- `services/dataService.ts`: Camada de abstração de dados. Gerencia a troca automática entre Mock e Firebase.
- `services/firebaseConfig.ts`: Configuração da conexão com o Firebase.
- `services/authService.ts`: Gerenciamento de autenticação (Login, Logout, Observer).
- `src/translations.ts`: Arquivo central de internacionalização (i18n).

---

## 4. Guia de Deploy no Firebase (Para Cursor/Windsurf)

### Projeto GCP / Firebase (único deste produto)

| Item | Valor |
|------|--------|
| **ID do projeto Firebase / GCP** | `playas-e-ventajas` |

**Regra obrigatoria:** Este projeto deve operar exclusivamente no GCP/Firebase `playas-e-ventajas`.

- O arquivo **`.firebaserc`** na raiz já fixa o projeto padrão como **`playas-e-ventajas`**.
- O **`.env.local`** deve usar `REACT_APP_FIREBASE_PROJECT_ID=playas-e-ventajas` e as demais chaves **desse mesmo app** no Console (não misturar com outros projetos ou organizações).
- **Nada neste repositório** publica deploy em outro ID de projeto. Se o `firebase deploy` falhar por permissão, **nada** é enviado para lugar nenhum (incluindo outros projetos da sua conta Google).
- Para subir de fato: use `firebase login` com a **conta Google que é membro do projeto `playas-e-ventajas`** no Google Cloud (ex.: time Gustavo/Playas). Quem administra o GCP pode adicionar o e-mail do desenvolvedor em **IAM** do projeto com papel suficiente (ex.: **Editor** ou **Firebase Admin**). Custo do MVP no Spark/Blaze conforme uso já combinado; não há deploy “duplo” para outro cloud por este código.

**Script recomendado (sempre aponta para `playas-e-ventajas`):**

```bash
npm run deploy:playas
```

(Exige `firebase login` com conta autorizada e `firebase-tools` instalado.)

---

### Passo 1: Criar Projeto no Firebase
1. Acesse [console.firebase.google.com](https://console.firebase.google.com).
2. Crie um novo projeto "PlayasVentajas".
3. Desative o Google Analytics (para simplificar).

### Passo 2: Habilitar Serviços
1. **Authentication:**
   - Vá em "Criação" > "Authentication" > "Sign-in method".
   - Ative "E-mail/Senha".
2. **Firestore Database:**
   - Vá em "Criação" > "Firestore Database".
   - Crie um banco de dados em modo de teste (ou produção com regras apropriadas).
3. **Storage:**
   - Vá em "Criação" > "Storage".
   - Crie um bucket para armazenar as imagens das ofertas.

### Passo 3: Obter Credenciais
1. Vá em "Configurações do Projeto" (ícone de engrenagem).
2. Em "Seus aplicativos", clique no ícone web (`</>`).
3. Registre o app e copie as configurações do `firebaseConfig`.

### Passo 4: Configurar Regras de Segurança

**Fonte da verdade no repositório:** os arquivos **`firestore.rules`** e **`storage.rules`** na raiz do projeto. Eles são implantados com `firebase deploy` (veja Passo 6). Você pode copiar o mesmo conteúdo manualmente no Console se preferir.

O app grava em cada oferta o campo **`ownerUid`** (UID do Firebase Auth do comerciante). A home pública só consulta ofertas com **`isActive == true`**.

**Coleção `couponLocks`:** usada para garantir **no máximo um cupom por combinação (oferta + e-mail)** na geração do cupom, em conjunto com a gravação em `coupons`. As regras atuais estão sempre no arquivo **`firestore.rules`** da raiz. Ao publicar, use esse arquivo (não copie regras antigas de um guia desatualizado).

**Migração:** ofertas criadas antes desta lógica podem não ter `ownerUid`. No Firestore (Console → dados), edite cada documento em `offers` e adicione `ownerUid` com o UID correto do usuário em Authentication, ou exclua/recadastre a oferta.

**Firestore Rules:** cole na aba **Regras** do Firestore e clique em **Publicar**:
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /offers/{offerId} {
      // Público: só ofertas ativas. Dono: lê todas as suas (ativas ou não).
      allow read: if resource.data.isActive == true
        || (request.auth != null && resource.data.ownerUid == request.auth.uid);
      allow create: if request.auth != null
        && request.resource.data.ownerUid == request.auth.uid
        && (!request.resource.data.keys().hasAny(['maxCoupons'])
            || (request.resource.data.maxCoupons is int
                && request.resource.data.maxCoupons >= 5
                && request.resource.data.couponsIssued == 0));
      allow update: if (request.auth != null && resource.data.ownerUid == request.auth.uid)
        || (request.auth == null
            && resource.data.keys().hasAny(['maxCoupons'])
            && resource.data.maxCoupons is int
            && resource.data.maxCoupons >= 5
            && (resource.data.keys().hasAny(['couponsIssued'])
                ? resource.data.couponsIssued
                : 0) < resource.data.maxCoupons
            && request.resource.data.diff(resource.data).affectedKeys().hasOnly(['couponsIssued', 'isActive'])
            && request.resource.data.couponsIssued
                == (resource.data.keys().hasAny(['couponsIssued'])
                    ? resource.data.couponsIssued
                    : 0) + 1
            && request.resource.data.maxCoupons == resource.data.maxCoupons
            && request.resource.data.ownerUid == resource.data.ownerUid
            && request.resource.data.isActive
                == (request.resource.data.couponsIssued < request.resource.data.maxCoupons));
      allow delete: if request.auth != null
        && resource.data.ownerUid == request.auth.uid;
    }
    match /coupons/{couponId} {
      allow create: if request.resource.data.keys().hasAll(
          ['offerId','offerTitle','discount','userEmail','createdAt','status','merchantUid'])
        && request.resource.data.status == 'VALID'
        && request.resource.data.userEmail is string
        && request.resource.data.offerId is string
        && request.resource.data.createdAt is number
        && request.resource.data.merchantUid is string;
      allow read: if request.auth != null;
      allow update: if request.auth != null
        && resource.data.status == 'VALID'
        && request.resource.data.status == 'USED';
    }
    match /companies/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /mail/{mailId} {
      allow create: if request.resource.data.keys().hasAll(['to', 'message'])
        && request.resource.data.to is list
        && request.resource.data.message is map
        && request.resource.data.message.keys().hasAll(['subject', 'html'])
        && request.resource.data.message.subject is string
        && request.resource.data.message.html is string;
      allow read, update, delete: if false;
    }
  }
}
```

**Observação (privacidade):** qualquer usuário autenticado ainda pode **ler** todos os cupons com essas regras (útil para o scanner no MVP). Para restringir leitura de e-mails apenas ao backend, use **Cloud Functions** e regras mais restritivas (`allow read: if false` em `coupons`).

**Storage Rules:** iguais ao arquivo **`storage.rules`** (upload atual em `offers/{uid}/...`; arquivos antigos em `offers/arquivo` permanecem só leitura).

### Passo 4b: Envio de e-mail do cupom (segunda fase, não incluído no escopo do MVP)

O app grava um documento na coleção **`mail`** após gerar o cupom (fila). **A entrega na caixa de entrada não faz parte do MVP**; fica para quando o time ativar esta **fase 2** (ver também `GUIA_SIMPLES_CLIENTE.md` seção 2b e `RELATORIO_TECNICO_CLIENTE.md` seção 10).

Para o e-mail sair de fato, instale a extensão oficial **Trigger Email** (usa Cloud Functions; no plano **Blaze** a cobrança costuma ficar em centavos para baixo volume).

1. Firebase Console → **Extensões** → **Instalar extensão** → pesquise **Trigger Email**.
2. Configure:
   - **Coleção:** `mail`
   - **SMTP:** URI do seu provedor (ex.: Zoho, Gmail com senha de app, SendGrid free tier, etc.)
3. Após instalar, gere um cupom no site com um e-mail real e confira a caixa de entrada (e spam).

### Passo 5: Configurar Variáveis de Ambiente
Crie um arquivo `.env.local` na raiz do projeto com as credenciais copiadas no Passo 3:

```env
REACT_APP_FIREBASE_API_KEY=sua_api_key
REACT_APP_FIREBASE_AUTH_DOMAIN=seu_projeto.firebaseapp.com
REACT_APP_FIREBASE_PROJECT_ID=seu_project_id
REACT_APP_FIREBASE_STORAGE_BUCKET=seu_bucket.appspot.com
REACT_APP_FIREBASE_SENDER_ID=seu_sender_id
REACT_APP_FIREBASE_APP_ID=seu_app_id
```

### Imagens de demonstração (`public/promo-qa/`)

Três PNGs (restaurante, hotel, surf) ficam em **`public/promo-qa/`** e são servidos pelo Hosting em  
`https://playas-e-ventajas.web.app/promo-qa/nome-do-arquivo.png` (ajuste o domínio se usar custom domain).

- Para **atualizar ofertas QA já existentes** no Firestore (mesmos IDs de demo), faça deploy do site e rode com o **e-mail/senha do dono** das ofertas:  
  `QA_LOGIN_EMAIL=... QA_LOGIN_PASSWORD='...' npm run update:qa-images`
- Para **criar um usuário novo + 3 ofertas [TESTE]** com essas URLs:  
  `QA_SEED_EMAIL=... QA_SEED_PASSWORD='...' npm run seed:qa`  
  (ofertas antigas com imagem verde podem ser removidas no Console se ficarem duplicadas.)

### Passo 6: Deploy
No terminal do seu editor (Cursor/VS Code), na pasta do projeto:

1. Instale as ferramentas (se ainda não tiver): `npm install -g firebase-tools`
2. Entre com a **mesma conta Google** que é dona do projeto no Firebase: `firebase login`
3. Build e deploy de **regras + site** (recomendado):
   ```bash
   npm run build
   firebase deploy --only firestore:rules,storage,hosting --project playas-e-ventajas
   ```
   Isso publica `firestore.rules`, `storage.rules` e a pasta `dist` no Hosting.

Se o projeto ainda não tiver Hosting inicializado no `firebase.json`, use `firebase init` uma vez e escolha Hosting, Firestore e Storage; este repositório já traz `firebase.json` e `.firebaserc` configurados.

### Limpeza do Firestore antes da entrega ao cliente

O app **não** permite que um usuário apague ofertas ou cupons de outras contas (regras de segurança). Para deixar só os dados da conta que vai ficar com o projeto:

1. **Console do Firebase:** Firestore → revise `offers`, `coupons` e `couponLocks` e exclua manualmente o que for de teste ou de outro dono.
2. **Script local (conta de serviço):** com uma chave JSON de serviço e a variável `KEEP_OWNER_UID` (UID em Authentication da conta a manter), rode `npm run cleanup:firestore`. Detalhes e dry-run estão em `scripts/firestore-delete-non-owner.mjs`. Não versione a chave; `serviceAccountKey.json` na raiz está no `.gitignore`.
3. **Só ofertas de teste `[TESTE]` / `QA Playas (demo)`:** `npm run cleanup:qa` (mesma credencial; apaga ofertas/cupons/locks de demonstração — veja `scripts/delete-qa-test-data.mjs`). Use `DRY_RUN=1` antes para listar.

---

## 5. Domínio personalizado, `www` e erro de certificado (`ERR_CERT_COMMON_NAME_INVALID`)

Esse aviso do Chrome (**“Sua conexão não é particular”** + `net::ERR_CERT_COMMON_NAME_INVALID`) em `https://www.seudominio.com` quase sempre significa: o certificado SSL entregue **não inclui o hostname `www`** que você está acessando (ou o `www` ainda aponta para outro servidor).

**O que fazer (Firebase Hosting):**

1. Abra [Firebase Console](https://console.firebase.google.com) → **Hosting** → **Domínios personalizados**.
2. Confirme que **dois** domínios estão adicionados e com status **Conectado** / certificado ativo:
   - `seudominio.com` (raiz)
   - `www.seudominio.com`
3. Se `www` **não** estiver na lista, clique em **Adicionar domínio** e siga o assistente para `www.seudominio.com`.
4. No provedor DNS (HostGator etc.), para o `www` use o registro que o Firebase mostrar (em geral **CNAME** `www` → `ghs.googlehosted.com` ou o valor indicado na tela; copie exatamente).
5. Aguarde a propagação DNS e o provisionamento do SSL (pode levar de minutos a algumas horas).
6. Evite acessar o site pelo IP direto; use sempre o domínio após o DNS estar correto.

Se o apex (`playasyventajas.com`) funciona com cadeado verde mas o `www` não, o passo 2–4 costuma resolver.

**Sem redirecionamento (o que você configurou agora):** no Hosting você pode deixar **nem o apex nem o www** como “redirecionar para o outro”. Nesse modo, **`playasyventajas.com` e `www.playasyventajas.com` são dois hostnames independentes**. Os dois precisam estar na lista de domínios personalizados como **Conectados**, cada um com DNS correto e SSL emitido. O site abre igual nos dois; não há redirecionamento automático entre eles (evita loops e simplifica testes de certificado).

**Se o seu print mostra só `playasyventajas.com` com “Redirecionamento → www…” mas não aparece uma linha separada para `www.playasyventajas.com`:** o hostname `www` **ainda não está** tratado como domínio conectado ao Hosting com certificado próprio. Faça assim:

1. Clique em **Adicionar domínio personalizado** (ou equivalente).
2. Digite exatamente **`www.playasyventajas.com`** e conclua o assistente (registros DNS que o Firebase pedir).
3. Só encerre quando `www.playasyventajas.com` aparecer na lista com status **Conectado** (não apenas como texto de redirecionamento embaixo do apex).
4. Se usar **Cloudflare** na frente do domínio: modo SSL **Full (strict)**; evite certificado “flexível” só até o Cloudflare enquanto o Firebase espera HTTPS direto. Desative proxy laranja temporariamente para testar, se o SSL do Firebase não completar.

---

## 6. Prompt para Cursor (Copie e cole isso no chat do Cursor)

```markdown
Estou com o código fonte do projeto "Playas e Ventajas", uma PWA React/Vite para gestão de cupons de desconto.

O projeto já está estruturado para funcionar com Firebase (Auth, Firestore, Storage) ou com dados Mock se as chaves não estiverem presentes.

Minha tarefa agora é configurar o ambiente de produção.
1. O arquivo `services/firebaseConfig.ts` já lê as variáveis de ambiente `REACT_APP_FIREBASE_*`.
2. Preciso que você me ajude a verificar se o arquivo `.env` está configurado corretamente com minhas credenciais do Firebase.
3. Se eu fornecer as credenciais do Firebase Console, por favor, gere o arquivo `.env` para mim.
4. Em seguida, execute o build (`npm run build`) e me oriente no processo de `firebase deploy` para colocar o site no ar.

O código está pronto; confira regras do Firestore/Storage e domínios no Hosting conforme README_DEPLOY.md.
```

---

## 7. Checklist para finalizar o escopo (MVP)

| Item | Status |
|------|--------|
| Regras Firestore/Storage versionadas (`firestore.rules`, `storage.rules`) + `firebase deploy` | Pendente na sua máquina após `firebase login` |
| Ofertas antigas no Firestore com campo **`ownerUid`** (ou recriar ofertas pelo painel) | Verificar no Console |
| Domínio **`www.playasyventajas.com`** **Conectado** + DNS (CNAME `www`) | Ver seção 5 |
| Domínio **`playasyventajas.com`** (apex) **Conectado** + DNS (registros A/TXT que o Firebase pedir) | Idem |
| Redirecionamento apex → `www` (ou o contrário) | **Opcional** (SEO). Se você **desligou** o redirecionamento, mantenha os **dois** hostnames conectados e válidos. |
| Build + deploy do front após mudanças | `npm run build` + `firebase deploy --only hosting` (ou junto com as regras) |

**Nota:** o assistente no Cursor **não** acessa sua conta Google. Para publicar regras e o site, rode `firebase login` e `firebase deploy` **no seu computador** (terminal local).
