import React, { useState, useEffect, useCallback, useRef, useId } from 'react';
import { FirebaseError } from 'firebase/app';
import { Offer, Coupon, UserRole, CompanyUser, Category, ConsumerStat, ConsumerEmailAggregate } from './types';
import { getPublicOffers, subscribePublicOffers, getMerchantOffers, getMerchantConsumerDashboard, createOffer, updateOffer, deleteOffer, generateCoupon, validateCoupon, uploadImage, countCouponsForOffer, getOfferCouponLimitInfo, requestOfferAutoTranslation, toCanonicalYmd, computePersistedIsActiveFromOffer, COUPON_SOLD_OUT, COUPON_ALREADY_CLAIMED, COUPON_INVALID_EMAIL, COUPON_OFFER_NOT_YET_VALID } from './services/dataService';
import type { OfferUpdateInput } from './services/dataService';
import { safeImageUrl } from './utils/safeUrl';
import { subscribeToAuthChanges, logoutCompany, updateCompanyDisplayName } from './services/authService';
import { QRCodeCanvas } from 'qrcode.react';
import { IconPalm, IconQrCode, IconCamera, IconMenu, IconTrash, IconInfo, IconFileText } from './components/Icons';
import { translations, Language } from './src/translations';
import {
  clipString,
  COMPANY_NAME_MAX,
  OFFER_DESCRIPTION_MAX,
  OFFER_DISCOUNT_DEAL_TEXT_MAX,
  OFFER_DISCOUNT_MAX,
  OFFER_TITLE_MAX
} from './src/offerLimits';
import {
  type PromoKind,
  buildDiscountFromPromo,
  clipPercentDigits,
  clipPriceReaisDigits,
  formatDiscountForDisplay
} from './src/offerPromo';
import { clipOfferI18nFields, offerDescription, offerDiscount, offerTitle } from './src/offerI18n';
import { LoginPanel } from './components/Auth';
import { isFirebaseConfigured } from './services/firebaseConfig';
import jsQR from 'jsqr';

/** Quantidade de linhas da base de clientes antes do “Ver mais”. */
const CUSTOMER_LIST_PREVIEW = 10;

const SS_VIEW = "playas_ev_view";
const SS_MERCHANT_TAB = "playas_ev_merchant_tab";

function localDateYmd(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Pausada pelo comerciante ou vigência já encerrada (data local). */
function isOfferArchived(offer: Offer): boolean {
  if (!offer.isActive) return true;
  const until = (offer.validUntil || '').trim();
  if (!until) return false;
  return until < localDateYmd();
}

// --- Sub-components defined here for single-file XML requirement simplicity, normally separated ---

// 1. Navbar
const Navbar = ({ setView, currentView, lang, setLang }: { setView: (v: string) => void, currentView: string, lang: Language, setLang: (l: Language) => void }) => {
  const t = translations[lang].nav;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
  <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-sea-100 relative">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16 items-center">
        <div className="flex items-center cursor-pointer" onClick={() => { setView('home'); setMobileMenuOpen(false); }}>
          <div className="p-2 bg-sea-500 rounded-lg text-white mr-2">
            <IconPalm />
          </div>
          <span className="font-bold text-xl text-sea-900 tracking-tight">{t.appName}</span>
        </div>
        <div className="hidden md:flex space-x-8 items-center">
          <button onClick={() => setView('home')} className={`${currentView === 'home' ? 'text-sea-600 font-semibold' : 'text-gray-500'} hover:text-sea-500`}>{t.offers}</button>
          <button onClick={() => setView('how-it-works')} className={`${currentView === 'how-it-works' ? 'text-sea-600 font-semibold' : 'text-gray-500'} hover:text-sea-500`}>{t.howItWorks}</button>
          <button onClick={() => setView('merchant')} className={`${currentView === 'merchant' ? 'text-sea-600 font-semibold' : 'text-gray-500'} hover:text-sea-500`}>{t.merchant}</button>
          
          {/* Language Selector */}
          <div className="relative group ml-4">
            <button className="flex items-center gap-1 text-gray-600 hover:text-sea-600 font-medium uppercase text-sm border border-gray-200 rounded-md px-2 py-1">
              {lang} <span className="text-xs">▼</span>
            </button>
            <div className="absolute right-0 mt-0 w-24 bg-white border border-gray-100 rounded-lg shadow-lg overflow-hidden hidden group-hover:block">
              {(['pt', 'en', 'es'] as Language[]).map((l) => (
                <button 
                  key={l}
                  onClick={() => setLang(l)}
                  className={`block w-full text-left px-4 py-2 text-sm hover:bg-sea-50 ${lang === l ? 'font-bold text-sea-600' : 'text-gray-600'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
        <div className="md:hidden flex items-center">
          <button
            type="button"
            aria-expanded={mobileMenuOpen}
            aria-label="Menu"
            onClick={() => setMobileMenuOpen((o) => !o)}
            className="p-2 rounded-lg text-gray-700 hover:bg-sea-50 hover:text-sea-700"
          >
            <IconMenu />
          </button>
        </div>
      </div>
    </div>
    {mobileMenuOpen && (
      <>
        <div
          className="fixed top-16 left-0 right-0 bottom-0 z-40 bg-black/40 md:hidden"
          aria-hidden
          onClick={() => setMobileMenuOpen(false)}
        />
        <div className="absolute top-full left-0 right-0 z-50 md:hidden border-b border-sea-100 bg-white shadow-lg">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-0.5">
            <button
              type="button"
              onClick={() => { setView('home'); setMobileMenuOpen(false); }}
              className={`text-left py-2.5 px-2 rounded-lg text-base ${currentView === 'home' ? 'text-sea-600 font-semibold bg-sea-50' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {t.offers}
            </button>
            <button
              type="button"
              onClick={() => { setView('how-it-works'); setMobileMenuOpen(false); }}
              className={`text-left py-2.5 px-2 rounded-lg text-base ${currentView === 'how-it-works' ? 'text-sea-600 font-semibold bg-sea-50' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {t.howItWorks}
            </button>
            <button
              type="button"
              onClick={() => { setView('merchant'); setMobileMenuOpen(false); }}
              className={`text-left py-2.5 px-2 rounded-lg text-base ${currentView === 'merchant' ? 'text-sea-600 font-semibold bg-sea-50' : 'text-gray-700 hover:bg-gray-50'}`}
            >
              {t.merchant}
            </button>
            <div className="border-t border-gray-100 mt-2 pt-3 flex flex-wrap gap-2">
              {(['pt', 'en', 'es'] as Language[]).map((l) => (
                <button
                  key={l}
                  type="button"
                  onClick={() => { setLang(l); setMobileMenuOpen(false); }}
                  className={`px-3 py-1.5 rounded-md text-sm border ${lang === l ? 'border-sea-600 bg-sea-50 font-bold text-sea-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}
                >
                  {l.toUpperCase()}
                </button>
              ))}
            </div>
          </div>
        </div>
      </>
    )}
  </nav>
  );
};

// 2. Offer Card
const OfferCard: React.FC<{ offer: Offer, onGetCoupon: (o: Offer) => void, lang: Language }> = ({ offer, onGetCoupon, lang }) => {
  const t = translations[lang].offerCard;
  const lim = getOfferCouponLimitInfo(offer);
  const { hasLimit, max, remaining, pctRemaining } = lim;
  const titleUi = offerTitle(offer, lang);
  const descUi = offerDescription(offer, lang);
  const discUi = offerDiscount(offer, lang);

  return (
  <div className="bg-white rounded-2xl shadow-lg hover:shadow-xl transition-shadow duration-300 border border-sea-50 flex flex-col h-full min-h-0">
    <div className="h-48 overflow-hidden relative flex-shrink-0 rounded-t-2xl">
      <img src={safeImageUrl(offer.imageUrl) || 'https://picsum.photos/400/300'} alt={titleUi} className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500" />
    </div>
    <div className="p-6 flex flex-col flex-grow min-h-0">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{titleUi}</h3>
      </div>
      <p className="text-sm text-sea-600 font-medium mb-2">{offer.merchantName}</p>
      
      {discUi && (
        <div className="mb-3">
          <span className="bg-sand-100 text-sand-700 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">
            {formatDiscountForDisplay(discUi)}
          </span>
        </div>
      )}

      <p className="text-gray-600 text-sm mb-4 line-clamp-2 shrink-0">{descUi}</p>

      {hasLimit && remaining !== null && (
        <div className="mb-4 rounded-lg border border-sea-100 bg-sea-50/80 px-3 py-2 shrink-0">
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <span className="text-xs font-semibold text-sea-900">
              {t.couponsRemaining
                .replace("{remaining}", String(remaining))
                .replace("{total}", String(max))}
            </span>
            {remaining > 0 &&
              (remaining === 1 || (remaining <= 5 && remaining < max)) && (
              <span className="text-[10px] font-bold uppercase tracking-wide text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                {remaining === 1 ? t.couponsLastOne : t.couponsFewLeft}
              </span>
            )}
          </div>
          <div className="h-2 bg-white/80 rounded-full overflow-hidden border border-sea-100">
            <div
              className="h-full bg-gradient-to-r from-sea-500 to-sea-400 rounded-full transition-all duration-500"
              style={{ width: `${pctRemaining}%` }}
            />
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50 shrink-0">
        <span className="text-xs text-gray-400">{t.validUntil} {offer.validUntil}</span>
        <button 
          onClick={() => onGetCoupon(offer)}
          className="bg-sea-600 hover:bg-sea-700 text-white px-4 py-2 rounded-lg text-sm font-semibold transition-colors shadow-md hover:shadow-lg flex items-center gap-2"
        >
          <IconQrCode className="w-4 h-4" />
          {t.getCoupon}
        </button>
      </div>
    </div>
  </div>
  );
};

// 3. Modal for Email & QR
const CouponModal = ({
  offer,
  onClose,
  lang,
  onCouponGenerated
}: {
  offer: Offer | null;
  onClose: () => void;
  lang: Language;
  onCouponGenerated?: () => void;
}) => {
  const [email, setEmail] = useState('');
  const [coupon, setCoupon] = useState<Coupon | null>(null);
  const [mailQueued, setMailQueued] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(false);
  const t = translations[lang].couponModal;

  if (!offer) return null;

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const result = await generateCoupon(offer, email, lang);
      setCoupon(result.coupon);
      setMailQueued(result.mailQueued);
      onCouponGenerated?.();
    } catch (error) {
      console.error(error);
      if (error instanceof Error) {
        const m = error.message;
        if (m === COUPON_SOLD_OUT) alert(t.soldOut);
        else if (m === COUPON_ALREADY_CLAIMED) alert(t.alreadyClaimed);
        else if (m === COUPON_INVALID_EMAIL) alert(t.invalidEmail);
        else if (m === COUPON_OFFER_NOT_YET_VALID) alert(t.notYetValid);
        else if (error instanceof FirebaseError) {
          alert(`${t.error}\n\n${error.code}: ${error.message}`);
        } else {
          alert(`${t.error}\n\n${m}`);
        }
      } else {
        alert(t.error);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl relative animate-fadeIn">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">
          ✕
        </button>
        
        {!coupon ? (
          <>
            <h3 className="text-2xl font-bold text-gray-900 mb-2">{t.title}</h3>
            <p className="text-gray-500 mb-6">{t.description} <span className="font-semibold text-sea-700">{offerTitle(offer, lang)}</span>.</p>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.emailLabel}</label>
                <input 
                  type="text"
                  inputMode="email"
                  autoComplete="email"
                  required
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 bg-white text-gray-900 placeholder:text-gray-400 focus:ring-2 focus:ring-sea-500 focus:border-transparent outline-none transition-all"
                  placeholder={t.placeholder}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-sea-600 hover:bg-sea-700 text-white py-3 rounded-lg font-bold shadow-lg disabled:opacity-50 transition-all"
              >
                {loading ? t.generating : t.generateBtn}
              </button>
            </form>
          </>
        ) : (
          <div className="text-center py-4">
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full inline-block text-sm font-bold mb-4">
              {t.successTitle}
            </div>
            <div
              role="alert"
              className="mb-4 overflow-hidden rounded-lg border border-red-600 shadow-sm"
            >
              <p className="bg-red-50 px-2.5 py-2 text-left text-xs font-medium leading-snug text-red-950 sm:text-sm">
                {t.qrSaveWarningLead}
              </p>
              <div className="bg-red-600 px-2 py-1.5 sm:py-2">
                <p className="text-center text-xs font-bold uppercase leading-tight tracking-wide text-white sm:text-sm">
                  {t.qrSaveWarningEmphasis}
                </p>
              </div>
            </div>
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white border-4 border-sea-100 rounded-xl shadow-inner">
                <QRCodeCanvas value={coupon.id} size={200} level={"H"} />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-2">{t.codeLabel} <span className="font-mono font-bold text-gray-800">{coupon.id}</span></p>
            <p className="text-xs text-gray-400 mb-4">{t.instruction}</p>
            <p className="text-xs text-sea-600 bg-sea-50 rounded-lg px-3 py-2 mb-3 font-medium">{t.gamificationMsg}</p>
            {mailQueued === false && (
              <p className="text-xs rounded-lg px-3 py-2 mb-6 bg-amber-50 text-amber-900">
                {t.emailNotQueuedHint}
              </p>
            )}
            <button onClick={onClose} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-800 py-3 rounded-lg font-semibold transition-colors">
              {t.close}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

// 4. Admin Panel
const AdminPanel = ({
  lang,
  user,
  onUserUpdate
}: {
  lang: Language;
  user: CompanyUser;
  onUserUpdate: (u: CompanyUser) => void;
}) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [consumers, setConsumers] = useState<ConsumerStat[]>([]);
  const [emailAggregates, setEmailAggregates] = useState<ConsumerEmailAggregate[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  /** Nome exibido ao lado do botão (input file nativo usa idioma do SO). */
  const [pickedImageFileName, setPickedImageFileName] = useState<string | null>(null);
  const offerImageInputId = useId();
  const [newOffer, setNewOffer] = useState<Partial<Offer>>({
    title: '',
    description: '',
    discount: '',
    titleEn: '',
    titleEs: '',
    descriptionEn: '',
    descriptionEs: '',
    discountEn: '',
    discountEs: '',
    validFrom: '',
    validUntil: '',
    imageUrl: '',
    publishIntent: true,
    categories: []
  });
  const [promoKind, setPromoKind] = useState<PromoKind>('percent');
  const [promoPercent, setPromoPercent] = useState('');
  const [promoPriceFrom, setPromoPriceFrom] = useState('');
  const [promoPriceTo, setPromoPriceTo] = useState('');
  const [promoDealText, setPromoDealText] = useState('');
  const [profileName, setProfileName] = useState(user.companyName);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileMsg, setProfileMsg] = useState<'ok' | 'err' | null>(null);
  const [offerTab, setOfferTab] = useState<'active' | 'archived'>('active');
  const [customersExpanded, setCustomersExpanded] = useState(false);
  const [customersTopExpanded, setCustomersTopExpanded] = useState(false);
  const t = translations[lang].admin;
  const tCats = translations[lang].categories;

  const refresh = async () => {
    const [allOffers, dashboard] = await Promise.all([
      getMerchantOffers(user.uid),
      getMerchantConsumerDashboard(user.uid)
    ]);
    setOffers(allOffers);
    setConsumers(dashboard.byOffer);
    setEmailAggregates(dashboard.byEmail);
  };

  /** Nome da promoção na lista de clientes: título atual da oferta (offers), não só a cópia gravada no cupom na hora da geração. */
  const displayOfferTitleForStat = (row: ConsumerStat) => {
    const live = offers.find((o) => o.id === row.offerId);
    if (live) return offerTitle(live, lang) || row.offerTitle?.trim() || row.offerId || '-';
    return row.offerTitle?.trim() || row.offerId || '-';
  };

  useEffect(() => { refresh(); }, []);

  useEffect(() => {
    setProfileName(user.companyName);
  }, [user.companyName]);

  const resetPromoFields = () => {
    setPromoKind('percent');
    setPromoPercent('');
    setPromoPriceFrom('');
    setPromoPriceTo('');
    setPromoDealText('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let builtDiscount: string | null = null;
    if (!editingId) {
      if (!newOffer.title?.trim()) return;
      if (!newOffer.categories?.length) {
        alert(t.categoryRequired);
        return;
      }
      builtDiscount = buildDiscountFromPromo(promoKind, {
        percentDigits: promoPercent,
        priceFrom: promoPriceFrom,
        priceTo: promoPriceTo,
        dealText: promoDealText
      });
      if (!builtDiscount) {
        alert(t.promoInvalid);
        return;
      }
    }

    const mc = newOffer.maxCoupons;
    if (mc != null && (!Number.isInteger(mc) || mc < 5)) {
      alert(t.maxCouponsInvalid);
      return;
    }

    const vf = (newOffer.validFrom || "").trim();
    const vu = (newOffer.validUntil || "").trim();
    if (!vf || !vu) {
      alert(t.dateBothRequired);
      return;
    }
    if (vf > vu) {
      alert(t.dateOrderInvalid);
      return;
    }

    const offerData: Partial<Offer> = {
      ...newOffer,
      imageUrl: newOffer.imageUrl || `https://picsum.photos/400/300?random=${Date.now()}`,
      categories: !editingId ? (newOffer.categories as Category[]) : (newOffer.categories?.length ? newOffer.categories : ['other'])
    };
    if (!editingId && builtDiscount) {
      offerData.discount = builtDiscount;
    }
    if (mc == null) {
      delete offerData.maxCoupons;
      delete offerData.couponsIssued;
    }

    offerData.merchantName = user.companyName;
    offerData.publishIntent = newOffer.publishIntent !== false;

    const i18n = clipOfferI18nFields(newOffer);

    try {
      if (editingId) {
        const prev = offers.find((o) => o.id === editingId);
        if (!prev) return;

        const hadLimit = prev.maxCoupons != null && prev.maxCoupons >= 5;
        const hasLimitNow = mc != null && mc >= 5;
        const wantPublished = newOffer.publishIntent !== false;

        if (hadLimit && !hasLimitNow) {
          await updateOffer(editingId, {
            validFrom: vf,
            validUntil: vu,
            removeCouponLimit: true,
            publishIntent: wantPublished,
            ...i18n
          } as OfferUpdateInput);
        } else if (!hadLimit && hasLimitNow) {
          const cnt = await countCouponsForOffer(editingId, user.uid);
          await updateOffer(editingId, {
            validFrom: vf,
            validUntil: vu,
            maxCoupons: mc,
            syncCouponsIssued: cnt,
            publishIntent: wantPublished,
            ...i18n
          } as OfferUpdateInput);
        } else {
          const patch: OfferUpdateInput = {
            validFrom: vf,
            validUntil: vu,
            publishIntent: wantPublished,
            ...i18n
          };
          if (hasLimitNow && mc != null) {
            patch.maxCoupons = mc;
          }
          await updateOffer(editingId, patch);
        }
      } else {
        const created = await createOffer(offerData as Omit<Offer, "id">, user.uid);
        void requestOfferAutoTranslation(created.id);
      }
      setIsAdding(false);
      setEditingId(null);
      resetPromoFields();
      setPickedImageFileName(null);
      setNewOffer({
        title: '',
        description: '',
        discount: '',
        titleEn: '',
        titleEs: '',
        descriptionEn: '',
        descriptionEs: '',
        discountEn: '',
        discountEs: '',
        validFrom: '',
        validUntil: '',
        imageUrl: '',
        publishIntent: true,
        categories: []
      });
      refresh();
    } catch (err) {
      console.error(err);
      alert('Error saving offer');
    }
  };

  const handleEdit = (offer: Offer) => {
    setPickedImageFileName(null);
    setNewOffer(offer);
    setEditingId(offer.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if(window.confirm(t.confirmDelete)) {
      try {
        // Optimistic update for immediate feedback
        setOffers(prev => prev.filter(o => o.id !== id));
        
        await deleteOffer(id);
        
        // Background refresh to ensure consistency
        const updatedOffers = await getMerchantOffers(user.uid);
        setOffers(updatedOffers);
      } catch (error) {
        console.error("Failed to delete:", error);
        alert("Error deleting offer");
        refresh(); // Rollback on error
      }
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setPickedImageFileName(file.name);
      if (file.size > 2 * 1024 * 1024) {
        alert("File too large. Max 2MB.");
        setPickedImageFileName(null);
        return;
      }
      setIsUploading(true);
      try {
        const url = await uploadImage(file, user.uid);
        setNewOffer(prev => ({...prev, imageUrl: url}));
      } catch (error) {
        console.error("Upload failed", error);
        alert("Upload failed");
      } finally {
        setIsUploading(false);
      }
    }
    e.target.value = "";
  };

  const toggleCategory = (cat: Category) => {
    if (editingId) return;
    setNewOffer(prev => {
      const cats = prev.categories || [];
      if (cats.includes(cat)) {
        return { ...prev, categories: cats.filter(c => c !== cat) };
      } else {
        return { ...prev, categories: [...cats, cat] };
      }
    });
  };

  const cancelEdit = () => {
    setIsAdding(false);
    setEditingId(null);
    resetPromoFields();
    setPickedImageFileName(null);
    setNewOffer({
      title: '',
      description: '',
      discount: '',
      titleEn: '',
      titleEs: '',
      descriptionEn: '',
      descriptionEs: '',
      discountEn: '',
      discountEs: '',
      validFrom: '',
      validUntil: '',
      imageUrl: '',
      publishIntent: true,
      categories: []
    });
  };

  const categoriesList: Category[] = ['bar', 'restaurant', 'experience', 'lodging', 'other'];

  const activeOffersList = offers.filter((o) => !isOfferArchived(o));
  const archivedOffersList = offers.filter((o) => isOfferArchived(o));
  const displayedOffers = offerTab === 'active' ? activeOffersList : archivedOffersList;

  const visibleConsumers = customersExpanded
    ? consumers
    : consumers.slice(0, CUSTOMER_LIST_PREVIEW);
  const customerExtraCount = Math.max(0, consumers.length - CUSTOMER_LIST_PREVIEW);

  const visibleTopAggregates = customersTopExpanded
    ? emailAggregates
    : emailAggregates.slice(0, CUSTOMER_LIST_PREVIEW);
  const customerTopExtraCount = Math.max(0, emailAggregates.length - CUSTOMER_LIST_PREVIEW);

  const handleSaveProfile = async () => {
    const trimmed = profileName.trim();
    if (!trimmed || trimmed === user.companyName) return;
    setProfileSaving(true);
    setProfileMsg(null);
    try {
      await updateCompanyDisplayName(user.uid, trimmed);
      onUserUpdate({ ...user, companyName: trimmed });
      await refresh();
      setProfileMsg('ok');
    } catch (e) {
      console.error(e);
      setProfileMsg('err');
    } finally {
      setProfileSaving(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-2xl font-bold text-gray-800 min-w-0">{t.title}</h2>
        <div className="flex flex-row flex-wrap items-center gap-2 sm:justify-end shrink-0">
          {isAdding && (
            <button
              type="button"
              onClick={cancelEdit}
              className="bg-sea-600 text-white px-4 py-2 rounded-lg shadow hover:bg-sea-700 transition-colors whitespace-nowrap"
            >
              {t.cancel}
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditingId(null);
              resetPromoFields();
              setPickedImageFileName(null);
              setNewOffer({
                title: '',
                description: '',
                discount: '',
                titleEn: '',
                titleEs: '',
                descriptionEn: '',
                descriptionEs: '',
                discountEn: '',
                discountEs: '',
                validFrom: '',
                validUntil: '',
                imageUrl: '',
                publishIntent: true,
                categories: []
              });
              setIsAdding(true);
            }}
            disabled={isAdding}
            className="bg-sea-600 text-white px-4 py-2 rounded-lg shadow transition-colors whitespace-nowrap disabled:pointer-events-none disabled:opacity-40 hover:bg-sea-700 enabled:hover:bg-sea-700"
          >
            {t.addOffer}
          </button>
        </div>
      </div>

      <div className="mb-8 bg-white p-6 rounded-xl shadow-md border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-1">{t.profileHeading}</h3>
        <p className="text-sm text-gray-600 mb-4">{t.profileDesc}</p>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-end">
          <div className="flex-1 min-w-0">
            <label className="text-xs text-gray-500 mb-1 block">{t.profilePlaceholder}</label>
            <input
              type="text"
              className="w-full border p-2 rounded"
              maxLength={COMPANY_NAME_MAX}
              value={profileName}
              onChange={(e) => setProfileName(clipString(e.target.value, COMPANY_NAME_MAX))}
            />
            <p className="text-xs text-gray-400 mt-1">
              {t.charCounter.replace('{used}', String([...profileName].length)).replace('{max}', String(COMPANY_NAME_MAX))}
            </p>
          </div>
          <button
            type="button"
            disabled={profileSaving || !profileName.trim() || profileName.trim() === user.companyName}
            onClick={handleSaveProfile}
            className="px-4 py-2 rounded-lg bg-sea-600 text-white font-medium hover:bg-sea-700 disabled:opacity-40 whitespace-nowrap shrink-0"
          >
            {profileSaving ? t.profileSaving : t.saveProfile}
          </button>
        </div>
        {profileMsg === 'ok' && <p className="text-sm text-green-700 mt-2">{t.profileSaved}</p>}
        {profileMsg === 'err' && <p className="text-sm text-red-600 mt-2">{t.profileError}</p>}
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md mb-8 border border-gray-100 animate-fadeIn">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">{editingId ? t.formEditOffer : t.formNewOffer}</h3>

          {editingId ? (
            <div
              className="mb-6 rounded-xl border border-sea-200/80 bg-sea-50/50 p-4 text-sm text-gray-800"
              role="region"
              aria-label={t.editAfterPublishTitle}
            >
              <p className="font-semibold text-sea-900 mb-2">{t.editAfterPublishTitle}</p>
              <p className="mb-2 leading-relaxed">{t.editAfterPublishIntro}</p>
              <ul className="list-disc pl-5 space-y-1.5 leading-relaxed">
                {t.editAfterPublishBullets.map((line, i) => (
                  <li key={i}>{line}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <fieldset className="mb-6 rounded-xl border border-sea-100 bg-sea-50/40 p-4">
            <legend className="text-sm font-semibold text-sea-900 px-1">{t.visibilityHeading}</legend>
            <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:gap-4">
              <label
                className={`flex-1 cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                  newOffer.publishIntent !== false
                    ? 'border-sea-600 bg-white shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="offerVisibility"
                  className="sr-only"
                  checked={newOffer.publishIntent !== false}
                  onChange={() => setNewOffer({ ...newOffer, publishIntent: true })}
                />
                <span className="block font-medium text-gray-900">{t.visibilityPublishedTitle}</span>
                <span className="mt-1 block text-xs text-gray-600">{t.visibilityPublishedDesc}</span>
              </label>
              <label
                className={`flex-1 cursor-pointer rounded-lg border-2 p-4 transition-colors ${
                  newOffer.publishIntent === false
                    ? 'border-amber-500 bg-amber-50/60 shadow-sm'
                    : 'border-gray-200 bg-white hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="offerVisibility"
                  className="sr-only"
                  checked={newOffer.publishIntent === false}
                  onChange={() => setNewOffer({ ...newOffer, publishIntent: false })}
                />
                <span className="block font-medium text-gray-900">{t.visibilityPausedTitle}</span>
                <span className="mt-1 block text-xs text-gray-600">{t.visibilityPausedDesc}</span>
              </label>
            </div>
          </fieldset>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex flex-col md:col-span-2">
              <input
                placeholder={t.placeholders.title}
                className={`border p-2 rounded ${editingId ? 'bg-gray-100 text-gray-700 cursor-not-allowed' : ''}`}
                value={newOffer.title}
                maxLength={OFFER_TITLE_MAX}
                onChange={(e) =>
                  setNewOffer({ ...newOffer, title: clipString(e.target.value, OFFER_TITLE_MAX) })
                }
                required={!editingId}
                disabled={!!editingId}
                readOnly={!!editingId}
              />
              <span className="text-xs text-gray-400 mt-1">
                {t.charCounter
                  .replace('{used}', String([...(newOffer.title || '')].length))
                  .replace('{max}', String(OFFER_TITLE_MAX))}
              </span>
            </div>

            {editingId ? (
              <div className="flex flex-col md:col-span-2">
                <label className="text-xs text-gray-500 mb-1">{t.promoLockedLabel}</label>
                <input
                  type="text"
                  className="border p-2 rounded bg-gray-100 text-gray-700 cursor-not-allowed opacity-90 max-w-xl"
                  value={formatDiscountForDisplay(newOffer.discount ?? '')}
                  disabled
                  readOnly
                  aria-readonly
                />
                <span className="text-xs text-gray-400 mt-1">{t.discountLockedHint}</span>
              </div>
            ) : (
              <fieldset className="md:col-span-2 rounded-xl border border-sea-100 bg-sea-50/30 p-4 space-y-4">
                <legend className="text-sm font-semibold text-sea-900 px-1">{t.promoKindLabel}</legend>
                <div className="flex flex-col sm:flex-row sm:flex-wrap gap-2">
                  {(['percent', 'price_pair', 'deal_text'] as PromoKind[]).map((k) => (
                    <label
                      key={k}
                      className={`flex-1 min-w-[140px] cursor-pointer rounded-lg border-2 px-3 py-2 text-sm transition-colors ${
                        promoKind === k
                          ? 'border-sea-600 bg-white shadow-sm'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="promoKind"
                        className="sr-only"
                        checked={promoKind === k}
                        onChange={() => setPromoKind(k)}
                      />
                      <span className="font-medium text-gray-900">
                        {k === 'percent' ? t.promoKindPercent : k === 'price_pair' ? t.promoKindPrice : t.promoKindDeal}
                      </span>
                    </label>
                  ))}
                </div>

                {promoKind === 'percent' && (
                  <div className="flex flex-col sm:flex-row sm:items-end gap-3">
                    <div className="flex flex-col max-w-xs">
                      <label className="text-xs text-gray-600 mb-1">{t.percentLabel}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="text"
                          inputMode="numeric"
                          autoComplete="off"
                          placeholder="30"
                          className="border p-2 rounded w-24 text-lg font-semibold"
                          value={promoPercent}
                          onChange={(e) => setPromoPercent(clipPercentDigits(e.target.value))}
                        />
                        <span className="text-lg font-bold text-sea-700">%</span>
                      </div>
                    </div>
                    {promoPercent && buildDiscountFromPromo('percent', { percentDigits: promoPercent }) && (
                      <p className="text-sm text-sea-800 bg-white/80 border border-sea-100 rounded-lg px-3 py-2">
                        <span className="text-gray-500">{t.percentPreview} </span>
                        <strong>{buildDiscountFromPromo('percent', { percentDigits: promoPercent })}</strong>
                      </p>
                    )}
                  </div>
                )}

                {promoKind === 'price_pair' && (
                  <div className="space-y-3">
                    <p className="text-xs text-gray-600">{t.pricePairIntro}</p>
                    <div className="flex flex-col sm:flex-row gap-4 flex-wrap">
                      <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">{t.priceFromLabel}</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="border p-2 rounded max-w-[200px]"
                          placeholder="500"
                          value={promoPriceFrom}
                          onChange={(e) => setPromoPriceFrom(clipPriceReaisDigits(e.target.value))}
                        />
                      </div>
                      <div className="flex flex-col">
                        <label className="text-xs text-gray-600 mb-1">{t.priceToLabel}</label>
                        <input
                          type="text"
                          inputMode="numeric"
                          className="border p-2 rounded max-w-[200px]"
                          placeholder="299"
                          value={promoPriceTo}
                          onChange={(e) => setPromoPriceTo(clipPriceReaisDigits(e.target.value))}
                        />
                      </div>
                    </div>
                    {buildDiscountFromPromo('price_pair', { priceFrom: promoPriceFrom, priceTo: promoPriceTo }) && (
                      <p className="text-sm text-sea-800 bg-white/80 border border-sea-100 rounded-lg px-3 py-2">
                        <span className="text-gray-500">{t.percentPreview} </span>
                        <strong>
                          {buildDiscountFromPromo('price_pair', {
                            priceFrom: promoPriceFrom,
                            priceTo: promoPriceTo
                          })}
                        </strong>
                      </p>
                    )}
                  </div>
                )}

                {promoKind === 'deal_text' && (
                  <div className="flex flex-col">
                    <label className="text-xs text-gray-600 mb-1">{t.dealLabel}</label>
                    <input
                      type="text"
                      className="border p-2 rounded max-w-xl"
                      placeholder={t.dealPlaceholder}
                      maxLength={OFFER_DISCOUNT_DEAL_TEXT_MAX}
                      value={promoDealText}
                      onChange={(e) =>
                        setPromoDealText(clipString(e.target.value, OFFER_DISCOUNT_DEAL_TEXT_MAX))
                      }
                    />
                    <p className="text-xs text-gray-500 mt-1">{t.dealHint}</p>
                    <span className="text-xs text-gray-400 mt-1">
                      {t.charCounter
                        .replace('{used}', String([...promoDealText].length))
                        .replace('{max}', String(OFFER_DISCOUNT_DEAL_TEXT_MAX))}
                    </span>
                  </div>
                )}

                <p className="text-xs text-gray-500">{t.discountFieldHint}</p>
              </fieldset>
            )}
            
            <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1 ml-1">{t.placeholders.validFrom}</label>
                <input
                  type="date"
                  required
                  className="border p-2 rounded w-full"
                  value={newOffer.validFrom || ''}
                  max={newOffer.validUntil || undefined}
                  onChange={(e) => setNewOffer({ ...newOffer, validFrom: e.target.value })}
                />
              </div>
              <div className="flex flex-col">
                <label className="text-xs text-gray-500 mb-1 ml-1">{t.placeholders.validUntil}</label>
                <input
                  type="date"
                  required
                  className="border p-2 rounded w-full"
                  value={newOffer.validUntil || ''}
                  min={newOffer.validFrom || undefined}
                  onChange={(e) => setNewOffer({ ...newOffer, validUntil: e.target.value })}
                />
              </div>
            </div>

            <div className="flex flex-col md:col-span-2">
              <span className="text-xs text-gray-500 mb-1 ml-1">{t.placeholders.uploadImage}</span>
              {editingId ? (
                <p className="text-sm text-gray-600 mt-1">{t.placeholders.uploadImageLocked}</p>
              ) : (
                <>
                  <div className="flex flex-wrap items-center gap-3 mt-1">
                    <input
                      id={offerImageInputId}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      disabled={isUploading}
                      className="sr-only"
                      aria-label={t.placeholders.uploadImage}
                    />
                    <label
                      htmlFor={offerImageInputId}
                      className={`inline-flex items-center px-4 py-2 rounded-lg border border-gray-300 bg-white text-sm font-medium text-gray-800 shadow-sm hover:bg-gray-50 cursor-pointer ${isUploading ? 'opacity-50 pointer-events-none' : ''}`}
                    >
                      {t.placeholders.uploadFileButton}
                    </label>
                    <span className="text-sm text-gray-500 truncate max-w-[min(100%,14rem)] sm:max-w-xs" title={pickedImageFileName ?? undefined}>
                      {pickedImageFileName || t.placeholders.uploadFileNone}
                    </span>
                  </div>
                  {isUploading && <span className="text-xs text-sea-600 animate-pulse mt-1">{t.uploading}</span>}
                </>
              )}
              {newOffer.imageUrl && !isUploading && (
                <div className="mt-2 relative w-20 h-20">
                  <img src={safeImageUrl(newOffer.imageUrl) || ''} alt="" className="w-full h-full object-cover rounded border border-gray-200" />
                  {!editingId && (
                    <button
                      type="button"
                      onClick={() => {
                        setPickedImageFileName(null);
                        setNewOffer(prev => ({ ...prev, imageUrl: '' }));
                      }}
                      className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow"
                    >
                      ×
                    </button>
                  )}
                </div>
              )}
            </div>

            <div className="flex flex-col md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 ml-1">{t.maxCouponsLabel}</label>
              <input
                type="number"
                min={5}
                step={1}
                className="border p-2 rounded max-w-xs"
                placeholder={t.maxCouponsPlaceholder}
                value={newOffer.maxCoupons ?? ''}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '') setNewOffer({ ...newOffer, maxCoupons: undefined });
                  else setNewOffer({ ...newOffer, maxCoupons: parseInt(v, 10) });
                }}
              />
              <p className="text-xs text-gray-400 mt-1">{t.maxCouponsHint}</p>
              {editingId &&
                typeof newOffer.maxCoupons === 'number' &&
                newOffer.maxCoupons >= 5 && (
                  <p className="text-sm text-sea-900 font-medium mt-2 p-3 rounded-lg bg-sea-50 border border-sea-100">
                    {t.couponCountSummary
                      .replace('{issued}', String(newOffer.couponsIssued ?? 0))
                      .replace('{max}', String(newOffer.maxCoupons))
                      .replace(
                        '{remaining}',
                        String(
                          Math.max(0, newOffer.maxCoupons - (newOffer.couponsIssued ?? 0))
                        )
                      )}
                  </p>
                )}
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 ml-1">{t.placeholders.categories}</label>
              <div className={`flex flex-wrap gap-2 mt-1 ${editingId ? 'opacity-80' : ''}`}>
                {categoriesList.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    disabled={!!editingId}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      (newOffer.categories || []).includes(cat)
                        ? 'bg-sea-100 text-sea-700 border-sea-200'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-sea-200'
                    } ${editingId ? 'cursor-not-allowed opacity-90' : ''}`}
                  >
                    {tCats[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div className="md:col-span-2 flex flex-col">
              <textarea
                placeholder={t.placeholders.desc}
                className={`border p-2 rounded w-full ${editingId ? 'bg-gray-100 text-gray-700 cursor-not-allowed' : ''}`}
                rows={4}
                value={newOffer.description}
                maxLength={OFFER_DESCRIPTION_MAX}
                onChange={(e) =>
                  setNewOffer({
                    ...newOffer,
                    description: clipString(e.target.value, OFFER_DESCRIPTION_MAX)
                  })
                }
                disabled={!!editingId}
                readOnly={!!editingId}
              />
              <span className="text-xs text-gray-400 mt-1">
                {t.charCounter
                  .replace('{used}', String([...(newOffer.description || '')].length))
                  .replace('{max}', String(OFFER_DESCRIPTION_MAX))}
              </span>
            </div>
          </div>
          <button type="submit" disabled={isUploading} className={`mt-4 px-6 py-2 rounded-lg font-bold text-white ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-sand-500 hover:bg-sand-400'}`}>{t.save}</button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
        <div
          className="flex flex-wrap gap-1 px-3 sm:px-4 pt-3 border-b border-gray-200 bg-gray-50/80"
          role="tablist"
          aria-label={t.title}
        >
          <button
            type="button"
            role="tab"
            aria-selected={offerTab === 'active'}
            id="tab-offers-active"
            onClick={() => setOfferTab('active')}
            className={`px-3 sm:px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 -mb-px transition-colors ${
              offerTab === 'active'
                ? 'border-sea-600 text-sea-900 bg-white shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-white/60'
            }`}
          >
            {t.tabActiveOffers}{' '}
            <span className="text-gray-400 font-normal">({activeOffersList.length})</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={offerTab === 'archived'}
            id="tab-offers-archived"
            onClick={() => setOfferTab('archived')}
            className={`px-3 sm:px-4 py-2 rounded-t-lg text-sm font-medium border-b-2 -mb-px transition-colors ${
              offerTab === 'archived'
                ? 'border-sea-600 text-sea-900 bg-white shadow-sm'
                : 'border-transparent text-gray-500 hover:text-gray-800 hover:bg-white/60'
            }`}
          >
            {t.tabArchivedOffers}{' '}
            <span className="text-gray-400 font-normal">({archivedOffersList.length})</span>
          </button>
        </div>
        {offerTab === 'archived' && (
          <p className="px-4 py-2 text-xs text-gray-500 bg-white border-b border-gray-100">{t.tabArchivedHint}</p>
        )}
        <table className="min-w-full divide-y divide-gray-200" aria-labelledby={offerTab === 'active' ? 'tab-offers-active' : 'tab-offers-archived'}>
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.tableOffer}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.tableMerchant}</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{t.tableStatus}</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.tableActions}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {displayedOffers.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-6 py-10 text-center text-sm text-gray-500">
                  {offerTab === 'active' ? t.noActiveOffers : t.noArchivedOffers}
                </td>
              </tr>
            ) : (
              displayedOffers.map((offer) => (
                <tr key={offer.id} className={!offer.isActive ? 'opacity-60 bg-gray-50' : ''}>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      <img src={safeImageUrl(offer.imageUrl) || 'https://picsum.photos/40/40'} alt="" className="w-10 h-10 rounded-full mr-3 object-cover bg-gray-100" />
                      <div>
                        <div className="text-sm font-medium text-gray-900">{offerTitle(offer, lang)}</div>
                        <div className="text-sm text-gray-500">{formatDiscountForDisplay(offerDiscount(offer, lang))}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{offer.merchantName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-center">
                    <span
                      className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        offer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {offer.isActive ? t.statusActive : t.statusInactive}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end gap-2 items-center">
                      <button type="button" onClick={() => handleEdit(offer)} className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded cursor-pointer" title={t.tableActions}><IconFileText className="w-5 h-5" /></button>
                      <button type="button" onClick={() => handleDelete(offer.id)} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded cursor-pointer" title={t.confirmDelete}><IconTrash className="w-5 h-5" /></button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-10 bg-white rounded-xl shadow overflow-hidden border border-sea-100">
        <div className="px-6 py-4 bg-sea-50 border-b border-sea-100">
          <h3 className="text-lg font-bold text-sea-900">{t.customersTopTitle}</h3>
          {t.customersTopDesc?.trim() ? (
            <p className="text-sm text-gray-600 mt-1">{t.customersTopDesc}</p>
          ) : null}
        </div>
        {emailAggregates.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">{t.noCustomers}</p>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[min(70vh,520px)] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.colEmail}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t.colDistinctOffers}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t.colValidatedAtMerchant}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.colLast}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleTopAggregates.map((row, i) => (
                    <tr key={row.email} className={i < 3 ? 'bg-sand-50/80' : ''}>
                      <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.email}</td>
                      <td className="px-6 py-3 text-sm text-center text-sea-700 font-bold">{row.distinctOfferCount}</td>
                      <td className="px-6 py-3 text-sm text-center text-sea-700 font-bold">{row.validatedCouponCount}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {row.lastCouponAt
                          ? new Date(row.lastCouponAt).toLocaleString(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {emailAggregates.length > CUSTOMER_LIST_PREVIEW && (
              <div className="px-4 py-3 border-t border-sea-100 bg-sea-50/40 flex justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCustomersTopExpanded((v) => !v)}
                  className="text-sm font-semibold text-sea-700 hover:text-sea-900 underline underline-offset-2 decoration-sea-300"
                >
                  {customersTopExpanded
                    ? t.collapseCustomerTopList
                    : t.expandCustomerTopList.replace('{n}', String(customerTopExtraCount))}
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="mt-10 bg-white rounded-xl shadow overflow-hidden border border-sea-100">
        <div className="px-6 py-4 bg-sea-50 border-b border-sea-100">
          <h3 className="text-lg font-bold text-sea-900">{t.customersTitle}</h3>
          {t.customersDesc?.trim() ? (
            <p className="text-sm text-gray-600 mt-1">{t.customersDesc}</p>
          ) : null}
        </div>
        {consumers.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">{t.noCustomers}</p>
        ) : (
          <>
            <div className="overflow-x-auto max-h-[min(70vh,520px)] overflow-y-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.colEmail}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.colOffer}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t.colCoupons}</th>
                    <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t.colValidatedInOffer}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.colLast}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {visibleConsumers.map((row, i) => (
                    <tr key={`${row.email}::${row.offerId || '__'}`} className={i < 3 ? 'bg-sand-50/80' : ''}>
                      <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.email}</td>
                      <td className="px-6 py-3 text-sm text-gray-800">{displayOfferTitleForStat(row)}</td>
                      <td className="px-6 py-3 text-sm text-center text-sea-700 font-bold">{row.couponCount}</td>
                      <td className="px-6 py-3 text-sm text-center text-sea-700 font-bold">{row.validatedCount}</td>
                      <td className="px-6 py-3 text-sm text-gray-600">
                        {row.lastCouponAt
                          ? new Date(row.lastCouponAt).toLocaleString(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US')
                          : '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {consumers.length > CUSTOMER_LIST_PREVIEW && (
              <div className="px-4 py-3 border-t border-sea-100 bg-sea-50/40 flex justify-center sm:justify-end">
                <button
                  type="button"
                  onClick={() => setCustomersExpanded((v) => !v)}
                  className="text-sm font-semibold text-sea-700 hover:text-sea-900 underline underline-offset-2 decoration-sea-300"
                >
                  {customersExpanded
                    ? t.collapseCustomerList
                    : t.expandCustomerList.replace('{n}', String(customerExtraCount))}
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// 5. Merchant Scanner (Simulated)
const MerchantPanel = ({ lang, merchantUid }: { lang: Language; merchantUid: string }) => {
  const [scanning, setScanning] = useState(false);
  const [scanResult, setScanResult] = useState<{success: boolean; message: string} | null>(null);
  const [manualCode, setManualCode] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const t = translations[lang].merchant;

  const handleValidate = useCallback(async (code: string) => {
    const trimmed = code.trim();
    if (!trimmed) return;
    setScanning(false);
    setCameraError(null);
    const result = await validateCoupon(trimmed, merchantUid);
    let message = result.message;
    if (result.success) message = t.successMsg;
    else if (message === "Coupon not found.") message = t.notFound;
    else if (message === "Coupon already used.") message = t.alreadyUsed;
    else if (message === "Coupon wrong merchant.") message = t.wrongMerchant;

    setScanResult({ success: result.success, message });
  }, [merchantUid, t.successMsg, t.notFound, t.alreadyUsed, t.wrongMerchant]);

  useEffect(() => {
    if (!scanning) return;

    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    const tick = () => {
      if (stopped || !videoRef.current || !ctx) return;
      const v = videoRef.current;
      if (v.readyState >= 2 && v.videoWidth > 0) {
        canvas.width = v.videoWidth;
        canvas.height = v.videoHeight;
        ctx.drawImage(v, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const found = jsQR(imageData.data, imageData.width, imageData.height, {
          inversionAttempts: "attemptBoth"
        });
        if (found?.data) {
          stopped = true;
          if (stream) stream.getTracks().forEach((tr) => tr.stop());
          handleValidate(found.data);
          return;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    setCameraError(null);
    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "environment" } })
      .then((s) => {
        stream = s;
        const el = videoRef.current;
        if (el) {
          el.srcObject = s;
          el.onloadedmetadata = () => {
            raf = requestAnimationFrame(tick);
          };
        }
      })
      .catch(() => {
        setCameraError(t.cameraError);
        setScanning(false);
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      if (stream) stream.getTracks().forEach((track) => track.stop());
    };
  }, [scanning, handleValidate, t.cameraError]);

  return (
    <div className="max-w-md mx-auto p-6 text-center">
      <h2 className="text-2xl font-bold text-gray-800 mb-6">{t.title}</h2>
      
      {!scanning && !scanResult && (
        <div className="space-y-6">
          {cameraError && (
            <div className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">{cameraError}</div>
          )}
          <div className="bg-sea-50 p-8 rounded-2xl border-2 border-dashed border-sea-200 cursor-pointer hover:bg-sea-100 transition-colors" onClick={() => setScanning(true)}>
            <div className="flex justify-center mb-4 text-sea-600">
              <IconCamera />
            </div>
            <p className="text-sea-800 font-semibold">{t.tapToScan}</p>
          </div>
          
          <div className="relative">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-300"></div></div>
            <div className="relative flex justify-center text-sm"><span className="px-2 bg-sea-50 text-gray-500">{t.or}</span></div>
          </div>

          <div className="flex gap-2">
            <input 
              type="text" 
              placeholder={t.enterCode}
              className="flex-1 border p-3 rounded-lg outline-none focus:ring-2 focus:ring-sea-500"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
            />
            <button 
              onClick={() => handleValidate(manualCode)}
              className="bg-sea-600 text-white px-4 rounded-lg font-bold"
            >
              {t.check}
            </button>
          </div>
        </div>
      )}

      {scanning && (
        <div className="relative bg-black rounded-2xl overflow-hidden aspect-[3/4] shadow-2xl">
          <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover opacity-80" />
          <p className="absolute top-3 left-0 right-0 text-center text-white/90 text-xs px-2 drop-shadow">{t.pointQr}</p>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-48 h-48 border-2 border-white/50 rounded-lg animate-pulse relative">
              <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-sea-400 -mt-1 -ml-1"></div>
              <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-sea-400 -mt-1 -mr-1"></div>
              <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-sea-400 -mb-1 -ml-1"></div>
              <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-sea-400 -mb-1 -mr-1"></div>
            </div>
          </div>
          <button 
            onClick={() => setScanning(false)}
            className="absolute bottom-6 left-1/2 transform -translate-x-1/2 bg-white/20 backdrop-blur-md text-white px-6 py-2 rounded-full text-sm font-semibold hover:bg-white/30"
          >
            {t.cancelScan}
          </button>
        </div>
      )}

      {scanResult && (
        <div className={`p-6 rounded-2xl shadow-lg ${scanResult.success ? 'bg-green-50 text-green-900' : 'bg-red-50 text-red-900'} animate-fadeIn`}>
          <h3 className="text-xl font-bold mb-2">{scanResult.success ? t.valid : t.invalid}</h3>
          <p className="mb-6">{scanResult.message}</p>
          <button 
            onClick={() => { setScanResult(null); setManualCode(''); }}
            className="w-full bg-white border border-gray-200 py-3 rounded-lg font-semibold hover:bg-gray-50"
          >
            {t.scanAnother}
          </button>
        </div>
      )}
    </div>
  );
};

// 6. How It Works Page
const HowItWorks = ({ lang }: { lang: Language }) => {
  const t = translations[lang].howItWorks;
  return (
  <article className="max-w-3xl mx-auto px-4 py-8 md:py-12 animate-fadeIn text-gray-800">
    <h1 className="text-3xl md:text-4xl font-bold text-sea-900 mb-4">{t.title}</h1>
    <p className="text-base md:text-lg leading-relaxed text-gray-700 mb-10">{t.description}</p>

    <h2 className="text-xl md:text-2xl font-bold text-sea-900 mb-4">{t.touristSectionTitle}</h2>
    {t.touristParagraphs.map((p, i) => (
      <p key={i} className="mb-4 text-base leading-relaxed text-gray-700">{p}</p>
    ))}

    <h2 className="text-xl md:text-2xl font-bold text-sea-900 mt-10 mb-4">{t.merchantSectionTitle}</h2>
    {t.merchantParagraphs.map((p, i) => (
      <p key={i} className="mb-4 text-base leading-relaxed text-gray-700">{p}</p>
    ))}
  </article>
  );
};

// 7. Legal Modal
const LegalModal = ({ type, onClose, lang }: { type: 'terms' | 'privacy', onClose: () => void, lang: Language }) => {
  const t = translations[lang].legal;
  const content = type === 'terms' ? t.termsContent : t.privacyContent;
  
  return (
  <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
    <div className="bg-white rounded-2xl max-w-2xl w-full p-8 shadow-2xl relative animate-fadeIn max-h-[80vh] overflow-y-auto">
      <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
      <h2 className="text-2xl font-bold text-gray-900 mb-4">
        {type === 'terms' ? t.termsTitle : t.privacyTitle}
      </h2>
      <div className="prose prose-sm text-gray-600 space-y-4">
        {content.map((item, index) => (
          <p key={index}><strong>{item.title}</strong><br/>{item.text}</p>
        ))}
      </div>
      <button onClick={onClose} className="mt-8 w-full bg-sea-600 hover:bg-sea-700 text-white py-3 rounded-lg font-bold transition-colors">{t.understand}</button>
    </div>
  </div>
  );
};

// --- Main App Component ---

const App = () => {
  const [view, setViewState] = useState<string>(() => {
    try {
      const v = sessionStorage.getItem(SS_VIEW);
      if (v === "home" || v === "merchant" || v === "how-it-works") return v;
    } catch {
      /* ignore */
    }
    return "home";
  });
  const setView = useCallback((v: string) => {
    setViewState(v);
    try {
      if (v === "home" || v === "merchant" || v === "how-it-works") {
        sessionStorage.setItem(SS_VIEW, v);
      }
    } catch {
      /* ignore */
    }
  }, []);

  const [offers, setOffers] = useState<Offer[]>([]);
  /** Evita mostrar “nenhuma oferta” antes da primeira resposta do Firestore (comum no celular). */
  const [publicOffersReady, setPublicOffersReady] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [lang, setLang] = useState<Language>('pt');
  const [user, setUser] = useState<CompanyUser | null>(null);
  /** Primeira resolução do Firebase Auth (evita mostrar login antes de saber se há sessão). */
  const [authReady, setAuthReady] = useState(() => !isFirebaseConfigured());
  const [merchantTab, setMerchantTabState] = useState<"offers" | "scanner">(() => {
    try {
      const t = sessionStorage.getItem(SS_MERCHANT_TAB);
      if (t === "offers" || t === "scanner") return t;
    } catch {
      /* ignore */
    }
    return "offers";
  });
  const setMerchantTab = useCallback((v: "offers" | "scanner") => {
    setMerchantTabState(v);
    try {
      sessionStorage.setItem(SS_MERCHANT_TAB, v);
    } catch {
      /* ignore */
    }
  }, []);
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const t = translations[lang];
  const tCats = translations[lang].categories;

  useEffect(() => {
    let cancelled = false;
    const markReady = () => {
      if (!cancelled) setPublicOffersReady(true);
    };

    const unsubOffers = subscribePublicOffers((data) => {
      if (cancelled) return;
      setOffers(data);
      markReady();
    });

    if (isFirebaseConfigured()) {
      getPublicOffers()
        .then((data) => {
          if (cancelled) return;
          setOffers(data);
          markReady();
        })
        .catch((e) => {
          console.error(e);
          markReady();
        });
    }

    const unsubAuth = subscribeToAuthChanges((u) => {
      setUser(u);
      setAuthReady(true);
    });
    return () => {
      cancelled = true;
      unsubOffers();
      unsubAuth();
    };
  }, []);

  useEffect(() => {
    setSelectedOffer((prev) => {
      if (!prev) return null;
      const fresh = offers.find((o) => o.id === prev.id);
      return fresh ?? prev;
    });
  }, [offers]);

  const handleLogout = async () => {
    await logoutCompany();
    setUser(null);
    setView('home');
  };

  const filteredOffers = offers.filter(offer => {
    const now = localDateYmd();
    const until = toCanonicalYmd(offer.validUntil as unknown);
    const from = offer.validFrom ? toCanonicalYmd(offer.validFrom as unknown) : undefined;
    // Só esconde por fim de vigência quando a data existe e já passou (legado sem validUntil parseável continua visível).
    if (until && until < now) return false;
    // Início programado: na vitrine pública só aparece a partir do dia de validFrom (inclusive).
    if (from && from > now) return false;
    // Esgotado / pausada / vigência / limite: mesma regra que persiste isActive (evita doc desatualizado na query).
    if (!computePersistedIsActiveFromOffer(offer)) return false;
    if (selectedCategories.length > 0) {
      if (!offer.categories || !offer.categories.some(c => selectedCategories.includes(c))) return false;
    }
    return true;
  });

  const toggleCategoryFilter = (cat: Category) => {
    if (selectedCategories.includes(cat)) {
      setSelectedCategories(prev => prev.filter(c => c !== cat));
    } else {
      setSelectedCategories(prev => [...prev, cat]);
    }
  };

  const categoriesList: Category[] = ['bar', 'restaurant', 'experience', 'lodging', 'other'];

  return (
    <div className="min-h-screen pb-20 md:pb-0 font-sans text-gray-800 bg-sea-50">
      <Navbar setView={setView} currentView={view} lang={lang} setLang={setLang} />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {view === 'home' && (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-extrabold text-sea-900 mb-4 tracking-tight">
                {t.home.title} <br/>
                <span className="text-transparent bg-clip-text bg-gradient-to-r from-sea-500 to-sand-500">
                  {t.home.subtitle}
                </span>
              </h1>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto mb-8">
                {t.home.description}
              </p>

              {/* Category Filter */}
              <div className="flex flex-wrap justify-center gap-3 mb-8 animate-fadeIn">
                <button 
                  onClick={() => setSelectedCategories([])}
                  className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedCategories.length === 0 ? 'bg-sea-600 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
                >
                  {tCats.all}
                </button>
                {categoriesList.map(cat => (
                  <button
                    key={cat}
                    onClick={() => toggleCategoryFilter(cat)}
                    className={`px-4 py-2 rounded-full text-sm font-bold transition-all ${selectedCategories.includes(cat) ? 'bg-sea-500 text-white shadow-md' : 'bg-white text-gray-500 hover:bg-gray-50 border border-gray-200'}`}
                  >
                    {tCats[cat]}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {!publicOffersReady ? (
                <div
                  className="col-span-full grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8"
                  aria-busy="true"
                  aria-label={t.home.loadingOffers}
                >
                  {[0, 1, 2, 3, 4, 5].map((i) => (
                    <div
                      key={i}
                      className="bg-white rounded-xl shadow-md overflow-hidden border border-gray-100 animate-pulse"
                    >
                      <div className="h-44 sm:h-48 bg-gray-200" />
                      <div className="p-4 space-y-3">
                        <div className="h-4 bg-gray-200 rounded w-4/5" />
                        <div className="h-3 bg-gray-100 rounded w-1/2" />
                        <div className="h-16 bg-gray-100 rounded" />
                        <div className="h-9 bg-gray-200 rounded-lg w-full" />
                      </div>
                    </div>
                  ))}
                  <p className="col-span-full flex items-center justify-center gap-2 text-sm text-gray-500 py-2">
                    <span
                      className="h-4 w-4 border-2 border-sea-200 border-t-sea-600 rounded-full animate-spin shrink-0"
                      aria-hidden
                    />
                    {t.home.loadingOffers}
                  </p>
                </div>
              ) : filteredOffers.length > 0 ? (
                filteredOffers.map((offer) => (
                  <OfferCard
                    key={offer.id}
                    offer={offer}
                    onGetCoupon={setSelectedOffer}
                    lang={lang}
                  />
                ))
              ) : (
                <div className="col-span-full text-center py-12 text-gray-500">
                  <p className="text-xl font-semibold mb-2">{t.home.noOffers}</p>
                </div>
              )}
            </div>

            {selectedOffer && (
              <CouponModal 
                offer={selectedOffer} 
                onClose={() => setSelectedOffer(null)} 
                lang={lang}
                onCouponGenerated={() => {
                  getPublicOffers().then(setOffers);
                }}
              />
            )}
          </>
        )}

        {view === 'merchant' && (
          !authReady ? (
            <div className="flex flex-col items-center justify-center py-24 px-4" aria-busy="true">
              <div className="h-10 w-10 border-2 border-sea-200 border-t-sea-600 rounded-full animate-spin mb-4" />
              <p className="text-sm text-gray-600">{t.auth.sessionLoading}</p>
            </div>
          ) : !user ? (
            <LoginPanel lang={lang} onLogin={setUser} />
          ) : (
            <div className="animate-fadeIn">
              <div className="flex flex-col md:flex-row justify-between items-center mb-8 bg-white p-4 rounded-xl shadow-sm">
                <div className="flex bg-sea-50 p-1 rounded-lg mb-4 md:mb-0">
                  <button 
                    onClick={() => setMerchantTab('offers')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${merchantTab === 'offers' ? 'bg-white text-sea-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {t.nav.offers}
                  </button>
                  <button 
                    onClick={() => setMerchantTab('scanner')}
                    className={`px-6 py-2 rounded-lg text-sm font-bold transition-all ${merchantTab === 'scanner' ? 'bg-white text-sea-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                  >
                    {t.nav.scanner}
                  </button>
                </div>
                
                <div className="flex items-center gap-4 border-t md:border-t-0 md:border-l border-gray-100 pt-4 md:pt-0 md:pl-4 w-full md:w-auto justify-between md:justify-end">
                  <div className="flex flex-col">
                    <span className="text-xs text-gray-400 uppercase font-bold">Empresa</span>
                    <span className="text-sm font-medium text-gray-800 truncate max-w-[150px]">{user.companyName}</span>
                  </div>
                  <button onClick={handleLogout} className="text-sm text-red-500 hover:text-red-700 font-medium px-3 py-1 border border-red-100 rounded hover:bg-red-50 transition-colors">
                    {t.nav.logout}
                  </button>
                </div>
              </div>

              {merchantTab === 'offers' ? (
                <AdminPanel lang={lang} user={user} onUserUpdate={setUser} />
              ) : (
                <MerchantPanel lang={lang} merchantUid={user.uid} />
              )}
            </div>
          )
        )}
        
        {view === 'how-it-works' && <HowItWorks lang={lang} />}
      </main>

      {legalModal && <LegalModal type={legalModal} onClose={() => setLegalModal(null)} lang={lang} />}

      {/* Footer / Mobile Nav could go here, but sticky nav handles basics */}
      <footer className="bg-sea-900 text-sea-100 py-12 mt-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <div className="flex justify-center items-center mb-6">
            <div className="p-2 bg-sea-800 rounded-lg mr-2">
              <IconPalm className="w-6 h-6" />
            </div>
            <span className="font-bold text-xl tracking-tight">{t.nav.appName}</span>
          </div>
          
          <div className="flex justify-center space-x-6 mb-8 text-sm font-medium">
            <button onClick={() => setLegalModal('terms')} className="hover:text-white transition-colors">{t.legal.termsBtn}</button>
            <button onClick={() => setLegalModal('privacy')} className="hover:text-white transition-colors">{t.legal.privacyBtn}</button>
          </div>

          <p className="text-sm opacity-60 mb-4">
            {t.footer.developedBy} <a href="https://konzup.com" target="_blank" rel="noopener noreferrer" className="text-sand-400 hover:text-sand-300 font-bold hover:underline">Konzup</a>
          </p>
          
          <p className="text-xs opacity-40">{t.footer.rights}</p>
        </div>
      </footer>
    </div>
  );
};

export default App;