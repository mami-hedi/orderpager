import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { api } from '../api.js';

// Poster A4 à imprimer et poser au comptoir (Ctrl/Cmd + P)
export default function Poster() {
  const { slug } = useParams();
  const [shop, setShop] = useState(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    api(`/public/shops/${slug}`).then(setShop).catch(() => setMissing(true));
  }, [slug]);

  if (missing) return <div className="page"><p className="error">Restaurant introuvable.</p></div>;
  if (!shop) return <div className="page"><p className="muted">Chargement…</p></div>;

  const url = `${window.location.origin}/s/${shop.slug}`;

  return (
    <div className="poster">
      <h1>{shop.name}</h1>
      <p className="poster-step">
        1. Payez à la caisse et gardez votre ticket<br />
        2. Scannez ce code<br />
        3. Saisissez le numéro de votre ticket
      </p>
      <p className="poster-step" dir="rtl">
        ادفع عند الصندوق واحتفظ بتذكرتك — امسح الرمز — أدخل رقم تذكرتك
      </p>
      <QRCodeSVG value={url} size={320} level="M" marginSize={2} />
      <p className="poster-bell">🔔 Votre téléphone sonnera quand votre commande sera prête<br />سيرنّ هاتفك عندما يكون طلبك جاهزاً</p>
      <p className="poster-url">{url}</p>
      <button className="btn no-print" onClick={() => window.print()}>Imprimer</button>
    </div>
  );
}
