import React, { useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { translations, Language } from '../src/translations';
import { loginCompany, registerCompany, resetPassword } from '../services/authService';
import { CompanyUser } from '../types';
import { IconEye, IconEyeOff } from './Icons';

interface AuthProps {
  lang: Language;
  onLogin: (user: CompanyUser) => void;
}

export const LoginPanel = ({ lang, onLogin }: AuthProps) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const t = translations[lang].auth;

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      const user = await loginCompany(email, password);
      onLogin(user);
    } catch (err) {
      setError(t.authError);
    }
  };

  if (isRegistering) {
    return <RegisterPanel lang={lang} onLogin={onLogin} onBack={() => setIsRegistering(false)} />;
  }

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl animate-fadeIn">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{t.loginTitle}</h2>
      
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
          <input 
            type="email" 
            required 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sea-500 outline-none"
            value={email}
            onChange={e => setEmail(e.target.value)}
          />
        </div>
        
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.password}</label>
          <input 
            type={showPassword ? "text" : "password"} 
            required 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sea-500 outline-none pr-10"
            value={password}
            onChange={e => setPassword(e.target.value)}
          />
          <button 
            type="button"
            className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>

        <div className="text-right">
          <button type="button" onClick={() => setShowForgot(true)} className="text-sm text-sea-600 hover:underline">
            {t.forgotPassword}
          </button>
        </div>

        <button type="submit" className="w-full bg-sea-600 hover:bg-sea-700 text-white font-bold py-3 rounded-lg transition-colors">
          {t.loginBtn}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        {t.noAccount} <button onClick={() => setIsRegistering(true)} className="text-sea-600 font-bold hover:underline">{t.registerBtn}</button>
      </div>

      {showForgot && <ForgotPasswordModal lang={lang} onClose={() => setShowForgot(false)} />}
    </div>
  );
};

const RegisterPanel = ({ lang, onLogin, onBack }: AuthProps & { onBack: () => void }) => {
  const [formData, setFormData] = useState({
    companyName: '',
    cnpj: '',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const t = translations[lang].auth;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError(t.passwordsDoNotMatch);
      return;
    }

    try {
      const user = await registerCompany(formData.email, formData.password, formData.companyName, formData.cnpj);
      onLogin(user);
    } catch (err) {
      setError(t.authError);
    }
  };

  return (
    <div className="max-w-md mx-auto bg-white p-8 rounded-2xl shadow-xl animate-fadeIn">
      <h2 className="text-2xl font-bold text-gray-900 mb-6 text-center">{t.registerTitle}</h2>
      
      {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm">{error}</div>}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.companyName}</label>
          <input 
            type="text" 
            required 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sea-500 outline-none"
            value={formData.companyName}
            onChange={e => setFormData({...formData, companyName: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.cnpj}</label>
          <input 
            type="text" 
            required 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sea-500 outline-none"
            value={formData.cnpj}
            onChange={e => setFormData({...formData, cnpj: e.target.value})}
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
          <input 
            type="email" 
            required 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sea-500 outline-none"
            value={formData.email}
            onChange={e => setFormData({...formData, email: e.target.value})}
          />
        </div>
        
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.password}</label>
          <input 
            type={showPassword ? "text" : "password"} 
            required 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sea-500 outline-none pr-10"
            value={formData.password}
            onChange={e => setFormData({...formData, password: e.target.value})}
          />
          <button 
            type="button"
            className="absolute right-3 top-9 text-gray-400 hover:text-gray-600"
            onClick={() => setShowPassword(!showPassword)}
          >
            {showPassword ? <IconEyeOff /> : <IconEye />}
          </button>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">{t.confirmPassword}</label>
          <input 
            type={showPassword ? "text" : "password"} 
            required 
            className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sea-500 outline-none"
            value={formData.confirmPassword}
            onChange={e => setFormData({...formData, confirmPassword: e.target.value})}
          />
        </div>

        <button type="submit" className="w-full bg-sea-600 hover:bg-sea-700 text-white font-bold py-3 rounded-lg transition-colors">
          {t.registerBtn}
        </button>
      </form>

      <div className="mt-6 text-center text-sm text-gray-600">
        {t.hasAccount} <button onClick={onBack} className="text-sea-600 font-bold hover:underline">{t.loginBtn}</button>
      </div>
    </div>
  );
};

const ForgotPasswordModal = ({ lang, onClose }: { lang: Language, onClose: () => void }) => {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const t = translations[lang].auth;

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    try {
      await resetPassword(email);
      setSent(true);
    } catch (err) {
      const code = err instanceof FirebaseError ? err.code : '';
      if (code === 'auth/user-not-found') setError(t.resetUserNotFound);
      else setError(t.resetError);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl max-w-md w-full p-8 shadow-2xl relative animate-fadeIn">
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-400 hover:text-gray-600">✕</button>
        <h2 className="text-2xl font-bold text-gray-900 mb-4">{t.resetPassword}</h2>
        
        {sent ? (
          <div className="text-center">
            <p className="text-green-600 mb-4">{t.resetSent}</p>
            <button onClick={onClose} className="bg-sea-600 text-white px-6 py-2 rounded-lg">{t.backToLogin}</button>
          </div>
        ) : (
          <form onSubmit={handleReset} className="space-y-4">
            {error && <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{error}</div>}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">{t.email}</label>
              <input 
                type="email" 
                required 
                className="w-full border border-gray-300 rounded-lg px-4 py-2 focus:ring-2 focus:ring-sea-500 outline-none"
                value={email}
                onChange={e => setEmail(e.target.value)}
              />
            </div>
            <button type="submit" className="w-full bg-sea-600 hover:bg-sea-700 text-white font-bold py-3 rounded-lg transition-colors">
              {t.resetBtn}
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
