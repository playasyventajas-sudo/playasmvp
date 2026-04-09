# LEIA-ME — Guia para os donos do site (Playas e Ventajas)

Este texto é para **quem administra o negócio**, não para programadores. O site **não tem** uma área interna só para “donos da plataforma”: o painel que existe é o das **empresas parceiras** (restaurantes, hotéis, etc.). Por isso, para ver contas, dados de turistas em cupons ou apagar coisas com segurança, o caminho é o **painel do Google Firebase** ligado ao projeto.

**Projeto Firebase (produção):** `playas-e-ventajas`  

**Site público (exemplo):**  
https://playas-e-ventajas.web.app  

Se vocês usam domínio próprio (ex.: `playasyventajas.com`), é o mesmo sistema; só muda o endereço que o visitante digita.

---

## 1. Entrar no Firebase (passo a passo)

1. Abra o navegador (Chrome, Safari, etc.).
2. Entre com a **conta Google** que tem permissão de **dono** ou **administrador** neste projeto (quem criou o Firebase ou quem foi convidado).
3. Abra **esta página** (é a “capa” do projeto):

   **https://console.firebase.google.com/project/playas-e-ventajas/overview**

4. No menu à esquerda aparecem: **Authentication**, **Firestore Database**, **Storage**, **Hosting**, etc. É aí que vocês vão navegar conforme o que precisam fazer abaixo.

> **Importante:** não compartilhem a senha da conta Google de admin com qualquer pessoa. Quem tiver acesso pode alterar ou apagar dados de verdadeiros clientes.

---

## 2. Empresas parceiras (cadastro com e-mail e senha)

As empresas que se cadastram no site (login de comerciante) aparecem como **usuários** no Firebase, não como uma planilha separada.

**Onde ver e gerenciar contas de empresa**

**https://console.firebase.google.com/project/playas-e-ventajas/authentication/users**

- Aqui aparece a **lista de e-mails** que criaram conta (cada linha é um usuário).
- Vocês podem:
  - **Ver** o e-mail de login.
  - **Desativar** ou **apagar** um usuário (use com cuidado: a empresa perde acesso ao painel).
  - **Redefinir senha** pelo fluxo normal do site (“esqueci a senha”) ou pelas opções que o Firebase mostrar, conforme a política de segurança.

Isso é o que existe hoje para “cadastro de empresas” no nível **dono**: não há outra tela escondida só para vocês; é este **Authentication**.

---

## 3. Dados das empresas no banco (nome, CNPJ, etc.)

Além do login, o app pode guardar informações extras da empresa em uma coleção do banco de dados.

**Onde abrir o banco de dados (Firestore)**

**https://console.firebase.google.com/project/playas-e-ventajas/firestore/databases/-default-/data**

1. Clique em **Firestore Database** (ou use o link acima).
2. Abra a coleção **`companies`**.
3. Cada documento costuma ter o **mesmo ID** que o **User UID** do usuário em Authentication (é o identificador da conta).

Lá podem existir campos como nome da empresa, CNPJ, etc., conforme o cadastro.  
**Para apagar** o perfil da empresa no banco: selecionem o documento → opção de **eliminar** (só façam se tiverem certeza e, de preferência, depois de apagar ou desativar o usuário em Authentication, se for o caso).

---

## 4. Ofertas, cupons e e-mails de turistas

Tudo isso fica no **mesmo Firestore** (link da seção anterior).

### Ofertas (promoções na vitrine)

- Coleção: **`offers`**
- Cada documento é uma oferta (título, datas, cidade, limite de cupons, imagem, etc.).

**Para editar ou apagar uma oferta:** entrem em **`offers`**, abram o documento e usem **editar** ou **apagar**.  
Apagar aqui remove a oferta da vitrine; **não apaga sozinha** as imagens antigas no Storage (veja a seção 6).

### Cupons gerados pelos turistas

- Coleção: **`coupons`**
- Em cada cupom há, entre outros, o campo **`userEmail`**: é o **e-mail que o turista digitou** na hora de gerar o cupom.
- Há também vínculo com a oferta (`offerId`) e com a empresa (`merchantUid`).

**Para consultar ou apagar dados de turistas** (por exemplo, pedido de LGPD): localizem o documento pelo e-mail ou pelo ID do cupom e **apaguem** ou **anonimizem** conforme orientação jurídica.

### Bloqueio “um cupom por e-mail por oferta”

- Coleção: **`couponLocks`**
- Serve para o sistema não deixar a mesma pessoa pedir dois cupons na **mesma** oferta com o **mesmo** e-mail.

Se algo “travar” estranho após um teste, às vezes apagar o lock correspondente resolve — mas só quem entende o risco deve fazer isso.

### Fila de e-mail (se existir extensão ligada)

- Coleção: **`mail`**
- Só é usada se houver extensão de envio de e-mail configurada. Na prática, muitos ambientes não usam isso no dia a dia.

---

## 5. Onde o site está hospedado (Hosting)

**https://console.firebase.google.com/project/playas-e-ventajas/hosting/sites**

Aqui vocês veem **qual versão** do site está no ar e os domínios.  
Não é necessário mexer aqui para cadastro de empresas ou turistas; é mais para quem cuida de publicação técnica.

---

## 6. Imagens das ofertas (Storage)

Quando uma empresa envia foto da promoção, o arquivo vai para o **Storage** (armazenamento de arquivos).

**https://console.firebase.google.com/project/playas-e-ventajas/storage**

- Naveguem pelas pastas e vejam os arquivos.
- **Apagar uma oferta no Firestore não remove automaticamente** a imagem antiga: se quiserem limpar espaço ou dados, podem apagar manualmente o arquivo correspondente **se souberem** qual é (cuidado para não apagar pasta errada).

---

## 7. Funções na nuvem e Google Cloud (só para contexto)

Algumas tarefas automáticas (por exemplo, tradução de textos de ofertas) rodam como **Cloud Functions** no mesmo projeto Google.

**Firebase (lista de funções):**  
**https://console.firebase.google.com/project/playas-e-ventajas/functions**

**Google Cloud Console (mesmo projeto, visão geral):**  
**https://console.cloud.google.com/home/dashboard?project=playas-e-ventajas**

O dia a dia dos donos **não precisa** entrar no Cloud para gerir cadastros. Isso é mais para suporte técnico ou faturamento do Google.

---

## 8. Resumo rápido “onde está cada coisa”

| O que vocês querem | Onde clicar no Firebase |
|--------------------|-------------------------|
| Lista de **contas** (e-mail/senha) das empresas | **Authentication → Users** — **https://console.firebase.google.com/project/playas-e-ventajas/authentication/users** |
| **Dados extras** da empresa (nome, CNPJ, etc.) | **Firestore → `companies`** — abrir pelo link do Firestore acima |
| **Ofertas** na vitrine | **Firestore → `offers`** |
| **Cupons** e **e-mail do turista** (`userEmail`) | **Firestore → `coupons`** |
| Bloqueio 1 e-mail / 1 oferta | **Firestore → `couponLocks`** |
| **Fotos** das promoções | **Storage** — **https://console.firebase.google.com/project/playas-e-ventajas/storage** |
| Ver o **site** publicado / domínios | **Hosting** — **https://console.firebase.google.com/project/playas-e-ventajas/hosting/sites** |

---

## 9. Cuidados finais (bem importantes)

- **Backup:** antes de apagar muita coisa em produção, conversem com quem cuida do projeto sobre **cópia de segurança** ou exportação.
- **LGPD:** e-mails e dados em `coupons` são dados pessoais; apaguem ou tratem conforme a lei e o que combinarem com o jurídico.
- **Sem área “dono” no site:** tudo que este guia descreve é o jeito correto hoje para administrar pelo **Firebase**; o painel do site continua sendo o das **empresas parceiras**, não um “backoffice” separado para vocês.

**Entrada principal do projeto no Firebase (guardem este link):**  
**https://console.firebase.google.com/project/playas-e-ventajas/overview**
