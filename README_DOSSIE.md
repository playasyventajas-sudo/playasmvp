# 📁 Dossiê do Projeto: Playas e Ventajas

## 1. Visão Geral
**Playas e Ventajas** é uma Aplicação Web Progressiva (PWA) desenvolvida para conectar turistas a ofertas e experiências exclusivas na Costa do Sol, Rio de Janeiro. O sistema permite que empresas locais cadastrem ofertas e que turistas gerem cupons via QR Code para validação presencial.

**Status Atual:** Pronto para Deploy (Produção).
**Banco de Dados:** Híbrido (Mock Local para desenvolvimento / Firebase para produção).

## 2. Arquitetura Técnica
- **Frontend:** React 18, TypeScript, Vite.
- **Estilização:** Tailwind CSS (Design responsivo, Mobile-First).
- **Ícones:** Lucide React.
- **Gerenciamento de Estado:** React Hooks (useState, useEffect).
- **Rotas:** Navegação condicional simples (SPA) sem react-router (para simplicidade do MVP).

## 3. Funcionalidades Detalhadas

### A. Para o Turista (Público Final)
- **Home:**
  - Listagem de ofertas com fotos reais.
  - **Filtros:** Por categoria (Bar, Restaurante, Experiência, Hospedagem, Outros) e visualização de "Todos".
  - **Filtro Automático:** Ofertas expiradas ou desativadas não aparecem.
- **Cupom:**
  - Modal para inserir e-mail.
  - Geração de QR Code único.
  - Status do cupom (Válido/Usado).

### B. Para a Empresa (Área Restrita)
- **Autenticação:** Login e Cadastro (integrado ao Firebase Auth).
- **Painel Administrativo:**
  - **CRUD de Ofertas:** Criar, Editar, Excluir.
  - **Upload de Imagem:** Input de arquivo (converte para Base64 no Mock / Upload real no Firebase Storage).
  - **Campos da Oferta:** Título, Desconto (texto livre), Descrição, Validade (De/Até), Categoria, Imagem, Status (Ativo/Inativo).
  - **Controle de Estoque:** Checkbox "Oferta Ativa" para pausar a oferta sem excluir.
- **Scanner:**
  - Leitor de QR Code via câmera do dispositivo.
  - Validação instantânea do cupom.
  - Opção de digitar código manual.

## 4. Estrutura de Dados (Firebase Firestore)

### Coleção `companies` (Empresas)
- `uid`: ID do usuário.
- `companyName`: Nome da empresa.
- `email`: E-mail de login.
- `cnpj`: Documento.

### Coleção `offers` (Ofertas)
- `id`: ID único.
- `merchantName`: Nome da empresa (denormalizado).
- `title`: Título da oferta.
- `description`: Detalhes.
- `discount`: Texto do desconto (ex: "2 por 1").
- `validFrom`: Data início (ISO string).
- `validUntil`: Data fim (ISO string).
- `imageUrl`: URL da imagem (Storage).
- `isActive`: Boolean (controle manual).
- `categories`: Array de strings (ex: ['bar', 'restaurant']).

### Coleção `coupons` (Cupons)
- `id`: Código único.
- `offerId`: ID da oferta vinculada.
- `userEmail`: E-mail do turista.
- `status`: 'VALID' | 'USED'.
- `createdAt`: Timestamp.

## 5. Guia de Deploy (Firebase)

### Pré-requisitos
1. Conta no Google/Firebase.
2. Node.js instalado.

### Passo a Passo
1. **Criar Projeto:** No [Firebase Console](https://console.firebase.google.com), crie um projeto novo.
2. **Habilitar Serviços:**
   - **Authentication:** Ativar provedor "Email/Password".
   - **Firestore:** Criar banco de dados (modo produção).
   - **Storage:** Criar bucket para imagens.
3. **Configurar Ambiente:**
   - Copie as chaves do Firebase (Configurações do Projeto > Geral > Web App).
   - Crie um arquivo `.env.local` na raiz (veja modelo abaixo).

### Prompt para Cursor (Deploy)
Copie o texto abaixo e cole no chat do Cursor para finalizar a configuração:

```markdown
Estou com o projeto "Playas e Ventajas", um PWA em React/Vite/TypeScript para descontos em praias.

O projeto já possui:
1. Front-end completo com Tailwind CSS.
2. Sistema de Ofertas (CRUD) com upload de imagem, categorias e status ativo/inativo.
3. Sistema de Cupons (Geração de QR Code e Validação).
4. Arquitetura preparada para Firebase (Auth, Firestore, Storage) com fallback para dados locais (Mock) se as chaves não existirem.

O código principal está em `App.tsx`, `services/dataService.ts` e `services/firebaseConfig.ts`.

**Minha necessidade agora:**
Quero fazer o deploy no Firebase Hosting e ativar o banco de dados real.

Por favor:
1. Analise o arquivo `firebaseConfig.ts` e me diga quais variáveis de ambiente preciso criar no meu arquivo `.env.local`.
2. Verifique se as regras de segurança do Firestore (firestore.rules) e Storage (storage.rules) precisam ser criadas ou configuradas.
3. Me guie no processo de build (`npm run build`) e deploy (`firebase deploy`).
4. (Opcional) Se eu quiser criar uma Cloud Function para enviar o QR Code por e-mail quando o usuário gera o cupom, me dê o código dessa função baseada na estrutura de dados atual (`coupons` collection).

O banco de dados deve armazenar:
- Usuários (Empresas)
- Ofertas (com campo `isActive`, `categories`, `imageUrl`)
- Cupons (com `status`, `userEmail`)

Não altere a lógica de UI atual, apenas me ajude com a infraestrutura e conexão final.
```
