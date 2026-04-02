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
  imageUrl: string;
  validFrom?: string;
  validUntil: string;
  merchantName: string;
  discount: string;
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
  lastCouponAt: number;
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