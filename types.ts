import React from 'react';

export enum UserRole {
  TOURIST = 'TOURIST',
  MERCHANT = 'MERCHANT',
  ADMIN = 'ADMIN'
}

export type Category = 'bar' | 'restaurant' | 'experience' | 'lodging' | 'other';

export interface Offer {
  id: string;
  title: string;
  description: string;
  /** Traduções opcionais; se vazio, a UI usa `title` / `description` / `discount` (PT). */
  titleEn?: string;
  titleEs?: string;
  descriptionEn?: string;
  descriptionEs?: string;
  discountEn?: string;
  discountEs?: string;
  imageUrl: string;
  validFrom?: string;
  validUntil: string;
  merchantName: string;
  discount: string;
  /** Intenção do comerciante: publicar quando a vigência permitir (pausar = false). */
  publishIntent: boolean;
  /** Efetivo para vitrine/cupom: vigência + pausa + limite de cupons. */
  isActive: boolean;
  categories: Category[];
  /** UID Firebase Auth do comerciante dono da oferta (obrigatório em novos documentos) */
  ownerUid?: string;
  /** Limite máximo de cupons (QR) gerados; opcional = sem limite. Se definido, mínimo 5 na UI. */
  maxCoupons?: number;
  /** Contador atual de cupons emitidos (atualizado na geração; não editar pelo painel) */
  couponsIssued?: number;
}

export interface Coupon {
  id: string;
  offerId: string;
  offerTitle: string;
  discount: string;
  userEmail: string;
  createdAt: number;
  status: 'VALID' | 'USED' | 'EXPIRED';
  /** UID do comerciante dono da oferta (para base de clientes e estatísticas) */
  merchantUid?: string;
}

/** Agregado por e-mail + oferta para o painel do comerciante */
export interface ConsumerStat {
  email: string;
  offerId: string;
  offerTitle: string;
  couponCount: number;
  /** Cupons com status USED (validados no estabelecimento) neste par e-mail + oferta */
  validatedCount: number;
  lastCouponAt: number;
}

/** Agregado por e-mail (todas as ofertas do comerciante) para ranking no painel */
export interface ConsumerEmailAggregate {
  email: string;
  /** Quantas ofertas distintas da empresa geraram ao menos um cupom para este e-mail */
  distinctOfferCount: number;
  /** Total de documentos de cupom (gerados) para este e-mail neste comerciante */
  claimedCouponCount: number;
  /** Total de cupons validados (USED) deste e-mail nas ofertas deste comerciante */
  validatedCouponCount: number;
  lastCouponAt: number;
}

/** Base de clientes: detalhe por oferta + ranking por e-mail */
export interface MerchantConsumerDashboard {
  byOffer: ConsumerStat[];
  byEmail: ConsumerEmailAggregate[];
}

export interface CompanyUser {
  uid: string;
  email: string;
  companyName: string;
  cnpj: string;
}

export interface NavItem {
  label: string;
  path: string;
  role?: UserRole;
  icon?: React.ReactNode;
}