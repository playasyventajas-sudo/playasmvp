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
- Depois de criar a oferta, o **texto do desconto** (ex.: % ou 2x1) **nao muda**. Evita confusao com quem ja viu a promocao; da para ajustar texto de apoio, foto, datas, pausar, limite de cupons conforme o sistema.
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
   - desconto
   - categoria
   - periodo de validade
   - imagem
   - (opcional) **maximo de cupons (QR)**: numero inteiro **no minimo 5**; ao esgotar, a oferta fica inativa e some da home publica. Em branco = sem limite.
5. Salvar.
6. Para editar ou excluir, usar os icones na tabela.
7. Abaixo da tabela de ofertas, conferir a **base de clientes** (e-mails que geraram cupom nas suas ofertas) e o **top consumidores** (ordenado por quantidade de cupons; os 3 primeiros em destaque). Os dados vêm dos cupons gravados no Firebase.

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
- **Esqueci a senha:** o envio do link e feito pelo **Firebase Authentication** (e-mail padrao do Google/Firebase). E preciso ter **E-mail/senha** ativado em Authentication e, para dominio proprio, o dominio do site listado em **Dominios autorizados**. Se o e-mail nao chegar, verificar pasta de spam e o modelo de e-mail em Authentication > Modelos.

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
