# Diagnóstico: `permission-denied` em cupom

Guia operacional (sem lógica especial por título de oferta — “Alpinismo” é só exemplo de oferta no Firestore).

## 1. Identificar o fluxo (visitante vs scanner)

| Onde falhou | Coleção / operação típica no log de rede (F12 → Rede) |
|-------------|--------------------------------------------------------|
| **Pegar cupom** (página pública, anônimo) | `Commit` ou batch envolvendo `offers`, `coupons`, `couponLocks` |
| **Validar** (scanner / comerciante logado) | `GET` ou `PATCH` em `.../documents/coupons/{id}` |

- Se aparecer escrita em **`offers`** no mesmo request que cupom: a oferta tem **limite** (`maxCoupons` ≥ 5) e o problema costuma ser a **regra de update anônimo** em `offers`.
- Se só **`coupons`** / **`couponLocks`**: sem limite na oferta ou falha no **create** do documento do cupom.

## 2. Inspecionar dados (Console ou script)

**Firebase Console → Firestore**

- Oferta: `offers/{id}` — conferir `ownerUid`, `maxCoupons`, `couponsIssued`, `isActive`, `validUntil`, `publishIntent`.
- Cupom (scanner): `coupons/{id}` — `merchantUid` deve ser igual ao `auth.uid` do login do comerciante e a `offers.ownerUid` da mesma oferta.

**Script somente leitura** (mesmo token do `firebase login` que os outros scripts):

```bash
TITLE_SUBSTRING="Alpinismo" npm run diagnose:offer
```

Imprime os campos acima e uma amostra de cupons com `offerId` igual à oferta encontrada.

## 3. Se `isActive` estiver defasado

Quando vigência ou estoque não batem com o boolean gravado, alinhar com:

```bash
DRY_RUN=1 npm run recompute:isactive
```

Revisar saída; sem `DRY_RUN` aplica correção (ver [README](../README.md)).

## Referência de regras

Arquivo [`firestore.rules`](../firestore.rules): `offers` update anônimo, `coupons` create/get/update.

## Resultado de referência (execução do script em produção)

Com `TITLE_SUBSTRING=Alpinismo`, a oferta **“Alpinismo em Buzios”** apresentou limite ativo (`maxCoupons` ≥ 5), `couponsIssued` coerente, `ownerUid` preenchido e cupons amostrados com `merchantUid` **igual** ao `ownerUid`. `DRY_RUN=1 npm run recompute:isactive` não encontrou divergência de `isActive` na coleção na mesma execução.

Se `permission-denied` continuar, capture no navegador se a falha é no **Commit** (gerar) ou em **get/patch** em `coupons` (scanner) e compare com a tabela da seção 1.
