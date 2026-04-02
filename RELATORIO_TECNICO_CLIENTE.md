# Relatorio Tecnico - Playas e Ventajas (MVP)

Data: 2026-03-31  
Projeto Firebase/GCP: `playas-e-ventajas`

## 1) Objetivo do relatorio

Este documento registra o status real do MVP apos testes tecnicos de:
- deploy e infraestrutura (Hosting, Firestore, Storage);
- seguranca basica;
- fluxo de ofertas, cupons, QR Code e upload;
- dominio customizado e SSL.

## 2) Status geral

- **Aplicacao publicada e ativa** no Firebase Hosting.
- **Regras de seguranca publicadas** no Firestore e no Storage.
- **DNS do `www` corrigido** para Firebase (`CNAME` para `playas-e-ventajas.web.app`).
- **Certificado SSL do `www` validado** (SAN contem `www.playasyventajas.com`).
- **Fluxo principal do MVP funcional** (ofertas, cupom, QR, validacao, base de clientes).

### Escopo do MVP (explicito)

- **Incluido no MVP:** geracao de cupom, persistencia em `coupons`, QR na tela, validacao no estabelecimento, painel da empresa, fila `mail` **preparada no codigo** (documento criado quando possivel).
- **Nao incluido no MVP (segunda fase):** **entrega do e-mail do cupom na caixa de entrada** do turista. Motivo: exige **infraestrutura** no Google Cloud (extensao **Trigger Email**, **SMTP**, normalmente projeto **Blaze**), configuracao no Console e testes, fora do criterio de lancamento minimo viavel. Ver **secao 10** deste relatorio.

## 3) Evidencias tecnicas dos testes

### 3.1 Deploy

Executado com sucesso:
- `npm run deploy:playas`
- Incluiu: `hosting`, `firestore.rules`, `storage.rules`.

### 3.2 DNS e SSL

Validado:
- `www.playasyventajas.com` resolve para Firebase.
- certificado entregue para `www` com `CN/SAN` corretos.

### 3.3 Teste de integracao Firebase (Auth + Firestore + Storage)

Foi executado um teste de integracao direto no projeto com:
- criacao de usuario empresa de QA;
- criacao de documento em `companies`;
- upload de imagem no Storage em `offers/{uid}/...`;
- criacao de 3 ofertas de teste (`restaurant`, `lodging`, `experience`);
- criacao de cupom e validacao de status `VALID -> USED`.

IDs gerados no teste:
- Usuario QA (`uid`): `OFmEc8XDuwMnnbdDgGdm1Ca6wrX2`
- Ofertas teste:
  - `pxafSOxasfOrGrfvBB36`
  - `jdan8joQsoyRUENC6Qjq`
  - `gstJuuoDj90FnyzbXzTV`

Observacao: as ofertas foram intencionalmente criadas para validacao do MVP.

### 3.4 Imagens de demo em `public/promo-qa/` (Hosting)

- Tres PNGs (restaurante, hotel, surf) sao copiados para o build e servidos em  
  `https://playas-e-ventajas.web.app/promo-qa/` (sem custo extra alem do Hosting).
- **Novo seed automatizado** (`npm run seed:qa`): em 2026-03-31 foi criado usuario `qa.autoseed.1774979238@example.com` e ofertas com `[TESTE]` e `imageUrl` apontando para essas URLs publicas:
  - `ZI1j49UzSAiuj9UkOQ9T`, `6jErpVtvdz45bpC98DG4`, `RH2oJqu28Qd6FAW2P6ha`
- As ofertas antigas (IDs em 3.3) podem ainda exibir imagem antiga ate alguem com login do dono rodar `npm run update:qa-images` ou editar no Console.
- **Hosting** atualizado na mesma data com os arquivos em `dist/promo-qa/`.
- Esses registros de QA/demo **nao sao permanentes**: podem ser removidos quando o dono do site iniciar cadastro real.
- Fluxo definitivo do produto: cada empresa cria a propria conta e cadastra suas ofertas/imagens no proprio painel.

## 4) Como o sistema funciona hoje (resumo tecnico)

### Multi-tenant (home publica x painel)

- **Home:** consulta ofertas **publicas** (`isActive == true`) de **todas** as empresas; nao depende de login.
- **Painel / scanner:** autenticado; cada usuario so acessa ofertas com `ownerUid == uid` e valida cupons via leitura em `coupons`.
- **Logout** afeta apenas a sessao da empresa; **nao altera** dados publicos nem remove ofertas da home.

### Publico (turista)
- Le ofertas da colecao `offers` com `isActive == true`.
- Gera cupom com e-mail; registro salvo em `coupons` com **`merchantUid`** (dono da oferta) para estatisticas e base de clientes por empresa.
- QR mostrado no front representa o `coupon.id`.
- Apos criar o cupom, o cliente tenta enfileirar e-mail na colecao `mail` (HTML). **Entrega na caixa de entrada nao faz parte do MVP**; depende da fase 2 (**Trigger Email** + SMTP + Blaze). Ver secao 10.

### Empresa
- Login/cadastro via Firebase Auth.
- Cadastro grava documento em `companies/{uid}` com nome, CNPJ, e-mail e timestamps (`createdAt` / `updatedAt` em novos cadastros; e-mail sincronizado no login se mudar no Auth).
- CRUD de ofertas no painel.
- Cada oferta nova grava `ownerUid` (dono da oferta).
- Campo **`discount`** (string): texto unico exibido na vitrine e no cupom. No painel, ao **criar**, a UI oferece tres modos: percentual (entrada so com digitos; persiste como `N%`), par de precos em reais inteiros (persiste como `De R$ X por R$ Y` com formatacao pt-BR), ou texto livre (ex. 2x1). Limites: **titulo** ate **60** caracteres (`OFFER_TITLE_MAX`); texto livre da promocao (“outros”) ate **25** (`OFFER_DISCOUNT_DEAL_TEXT_MAX`); valor gravado em `discount` e truncado com teto **80** (`OFFER_DISCOUNT_MAX`) para caber formatacoes longas. Apos criar, o campo nao e editavel. Na exibicao publica, valores legados so numericos (`30`) sao normalizados para `30%`.
- Upload de imagem em Storage no caminho por dono:
  - `offers/{ownerUid}/{arquivo}`

### Recuperacao de senha
- Fluxo **Esqueci a senha** usa `sendPasswordResetEmail` do Firebase Auth (e-mail transacional do provedor Google/Firebase). Requer dominios autorizados e modelo ativo em Authentication.

### Scanner/validacao
- Entrada manual do ID do cupom.
- **Camera:** leitura de QR no cliente com biblioteca **jsQR** (frames do `getUserMedia`); ao detectar payload, chama a mesma validacao do modo manual.
- Validacao consulta cupom e marca status como `USED`. Opcionalmente rejeita se `merchantUid` do cupom nao for o do comerciante logado (cupom de outro estabelecimento).

### Base de clientes / top consumidores
- Uma leitura de `coupons` com `where('merchantUid', '==', uid)` alimenta dois blocos no painel (ate 50 linhas cada): (1) **ranking por e-mail**: por e-mail, conta ofertas distintas, total de cupons gerados, total com `status == USED` (validados no scanner ou codigo manual) e ultima data. **Ordenacao:** se existir **pelo menos um** cupom `USED` entre os cupons desse comerciante, ordena primeiro por **mais validados**, desempate por mais cupons gerados, depois ofertas distintas e data; **se ainda nao houver nenhuma validacao** nesse conjunto, ordena por **mais cupons gerados**, depois ofertas distintas. (2) **detalhe por e-mail e oferta**: contagens por par, incluindo quantos `USED` naquela oferta; ordenacao por quantidade de cupons gerados naquele par. Destaque visual para os 3 primeiros em cada tabela.

### Limite opcional de cupons por oferta (QR), 2026-04-01
- **Painel:** campo opcional **maximo de cupons (QR)**; se preenchido, valor inteiro **minimo 5**; vazio = sem limite.
- **Modelo de dados:** em `offers`, campos opcionais `maxCoupons` e `couponsIssued` (contador). Quando `maxCoupons` esta definido, a geracao de cupom usa **transacao** Firestore: incrementa `couponsIssued`, e se atingir o limite define `isActive: false` (a oferta **some da home** publica, que filtra `isActive == true`).
- **Turista:** se o limite for atingido entre leituras, o cliente recebe erro `COUPON_SOLD_OUT` e mensagem no modal.
- **Regras Firestore:** alem do CRUD pelo dono, existe `update` **sem login** permitido apenas para o incremento atomico de `couponsIssued` (e desativacao quando esgota) em ofertas que ja possuem `maxCoupons`; ver `firestore.rules` e `README_DEPLOY.md`. **Deploy:** publicar regras atualizadas apos alteracao.

### Limites de escala
- **Nao ha limite de empresas imposto pelo codigo.** Limites praticos: cotas e precificacao do Firebase (Auth, Firestore, Storage, Hosting, extensao de e-mail). Monitorar uso em producao.

## 5) Regras de seguranca aplicadas

### Firestore
- `offers`: leitura publica apenas ativa; dono le/edita/deleta as proprias; **update anonimo** restrito ao fluxo de incremento de `couponsIssued` / desativacao quando existe `maxCoupons` (geracao de cupom com limite).
- `companies`: leitura/escrita apenas pelo proprio `uid`.
- `coupons`: criacao validada por schema minimo; **leitura e update** apenas se `resource.data.merchantUid == request.auth.uid` (cupom pertence ao comerciante logado), evitando que um parceiro liste ou valide cupons de outro ou varra e-mails de clientes.
- `mail`: fila para envio de e-mail do cupom (create permitido com `to` + `message.subject/html`; leitura bloqueada ao cliente). Entrega real depende da extensao **Trigger Email** + SMTP no Console.

### Storage
- Escrita de imagem restrita ao dono da pasta (`ownerUid`).
- Arquivos legados em `offers/{arquivo}` ficaram somente leitura para nao quebrar links antigos.

## 6) Analise de riscos (cyber seguranca)

### Riscos mitigados
- Controle de acesso por `ownerUid` nas ofertas.
- Upload segregado por usuario autenticado.
- Exposicao de segredos de servidor no frontend: nao encontrada no codigo atual.

### Riscos ainda existentes no MVP
1. **Cupons podem ser gerados em volume alto** (sem rate limit server-side nem App Check).
2. **E-mail do cupom na caixa de entrada:** fora do escopo do MVP; fila `mail` preparada no codigo; entrega real na **fase 2** (secao 10).

### Ajuste de seguranca (2026-04-02)
- **Leitura de `coupons`** restrita ao dono do cupom (`merchantUid`); **update** de validacao (`VALID` -> `USED`) tambem exige o mesmo. Antes, qualquer usuario autenticado podia, em tese, consultar a colecao de cupons de forma abusiva; regras atualizadas no `firestore.rules`.

## 7) Perguntas de negocio respondidas

### "QR Code tem limite?"
- **Por oferta (opcional):** a empresa pode definir **maximo de cupons (QR)** no painel (minimo 5 se preenchido); ao esgotar, a oferta fica inativa e some da home. **Sem preencher o campo = ilimitado** para aquela oferta.
- Limites praticos globais: cotas/plano do Firebase; antifraude server-side continua como melhoria futura (rate limit, App Check).

### "O e-mail do turista esta sendo enviado por e-mail?"
- **No MVP:** o turista usa o **QR na tela**; o e-mail fica em `coupons.userEmail` para controle e estatisticas.
- **Copia na caixa de entrada:** **nao** faz parte do MVP. O app pode gravar na fila **`mail`**; o **envio** exige **fase 2** (Trigger Email + SMTP + Blaze). Ver **secao 10**.
- **Esqueci a senha** (empresa) e outro fluxo: e-mail nativo do **Firebase Auth**, independente da colecao `mail`.

## 8) Recomendacoes de proxima fase (prioridade)

1. **Fase 2, entrega de e-mail do cupom:** instalar extensao **Trigger Email**, configurar **SMTP**, habilitar **Blaze** se necessario; testar ponta a ponta (ver secao 10 e `README_DEPLOY.md` Passo 4b). Opcional: Cloud Functions para logica extra.
2. Adicionar App Check + rate limit para geracao de cupom.
3. Criar painel de auditoria (uso de cupom por oferta e por periodo).

## 9) Checklist de aceite do MVP

- [x] Publicacao em `playas-e-ventajas` (Hosting/Firestore/Storage)
- [x] Dominio `www` com SSL valido
- [x] Dominio raiz conectado
- [x] CRUD de ofertas com segregacao por empresa
- [x] Upload de imagem no Storage
- [x] Geracao e validacao basica de cupom
- [x] Cupom + QR + dados em `coupons` (MVP entregue)
- [x] Limite opcional de cupons por oferta (painel, Firestore, regras; ver secao 4 e 5)
- [ ] **Fora do MVP:** entrega automatica do cupom **na caixa de entrada** (fase 2; fila `mail` + Trigger Email + SMTP; ver secao 10)

## 10) Fase 2 (pos-MVP): entrega do e-mail do cupom (por que nao entrou no MVP, custo e passos)

### Por que nao esta no MVP

- O frontend **nao envia** e-mail diretamente; ele grava dados e pode enfileirar em **`mail`**.
- A **entrega** exige processo em **background** (extensao **Trigger Email** lendo `mail` e chamando **SMTP**). Isso implica **Cloud Functions** (ou equivalente da extensao), projeto em **Blaze** na maioria dos casos, e **credenciais SMTP**: trabalho de **infra + Console**, nao so de publicar o site.

### Estimativa de custo (ordem de grandeza)

| Item | Observacao |
|------|------------|
| Firebase **Blaze** | Cobranca por uso (Cloud Functions invocadas pela extensao, etc.). Em trafego **baixo** de MVP, costuma ser **centavos a poucos USD/mes**; depende de volume e regiao. |
| **SMTP** | Muitos provedores tem **free tier** ou custo baixo para centenas/milhares de e-mails/mes. |
| Tempo de equipe | Configurar extensao, SMTP, testes e monitorar spam/dominio; motivo para separar da entrega do MVP. |

Valores exatos dependem do provedor SMTP e do uso; recomenda-se revisar a tabela de precos do Firebase/GCP no momento da ativacao.

### Passo a passo (quando for implementar a fase 2)

1. **Console Firebase** → projeto `playas-e-ventajas`.
2. Verificar requisitos da extensao **Trigger Email** (plano **Blaze** se solicitado).
3. **Extensoes** → instalar **Trigger Email** → coleção de origem: **`mail`**.
4. Configurar **SMTP** (URI fornecida pelo provedor: Zoho, SendGrid, Gmail com senha de app, etc.).
5. Garantir **regras Firestore** para `mail` publicadas (arquivo `firestore.rules` no repositorio).
6. Teste: gerar cupom no site com e-mail real; conferir inbox e **spam**.

Documentacao complementar no repositorio: **`README_DEPLOY.md`** (Passo 4b).
