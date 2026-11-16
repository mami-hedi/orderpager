import { createContext, useContext, useEffect, useState } from 'react';
import { storage } from './api.js';

const dict = {
  fr: {
    enterNumber: 'Entrez le numéro de votre ticket',
    numberPlaceholder: 'Ex. 112',
    track: 'Suivre ma commande',
    yourOrder: 'Commande n°',
    preparing: 'En préparation…',
    keepOpen: 'Gardez cette page ouverte. Votre téléphone sonnera quand votre commande sera prête.',
    ready: 'Votre commande est prête !',
    goCounter: 'Rendez-vous au comptoir',
    stopAlarm: 'Arrêter la sonnerie',
    picked: "J'ai récupéré ma commande",
    done: 'Merci, bon appétit !',
    newOrder: 'Suivre une autre commande',
    invalidNumber: 'Numéro invalide',
    genericError: 'Une erreur est survenue, réessayez.',
    shopNotFound: 'Restaurant introuvable. Vérifiez le QR code.',
    wrongNumber: 'Mauvais numéro ? Modifier',
    loading: 'Chargement…',
  },
  ar: {
    enterNumber: 'أدخل رقم تذكرتك',
    numberPlaceholder: 'مثال: 112',
    track: 'تابع طلبي',
    yourOrder: 'طلبك رقم',
    preparing: 'قيد التحضير…',
    keepOpen: 'أبقِ هذه الصفحة مفتوحة. سيرنّ هاتفك عندما يكون طلبك جاهزاً.',
    ready: 'طلبك جاهز!',
    goCounter: 'تفضّل إلى الكاونتر',
    stopAlarm: 'إيقاف الرنين',
    picked: 'استلمت طلبي',
    done: 'شكراً، بالصحة والهناء!',
    newOrder: 'تابع طلباً آخر',
    invalidNumber: 'رقم غير صالح',
    genericError: 'حدث خطأ، حاول مرة أخرى.',
    shopNotFound: 'المطعم غير موجود. تحقق من رمز QR.',
    wrongNumber: 'رقم خاطئ؟ عدّله',
    loading: 'جارٍ التحميل…',
  },
};

const I18nContext = createContext(null);

function initialLang() {
  const saved = storage.get('lang');
  if (saved === 'fr' || saved === 'ar') return saved;
  return (navigator.language || 'fr').toLowerCase().startsWith('ar') ? 'ar' : 'fr';
}

export function I18nProvider({ children }) {
  const [lang, setLangState] = useState(initialLang);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = lang === 'ar' ? 'rtl' : 'ltr';
  }, [lang]);

  const setLang = (l) => {
    storage.set('lang', l);
    setLangState(l);
  };
  const t = (key) => dict[lang][key] ?? key;

  return <I18nContext.Provider value={{ lang, setLang, t }}>{children}</I18nContext.Provider>;
}

export const useI18n = () => useContext(I18nContext);
