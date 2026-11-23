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
    iosInstallTitle: "Recevoir l'alerte même écran verrouillé",
    iosInstallText: "Sur iPhone, ajoutez MH Bip à l'écran d'accueil : vous serez prévenu en temps réel, même si l'écran est verrouillé.",
    iosInstallBtn: 'Comment faire ?',
    guideTitle: "Ajouter à l'écran d'accueil",
    guideSafari: "Utilisez Safari. Si cette page est ouverte dans une autre application (Instagram, Facebook…), touchez « Ouvrir dans Safari » d'abord.",
    guideStep1: "Touchez le bouton Partager (un carré avec une flèche ↑) en bas de l'écran. S'il n'est pas visible, touchez d'abord « ••• ».",
    guideStep2: "Faites défiler le menu et touchez « Sur l'écran d'accueil ».",
    guideStep3: 'Touchez « Ajouter » en haut à droite.',
    guideStep4: "Fermez Safari et ouvrez l'icône MH Bip depuis votre écran d'accueil.",
    guideStep5: "Entrez votre numéro de ticket, puis touchez « Autoriser » quand l'iPhone demande d'envoyer des notifications.",
    guideClose: 'Fermer',
    notifEnable: 'Activer les notifications',
    notifOn: 'Notifications activées : vous serez prévenu même écran verrouillé.',
    notifDenied: 'Notifications bloquées. Ouvrez Réglages › Notifications › MH Bip pour les autoriser.',
    notifInstalledHint: "Entrez votre numéro, puis touchez « Autoriser » pour recevoir l'alerte même écran verrouillé.",
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
    iosInstallTitle: 'استلم التنبيه حتى والشاشة مقفلة',
    iosInstallText: 'على الآيفون، أضف MH Bip إلى الشاشة الرئيسية لتصلك الإشعارات فوراً حتى والشاشة مقفلة.',
    iosInstallBtn: 'كيف؟',
    guideTitle: 'الإضافة إلى الشاشة الرئيسية',
    guideSafari: 'استعمل Safari. إذا كانت الصفحة مفتوحة داخل تطبيق آخر (إنستغرام، فيسبوك…) اضغط «فتح في Safari» أولاً.',
    guideStep1: 'اضغط زر المشاركة (مربع بداخله سهم ↑) أسفل الشاشة. إن لم يظهر، اضغط «•••» أولاً.',
    guideStep2: 'مرّر القائمة للأسفل واضغط «إضافة إلى الشاشة الرئيسية».',
    guideStep3: 'اضغط «إضافة» في أعلى الشاشة.',
    guideStep4: 'أغلق Safari وافتح أيقونة MH Bip من الشاشة الرئيسية.',
    guideStep5: 'أدخل رقم تذكرتك ثم اضغط «سماح» عندما يطلب الآيفون إرسال الإشعارات.',
    guideClose: 'إغلاق',
    notifEnable: 'تفعيل الإشعارات',
    notifOn: 'الإشعارات مفعّلة: ستصلك رسالة حتى والشاشة مقفلة.',
    notifDenied: 'الإشعارات محظورة. افتح الإعدادات › الإشعارات › MH Bip للسماح بها.',
    notifInstalledHint: 'أدخل رقمك ثم اضغط «سماح» لتصلك الإشعارات حتى والشاشة مقفلة.',
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
