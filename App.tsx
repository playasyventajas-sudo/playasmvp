import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Offer, Coupon, UserRole, CompanyUser, Category, ConsumerStat } from './types';
import { getPublicOffers, getMerchantOffers, getMerchantConsumerStats, createOffer, updateOffer, deleteOffer, generateCoupon, validateCoupon, uploadImage, countCouponsForOffer, COUPON_SOLD_OUT } from './services/dataService';
import type { OfferUpdateInput } from './services/dataService';
import { safeImageUrl } from './utils/safeUrl';
import { subscribeToAuthChanges, logoutCompany } from './services/authService';
import { QRCodeCanvas } from 'qrcode.react';
import { IconPalm, IconQrCode, IconCamera, IconTrash, IconInfo, IconFileText, IconCheck, IconX } from './components/Icons';
import { translations, Language } from './src/translations';
import { LoginPanel } from './components/Auth';
import jsQR from 'jsqr';

// --- Sub-components defined here for single-file XML requirement simplicity, normally separated ---

// 1. Navbar
const Navbar = ({ setView, currentView, lang, setLang }: { setView: (v: string) => void, currentView: string, lang: Language, setLang: (l: Language) => void }) => {
  const t = translations[lang].nav;
  return (
  <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur-md shadow-sm border-b border-sea-100">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="flex justify-between h-16 items-center">
        <div className="flex items-center cursor-pointer" onClick={() => setView('home')}>
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
        {/* Mobile Menu Button - Simplified */}
        <div className="md:hidden flex space-x-4 items-center">
           <select 
             value={lang} 
             onChange={(e) => setLang(e.target.value as Language)}
             className="text-sm border border-gray-200 rounded p-1 mr-2 bg-transparent"
           >
             <option value="pt">PT</option>
             <option value="en">EN</option>
             <option value="es">ES</option>
           </select>
           <button onClick={() => setView('merchant')} className="p-2 text-gray-500"><IconCamera /></button>
        </div>
      </div>
    </div>
  </nav>
  );
};

// 2. Offer Card
const OfferCard: React.FC<{ offer: Offer, onGetCoupon: (o: Offer) => void, lang: Language }> = ({ offer, onGetCoupon, lang }) => {
  const t = translations[lang].offerCard;
  return (
  <div className="bg-white rounded-2xl shadow-lg overflow-hidden hover:shadow-xl transition-shadow duration-300 border border-sea-50 flex flex-col h-full">
    <div className="h-48 overflow-hidden relative flex-shrink-0">
      <img src={safeImageUrl(offer.imageUrl) || 'https://picsum.photos/400/300'} alt={offer.title} className="w-full h-full object-cover transform hover:scale-105 transition-transform duration-500" />
    </div>
    <div className="p-6 flex flex-col flex-grow">
      <div className="flex justify-between items-start mb-2">
        <h3 className="text-xl font-bold text-gray-900 line-clamp-1">{offer.title}</h3>
      </div>
      <p className="text-sm text-sea-600 font-medium mb-2">{offer.merchantName}</p>
      
      {offer.discount && (
        <div className="mb-3">
          <span className="bg-sand-100 text-sand-700 text-xs font-bold px-2 py-1 rounded-md uppercase tracking-wide">
            {offer.discount}
          </span>
        </div>
      )}

      <p className="text-gray-600 text-sm mb-4 line-clamp-2 flex-grow">{offer.description}</p>
      
      <div className="flex items-center justify-between mt-auto pt-4 border-t border-gray-50">
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
const CouponModal = ({ offer, onClose, lang }: { offer: Offer | null, onClose: () => void, lang: Language }) => {
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
      const result = await generateCoupon(offer, email);
      setCoupon(result.coupon);
      setMailQueued(result.mailQueued);
    } catch (error) {
      console.error(error);
      if (error instanceof Error && error.message === COUPON_SOLD_OUT) {
        alert(t.soldOut);
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
            <p className="text-gray-500 mb-6">{t.description} <span className="font-semibold text-sea-700">{offer.title}</span>.</p>
            <form onSubmit={handleGenerate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">{t.emailLabel}</label>
                <input 
                  type="email" 
                  required 
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-sea-500 focus:border-transparent outline-none transition-all"
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
            <div className="bg-green-100 text-green-800 px-4 py-2 rounded-full inline-block text-sm font-bold mb-6">
              {t.successTitle}
            </div>
            <div className="flex justify-center mb-6">
              <div className="p-4 bg-white border-4 border-sea-100 rounded-xl shadow-inner">
                <QRCodeCanvas value={coupon.id} size={200} level={"H"} />
              </div>
            </div>
            <p className="text-sm text-gray-500 mb-2">{t.codeLabel} <span className="font-mono font-bold text-gray-800">{coupon.id}</span></p>
            <p className="text-xs text-gray-400 mb-4">{t.instruction}</p>
            <p className="text-xs text-sea-600 bg-sea-50 rounded-lg px-3 py-2 mb-3 font-medium">{t.gamificationMsg}</p>
            {mailQueued !== null && (
              <p className={`text-xs rounded-lg px-3 py-2 mb-6 ${mailQueued ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-900'}`}>
                {mailQueued ? t.emailQueuedHint : t.emailNotQueuedHint}
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
const AdminPanel = ({ lang, user }: { lang: Language, user: CompanyUser }) => {
  const [offers, setOffers] = useState<Offer[]>([]);
  const [consumers, setConsumers] = useState<ConsumerStat[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [newOffer, setNewOffer] = useState<Partial<Offer>>({
    title: '', description: '', discount: '', merchantName: user.companyName, validFrom: '', validUntil: '', imageUrl: '', isActive: true, categories: []
  });
  const t = translations[lang].admin;
  const tCats = translations[lang].categories;

  const refresh = async () => {
    const [allOffers, stats] = await Promise.all([
      getMerchantOffers(user.uid),
      getMerchantConsumerStats(user.uid)
    ]);
    setOffers(allOffers);
    setConsumers(stats);
  };

  useEffect(() => { refresh(); }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newOffer.title || !newOffer.discount) return;

    const mc = newOffer.maxCoupons;
    if (mc != null && (!Number.isInteger(mc) || mc < 5)) {
      alert(t.maxCouponsInvalid);
      return;
    }

    const offerData: Partial<Offer> = {
      ...newOffer,
      imageUrl: newOffer.imageUrl || `https://picsum.photos/400/300?random=${Date.now()}`,
      categories: newOffer.categories || ['other']
    };
    if (mc == null) {
      delete offerData.maxCoupons;
      delete offerData.couponsIssued;
    }

    try {
      if (editingId) {
        const prev = offers.find((o) => o.id === editingId);
        const hadLimit = prev != null && prev.maxCoupons != null && prev.maxCoupons >= 5;
        const hasLimitNow = mc != null && mc >= 5;

        if (hadLimit && !hasLimitNow) {
          await updateOffer(editingId, { ...offerData, removeCouponLimit: true } as OfferUpdateInput);
        } else if (!hadLimit && hasLimitNow) {
          const cnt = await countCouponsForOffer(editingId);
          await updateOffer(editingId, {
            ...offerData,
            maxCoupons: mc,
            syncCouponsIssued: cnt,
            isActive: cnt < (mc as number)
          } as OfferUpdateInput);
        } else {
          const prevIssued = prev?.couponsIssued ?? 0;
          const finalPatch = { ...offerData } as OfferUpdateInput;
          if (hasLimitNow && mc != null && prevIssued >= mc) {
            finalPatch.isActive = false;
          }
          await updateOffer(editingId, finalPatch);
        }
      } else {
        await createOffer(offerData as Omit<Offer, "id">, user.uid);
      }
      setIsAdding(false);
      setEditingId(null);
      setNewOffer({ title: '', description: '', discount: '', merchantName: user.companyName, validFrom: '', validUntil: '', imageUrl: '', isActive: true, categories: [] });
      refresh();
    } catch (err) {
      console.error(err);
      alert('Error saving offer');
    }
  };

  const handleEdit = (offer: Offer) => {
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
      if (file.size > 2 * 1024 * 1024) {
        alert("File too large. Max 2MB.");
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
  };

  const toggleCategory = (cat: Category) => {
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
    setNewOffer({ title: '', description: '', discount: '', merchantName: user.companyName, validFrom: '', validUntil: '', imageUrl: '', isActive: true, categories: [] });
  };

  const categoriesList: Category[] = ['bar', 'restaurant', 'experience', 'lodging', 'other'];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex justify-between items-center mb-8">
        <h2 className="text-2xl font-bold text-gray-800">{t.title}</h2>
        <button 
          onClick={() => isAdding ? cancelEdit() : setIsAdding(true)}
          className="bg-sea-600 text-white px-4 py-2 rounded-lg shadow hover:bg-sea-700 transition-colors"
        >
          {isAdding ? t.cancel : t.addOffer}
        </button>
      </div>

      {isAdding && (
        <form onSubmit={handleSubmit} className="bg-white p-6 rounded-xl shadow-md mb-8 border border-gray-100 animate-fadeIn">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">{editingId ? 'Edit Offer' : 'New Offer'}</h3>
          
          <div className="mb-4 flex items-center gap-2">
            <input 
              type="checkbox" 
              id="isActive" 
              checked={newOffer.isActive ?? true} 
              onChange={e => setNewOffer({...newOffer, isActive: e.target.checked})}
              className="w-5 h-5 text-sea-600 rounded focus:ring-sea-500 border-gray-300"
            />
            <label htmlFor="isActive" className="text-sm font-medium text-gray-700">{t.isActive}</label>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input placeholder={t.placeholders.title} className="border p-2 rounded" value={newOffer.title} onChange={e => setNewOffer({...newOffer, title: e.target.value})} required />
            <input placeholder={t.placeholders.discount} className="border p-2 rounded" value={newOffer.discount} onChange={e => setNewOffer({...newOffer, discount: e.target.value})} required />
            <input placeholder={t.placeholders.merchant} className="border p-2 rounded bg-gray-100" value={newOffer.merchantName} readOnly />
            
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1 ml-1">{t.placeholders.uploadImage}</label>
              <input type="file" accept="image/*" onChange={handleImageUpload} className="border p-2 rounded text-sm" />
              {isUploading && <span className="text-xs text-sea-600 animate-pulse mt-1">{t.uploading}</span>}
              {newOffer.imageUrl && !isUploading && (
                <div className="mt-2 relative w-20 h-20">
                  <img src={safeImageUrl(newOffer.imageUrl) || ''} alt="Preview" className="w-full h-full object-cover rounded border border-gray-200" />
                  <button type="button" onClick={() => setNewOffer(prev => ({...prev, imageUrl: ''}))} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs shadow">×</button>
                </div>
              )}
            </div>
            
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1 ml-1">{t.placeholders.validFrom}</label>
              <input type="date" className="border p-2 rounded" value={newOffer.validFrom || ''} onChange={e => setNewOffer({...newOffer, validFrom: e.target.value})} />
            </div>
            
            <div className="flex flex-col">
              <label className="text-xs text-gray-500 mb-1 ml-1">{t.placeholders.validUntil}</label>
              <input type="date" className="border p-2 rounded" value={newOffer.validUntil} onChange={e => setNewOffer({...newOffer, validUntil: e.target.value})} required />
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
            </div>

            <div className="md:col-span-2">
              <label className="text-xs text-gray-500 mb-1 ml-1">{t.placeholders.categories}</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {categoriesList.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleCategory(cat)}
                    className={`px-3 py-1 rounded-full text-xs font-medium border transition-colors ${
                      (newOffer.categories || []).includes(cat)
                        ? 'bg-sea-100 text-sea-700 border-sea-200'
                        : 'bg-white text-gray-500 border-gray-200 hover:border-sea-200'
                    }`}
                  >
                    {tCats[cat]}
                  </button>
                ))}
              </div>
            </div>

            <textarea placeholder={t.placeholders.desc} className="border p-2 rounded md:col-span-2" rows={3} value={newOffer.description} onChange={e => setNewOffer({...newOffer, description: e.target.value})} />
          </div>
          <button type="submit" disabled={isUploading} className={`mt-4 px-6 py-2 rounded-lg font-bold text-white ${isUploading ? 'bg-gray-400 cursor-not-allowed' : 'bg-sand-500 hover:bg-sand-400'}`}>{t.save}</button>
        </form>
      )}

      <div className="bg-white rounded-xl shadow overflow-hidden">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.tableOffer}</th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t.tableMerchant}</th>
              <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t.tableActions}</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {offers.map(offer => (
              <tr key={offer.id} className={!offer.isActive ? 'opacity-60 bg-gray-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <img src={safeImageUrl(offer.imageUrl) || 'https://picsum.photos/40/40'} alt="" className="w-10 h-10 rounded-full mr-3 object-cover bg-gray-100" />
                    <div>
                      <div className="text-sm font-medium text-gray-900">{offer.title}</div>
                      <div className="text-sm text-gray-500">{offer.discount}</div>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{offer.merchantName}</td>
                <td className="px-6 py-4 whitespace-nowrap text-center">
                  <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${offer.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                    {offer.isActive ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                  <div className="flex justify-end gap-2 items-center">
                    <button type="button" onClick={() => handleEdit(offer)} className="p-2 text-blue-600 hover:text-blue-900 hover:bg-blue-50 rounded cursor-pointer" title={t.tableActions}><IconFileText className="w-5 h-5" /></button>
                    <button type="button" onClick={() => handleDelete(offer.id)} className="p-2 text-red-600 hover:text-red-900 hover:bg-red-50 rounded cursor-pointer" title={t.confirmDelete}><IconTrash className="w-5 h-5" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-10 bg-white rounded-xl shadow overflow-hidden border border-sea-100">
        <div className="px-6 py-4 bg-sea-50 border-b border-sea-100">
          <h3 className="text-lg font-bold text-sea-900">{t.customersTitle}</h3>
          <p className="text-sm text-gray-600 mt-1">{t.customersDesc}</p>
        </div>
        {consumers.length === 0 ? (
          <p className="p-6 text-gray-500 text-sm">{t.noCustomers}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.colEmail}</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase">{t.colCoupons}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">{t.colLast}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {consumers.map((row, i) => (
                  <tr key={row.email} className={i < 3 ? 'bg-sand-50/80' : ''}>
                    <td className="px-6 py-3 text-sm text-gray-900 font-medium">{row.email}</td>
                    <td className="px-6 py-3 text-sm text-center text-sea-700 font-bold">{row.couponCount}</td>
                    <td className="px-6 py-3 text-sm text-gray-600">
                      {row.lastCouponAt
                        ? new Date(row.lastCouponAt).toLocaleString(lang === 'pt' ? 'pt-BR' : lang === 'es' ? 'es-ES' : 'en-US')
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
  <div className="max-w-4xl mx-auto p-6 space-y-12 animate-fadeIn">
    <div className="text-center">
      <h2 className="text-3xl font-bold text-sea-900 mb-4">{t.title}</h2>
      <p className="text-gray-600 max-w-2xl mx-auto">
        {t.description}
      </p>
    </div>

    <div className="grid md:grid-cols-2 gap-8">
      <div className="bg-white p-8 rounded-2xl shadow-lg border border-sea-50 hover:shadow-xl transition-shadow">
        <div className="w-16 h-16 bg-sea-100 rounded-full flex items-center justify-center text-sea-600 mb-6 mx-auto">
          <IconPalm className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{t.touristTitle}</h3>
        <ul className="space-y-4">
          {t.touristSteps.map((step, index) => (
            <li key={index} className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-sea-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{index + 1}</span>
              <span className="text-gray-600">{step}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="bg-white p-8 rounded-2xl shadow-lg border border-sea-50 hover:shadow-xl transition-shadow">
        <div className="w-16 h-16 bg-sand-100 rounded-full flex items-center justify-center text-sand-600 mb-6 mx-auto">
          <IconCamera className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-4 text-center">{t.merchantTitle}</h3>
        <ul className="space-y-4">
          {t.merchantSteps.map((step, index) => (
            <li key={index} className="flex gap-3 items-start">
              <span className="flex-shrink-0 w-6 h-6 bg-sand-500 text-white rounded-full flex items-center justify-center text-xs font-bold mt-0.5">{index + 1}</span>
              <span className="text-gray-600">{step}</span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  </div>
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
  const [view, setView] = useState('home');
  const [offers, setOffers] = useState<Offer[]>([]);
  const [selectedOffer, setSelectedOffer] = useState<Offer | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [legalModal, setLegalModal] = useState<'terms' | 'privacy' | null>(null);
  const [lang, setLang] = useState<Language>('pt');
  const [user, setUser] = useState<CompanyUser | null>(null);
  const [merchantTab, setMerchantTab] = useState<'offers' | 'scanner'>('offers');
  const [selectedCategories, setSelectedCategories] = useState<Category[]>([]);
  const t = translations[lang];
  const tCats = translations[lang].categories;

  useEffect(() => {
    const load = async () => setOffers(await getPublicOffers());
    load();
    
    const unsubscribe = subscribeToAuthChanges((u) => {
      setUser(u);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await logoutCompany();
    setUser(null);
    setView('home');
  };

  const filteredOffers = offers.filter(offer => {
    const now = new Date().toISOString().split('T')[0];
    if (offer.validUntil < now) return false;
    if (offer.validFrom && offer.validFrom > now) return false;
    if (!offer.isActive) return false;
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
              {filteredOffers.length > 0 ? (
                filteredOffers.map(offer => (
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
              />
            )}
          </>
        )}

        {view === 'merchant' && (
          !user ? (
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
                <AdminPanel lang={lang} user={user} />
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