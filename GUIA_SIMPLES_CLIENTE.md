# Guia Simples - Como usar o Playas e Ventajas

Este guia e para quem nao e tecnico.  
Objetivo: explicar, do zero, como usar o sistema no dia a dia.

---

## 0) Para o dono do sistema: o que explicar a outros

Use este bloco para explicar **em uma conversa** para **seus parceiros (empresas)** e para **o publico final**, sem precisar de detalhe tecnico.

**Para o visitante (quem gera cupom no site):**
- Cada **e-mail** pode gerar **um cupom por oferta**. Pode usar o **mesmo e-mail** em **outras** ofertas, mas nao pode ficar gerando dezenas de cupons na **mesma** promocao.
- O cupom vale para **uma pessoa** nessa promocao (um uso por e-mail). Se forem **duas ou mais pessoas**, cada uma pode gerar o seu com um **e-mail diferente**, no respeito as regras do local (nao e automaticamente "cupom para casal").
- E **obrigatorio** informar um e-mail no campo para gerar o QR; use um e-mail valido para controle no estabelecimento.
- O **QR na tela** e o que vale no balcao; regras completas de dados pessoais estao nos **Termos** e **Privacidade** no rodape (LGPD). Reclamacoes sobre o site ou dados: **playasyventajas@gmail.com**.

**Para a empresa (parceiro):**
- No painel aparecem **e-mail + oferta** de quem pediu cupom, para operacao (nao substitui contrato nem obrigacao com o cliente).
- Depois de criar a oferta, **titulo, descricao, imagem, categorias e texto da promocao** (percentual, preco de/por ou frase tipo 2x1) **nao podem ser alterados**; so **datas de vigencia**, **limite de cupons** (ou remover o limite) e **publicar ou pausar** podem mudar. Isso mantem a mesma promessa para quem ja gerou cupom.
- **Datas de inicio e fim** sao obrigatorias e o fim nao pode ser antes do inicio.

**Pagina "Como funciona":** e **publica** (todo mundo le, comerciante ou turista) para todos entenderem o mesmo fluxo.

---

## 1) O que e o Playas e Ventajas

E um sistema de ofertas com QR Code:
- **Publico/Turista**: ve ofertas e gera cupom com e-mail.
- **Empresa**: entra na area privada para cadastrar e gerenciar ofertas.

---

## 2) Como o turista usa

1. Abrir o site publico.
2. Escolher uma oferta.
3. Se a oferta tiver **limite de cupons**, a pagina pode mostrar **quantos ainda restam** (atualiza quando alguem gera um cupom).
4. Clicar em **Gerar Cupom**.
5. Informar e-mail (um cupom por e-mail **por oferta**; o mesmo e-mail pode usar em outras ofertas).
6. O sistema mostra um **QR Code** na tela.
7. No estabelecimento, a equipe da empresa valida o codigo.

Importante (MVP):
- O e-mail do turista fica registrado no Firebase na colecao **`coupons`** (controle do cupom).
- O **QR Code na tela** e o que vale para usar no estabelecimento; isso **esta** no MVP.
- **Nao esta incluido no escopo do MVP** a entrega automatica do cupom **na caixa de entrada** de e-mail. Isso fica para uma **segunda fase** (veja secao abaixo). O app pode **preparar** a fila (colecao `mail`), mas **enviar** e-mail de verdade exige configuracao extra no Firebase e um provedor de e-mail. Nao e so "ligar o site".

---

## 2b) Segunda fase (apos o MVP): e-mail do cupom na caixa de entrada

**O que nao entra no MVP e por que**

- O **navegador** nao pode enviar e-mail sozinho de forma segura.
- O produto usa uma **fila** no Firebase (`mail`) para o futuro envio; quem **dispara** o e-mail e uma **extensao** (Trigger Email) + **SMTP** (servidor de e-mail), configurados no **Console**, nao no codigo do site.
- Isso costuma exigir projeto Firebase em modo **Blaze** (cobranca por uso do Google Cloud, com cartao cadastrado) e um pouco de trabalho de configuracao. Por isso fica **fora do MVP** para o produto nao depender disso no dia 1.

**Estimativa de custo (ordem de grandeza, trafego baixo de MVP)**

- **Firebase Blaze:** muitas vezes **centavos a poucos dolares por mes** com poucos cupons/dia (funcoes Cloud + leituras Firestore da extensao); depende do uso real.
- **SMTP:** muitos provedores tem **camada gratuita** ou custo baixo (ex.: centenas de e-mails/mes no free tier de alguns servicos). Ou seja: o custo fixo costuma ser **baixo**; o que muda e o **tempo** de configurar e testar.

**Passo a passo (quando for ativar na segunda fase)**

1. No [Console Firebase](https://console.firebase.google.com), abra o projeto **`playas-e-ventajas`**.
2. Confirme que o projeto pode usar **Blaze** (faturamento) se a extensao exigir; leia o aviso de valores antes de confirmar.
3. Va em **Extensoes** → **Instalar extensao** → pesquise **Trigger Email** (extensao oficial).
4. Na instalacao, configure:
   - **Coleção de origem:** `mail` (e o nome que o app usa para enfileirar).
   - **SMTP:** URI fornecida pelo seu provedor de e-mail (ex.: Zoho, Gmail com senha de app, SendGrid, etc.).
5. Confira as **regras do Firestore** publicadas (o repositorio ja inclui regras para `mail`; ver `README_DEPLOY.md` ou `firestore.rules`).
6. Faça um teste: gere um cupom no site com um e-mail real e verifique se chegou (e a pasta de **spam**).

**Resumo:** no MVP o turista usa o **QR na tela**; na **segunda fase** voce ativa a **entrega por e-mail** seguindo os passos acima.

---

## 3) Como a empresa usa

1. Entrar na aba/area da empresa.
2. Fazer login.
3. Clicar em **Adicionar oferta**.
4. Preencher:
   - titulo
   - descricao
   - **tipo de promocao** (ao criar): **percentual** (so numeros; o site coloca o % sozinho), **de um preco por outro** em reais (dois campos so com numeros), ou **outra** (texto curto, ex. 2 por 1)
   - categoria
   - periodo de validade
   - imagem
   - (opcional) **maximo de cupons (QR)**: numero inteiro **no minimo 5**; ao esgotar, a oferta fica inativa e some da home publica. Em branco = sem limite.
5. Salvar.
6. Para editar ou excluir, usar os icones na tabela.
7. Abaixo da tabela de ofertas: **ranking por e-mail** (uma linha por e-mail: ofertas distintas, validados no local, último cupom; o topo **prioriza quem mais validou** cupom no scanner ou código; **se ainda não houver nenhuma validação** no seu estabelecimento, a ordem é **quem mais gerou** cupom; os 3 primeiros em destaque) e **detalhe por e-mail e oferta** (por combinação e-mail + oferta: cupons gerados, validados e data; ordenado por quantidade de cupons gerados naquela linha). Os dados vêm dos cupons no Firebase.

### Limites de caracteres (para a lista nao ficar poluida)

O sistema limita o tamanho dos textos, no estilo de sites de ofertas (titulos curtos, descricao legivel no celular):

| Campo | Maximo aproximado |
|--------|-------------------|
| Titulo da oferta | 60 caracteres |
| Descricao | 500 caracteres |
| Texto da promocao no modo livre (“outros”, ex. 2x1) | 25 caracteres |
| Percentual e “De R$ … por …” | formatados pelo sistema (ate 80 caracteres gravados) |
| Nome do estabelecimento (cadastro e perfil) | 80 caracteres |

No formulario aparece um **contador** (ex.: 12/60 no titulo). O site tambem aplica o limite ao salvar, mesmo se alguem tentasse contornar o navegador.

### Limite de cupons (QR) — regras ao editar

- **Opcional:** em branco = **sem limite** de cupons gerados.
- Se voce **preencher** o limite, o numero minimo e **5**.
- O painel mostra quantos cupons **ja foram emitidos** e quantos **faltam** (quando ha limite).
- **Se a quantidade ja emitida for igual ou maior que o maximo** que voce definiu, a oferta fica **inativa** e **some da pagina publica** (atingiu o teto).
- **Exemplo:** estavam **10 emitidos de 30** e voce **edita o maximo para 10**: como ja ha 10 emitidos, o sistema entende que o limite foi alcancado → oferta **inativa** na home.
- **Se a oferta estava esgotada** (emitidos = maximo) e voce **sobe** o maximo para **acima** do numero ja emitido, pode **voltar a publicar** na mesma tela de edicao (marcando publicar).
- **Remover o limite** (deixar o campo em branco na edicao) tira o teto de cupons (comportamento descrito no proprio formulario).

### Esqueci a senha — o que acontece (nao e dentro deste site)

1. Na tela de login, use o link **Esqueceu a senha** (ou texto parecido).
2. Informe o **mesmo e-mail** do cadastro da empresa.
3. O **Firebase Authentication (Google)** envia um e-mail com um **link**. O remetente pode ser um endereco **noreply** do Firebase ou do Google — **verifique spam/lixo eletronico**.
4. Ao clicar no link, abre uma pagina **segura em outro endereco** (dominio Google/Firebase), **nao** a pagina do Playas e Ventajas. E nessa pagina que voce **define a nova senha** e confirma.
5. Se o e-mail nao chegar: confira se o e-mail esta certo, espere alguns minutos, veja spam, e no Console Firebase em **Authentication** se o metodo **E-mail/senha** esta ativo e se o dominio do site esta em **Dominios autorizados** (ajuste feito pela equipe tecnica).

**Nota:** A equipe de desenvolvimento **nao consegue ver** sua senha nem “testar o seu e-mail” por voce; o teste real e: pedir o reset com um e-mail que voce controla e abrir a caixa de entrada.

### Apagar ofertas de teste ([TESTE] / QA) — o app nao deixa apagar oferta de outra conta

Ofertas criadas por script de teste costumam ter titulo com **[TESTE]** ou nome do comerciante **QA Playas (demo)**. Pelo **painel da empresa** so da para **excluir as proprias** ofertas; ofertas de **outro usuario** no mesmo projeto Firebase nao aparecem no seu painel nem podem ser apagadas pelo site.

**Quem administra o projeto** pode remover esses dados de uma destas formas:

1. **Console Firebase → Firestore:** abrir a colecao `offers`, localizar documentos com **[TESTE]** no titulo (ou comerciante QA), **excluir** um a um. Depois, na colecao `coupons`, apagar cupons orfaos se necessario (ou pedir a equipe).
2. **Script com conta de servico (equipe tecnica):** na pasta do projeto, com chave JSON de servico e variavel `GOOGLE_APPLICATION_CREDENTIALS`, rodar `npm run cleanup:qa` — isso apaga ofertas que batem a regra [TESTE] / QA Playas, mais cupons e travas (`couponLocks`) ligados a esses IDs.

Se voce nao for administrador do Google Cloud/Firebase do projeto, peca a quem implantou o site para executar a limpeza ou usar o Console.

### Home publica x area interna (multiempresa)

- A **home** e **uma so para todo mundo**: lista todas as ofertas **ativas** cadastradas por **todas** as empresas (como um catalogo publico).
- A **area da empresa** e **individual**: ao fazer login, cada dono ve **somente** as proprias ofertas e o **scanner** para validar cupom.
- Se voce e dona do **Bar Teste222**, suas ofertas aparecem na home **junto** com as de outros parceiros; ja o painel e o scanner sao **so seus**.
- Ao **sair** (logout), a home **nao muda** e **nao some** oferta de ninguem: o que some e so o acesso ao painel daquela sessao.
- Cada novo cadastro de empresa cria um usuario separado no Firebase; **nao ha limite fixo no codigo** de quantas empresas podem se cadastrar. Na pratica, o limite vem do **plano e cotas do Firebase** (Auth, Firestore, Storage, trafego). Para volumes muito altos, a equipe tecnica monitora uso e escala.

Importante sobre multiempresa:
- Cada empresa acessa apenas as proprias ofertas no painel.
- Cada imagem enviada fica na pasta da propria empresa no Storage (`offers/{ownerUid}/...`).
- Ou seja: cada cliente cadastra e publica suas ofertas manualmente pelo proprio login.

### Cadastro da empresa e e-mail

- Ao cadastrar, os dados da empresa (nome, CNPJ, **e-mail de login**) sao gravados no Firestore na colecao **`companies`**, com documento identificado pelo **mesmo ID** do usuario no Firebase Auth.
- No login seguinte, o sistema le esse cadastro para mostrar o nome da empresa no painel.
- **Esqueci a senha:** resumo rapido acima na secao **Esqueci a senha**; detalhes tecnicos de dominio autorizado ficam com a equipe no Firebase Console.

---

## 3a) Onde ler as mesmas regras no site (turista e empresa)

- **Como funciona** (menu do site): texto publico para visitante e comerciante, alinhado a este guia.
- **Termos de uso** e **Politica de privacidade** (rodape): incluem regras de cupom, limites de texto e limite de cupons do ponto de vista juridico, redefinicao de senha via Google/Firebase, e contato **playasyventajas@gmail.com**.

---

## 3b) O que e MVP e o que e fase 2 (resumo)

| Onde | MVP (incluido) | Segunda fase (nao obrigatorio no lancamento) |
|------|----------------|-----------------------------------------------|
| Cupom + QR na tela | Sim | - |
| Dados em `coupons` | Sim | - |
| E-mail do cupom **na caixa de entrada** | Nao (fora do escopo) | Sim, com Trigger Email + SMTP + Blaze |

---

## 4) Como validar cupom no estabelecimento

1. Entrar na area de empresa.
2. Abrir a parte de scanner/validacao.
3. **Por camera:** tocar para abrir a camera, apontar para o QR do cliente (leitura automatica). Funciona melhor em **HTTPS** e com permissao de camera (tipico no celular).
4. **Manual:** digitar o codigo do cupom (o mesmo ID exibido junto ao QR) e verificar.
5. O sistema informa se o cupom esta valido ou ja usado.

---

## 5) Painel Firebase (passo a passo simples)

### 5.1 Entrar
1. Acesse: https://console.firebase.google.com
2. Entre com a conta do projeto.
3. Abra o projeto: **`playas-e-ventajas`**.

### 5.2 Onde ficam os dados
- **Firestore Database**:
  - `offers` (ofertas)
  - `coupons` (cupons)
  - `companies` (cadastro da empresa: nome, CNPJ, e-mail, datas de criacao/atualizacao quando aplicavel)
  - `mail` (fila **reservada para a fase 2**; envio real so depois de extensao + SMTP; ver secao 2b)
- **Storage**:
  - pasta `offers/` com as imagens das promocoes

Observacao sobre dados de exemplo:
- Ofertas e imagens de QA/demo servem apenas para apresentacao.
- Esses dados podem ser apagados depois sem problema.
- No uso real, as ofertas finais sao criadas pelas empresas no proprio sistema.

### 5.3 Publicar atualizacoes do site
No terminal, dentro da pasta do projeto:
```bash
npm run deploy:playas
```

---

## 6) HostGator (DNS) - onde mexer quando der problema de dominio

1. Entrar no painel da HostGator.
2. Abrir **Dominios** > **Zona DNS** do `playasyventajas.com`.
3. Conferir registros:
   - `A` do dominio raiz para Firebase
   - `CNAME` do `www` para o valor que o Firebase mostrar
4. Salvar.
5. Voltar ao Firebase Hosting e clicar em **Verificar**.

---

## 7) Google Cloud - para que serve no projeto

O Firebase roda em cima do Google Cloud:
- hospeda o site;
- guarda dados (Firestore);
- guarda imagens (Storage).

Para o dia a dia, normalmente a equipe usa mais o Firebase Console.  
Google Cloud e usado mais para administracao de permissoes e servicos avancados.

---

## 8) O que esta funcionando hoje

- Site publico com ofertas
- Area da empresa com cadastro/edicao/exclusao
- Upload de imagem
- Geracao de QR Code
- Validacao basica de cupom
- Dominio com SSL (apex e `www`, quando conectados)

---

## 9) O que ainda e evolucao (proxima fase)

- **Entrega do cupom por e-mail na caixa de entrada**: **nao faz parte do MVP**; passo a passo na secao **2b** (Trigger Email + SMTP + Blaze; estimativa de custo la).
- Regras extras antifraude/rate limit
- Relatorios de uso mais avancados

---

## 10) Checklist rapido para funcionarios

Todos os dias:
- [ ] Entrar na area da empresa e conferir ofertas ativas
- [ ] Validar cupons no caixa/atendimento
- [ ] Corrigir oferta vencida/inativa quando necessario

Quando cadastrar nova promocao:
- [ ] Colocar titulo claro
- [ ] Definir validade correta
- [ ] Subir imagem
- [ ] Testar geracao de cupom no site publico
