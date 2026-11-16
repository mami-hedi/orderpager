import { useEffect, useState } from 'react';
import './landing.css';

// À renseigner avant la mise en ligne (laisser vide pour masquer le bouton).
// WhatsApp : numéro international sans "+" ni espaces, ex. '21612345678'.
const CONTACT = {
  whatsapp: '21658146177',
  email: '',
};

const PRICE = 39; // DT / mois
const TRIAL_DAYS = 10;

const Check = ({ color = '#1e6b4f', size = 18 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
);
const Bell = ({ size = 22, color = '#fff', sw = 2.2 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>
);

const STEPS = [
  ['Le client paie à la caisse', 'Il reçoit son ticket habituel, avec son numéro de commande.'],
  ['Il scanne le QR code', "Le poster est collé au comptoir. L'appareil photo du téléphone suffit."],
  ['Il saisit son numéro', "Une seule case à remplir, puis il s'assoit ou patiente tranquillement."],
  ['Vous appuyez sur « Prête »', 'Son téléphone sonne et vibre. Il vient chercher sa commande.'],
];

const FEATURES = [
  ['Zéro matériel', 'Un poster à imprimer et un écran que vous avez déjà : ordinateur, tablette ou téléphone au comptoir.'],
  ['Un écran comptoir très simple', 'Les commandes apparaissent toutes seules. Une touche « Prête » et c’est fait.'],
  ['Vous savez qui attend', 'Chaque commande indique si le client la suit sur son téléphone. Sinon, vous l’appelez à voix haute.'],
  ['Les erreurs se corrigent', 'Mauvais numéro tapé par le client ou par vous : un bouton pour modifier ou annuler, sans embrouille.'],
  ['En français et en arabe', 'La page client s’affiche dans la langue de chacun, de droite à gauche en arabe.'],
  ['Peu de données gardées', 'Aucun nom ni téléphone demandé au client. Les commandes sont effacées automatiquement après 3 jours.'],
];

const FAQ = [
  ['Mes clients doivent-ils installer une application ?', 'Non. Le QR code ouvre une page web directement dans le navigateur du téléphone. Aucun compte, aucun téléchargement.'],
  ['Le téléphone sonne-t-il écran éteint ?', 'Sur Android, oui : le client reçoit une notification, même écran verrouillé, s’il l’accepte. Sur iPhone, la notification écran éteint demande d’ajouter la page à l’écran d’accueil ; sinon la sonnerie fonctionne tant que la page reste ouverte, et l’écran est maintenu allumé pendant l’attente. Dans tous les cas, vous pouvez toujours appeler le numéro à voix haute.'],
  ['Et si le client n’a pas d’Internet ?', 'Il lui faut une connexion, ses données mobiles ou le Wi-Fi de votre établissement. Sur votre écran comptoir, vous voyez quels clients suivent leur commande : les autres, vous les appelez à voix haute comme aujourd’hui.'],
  ['Que se passe-t-il si quelqu’un se trompe de numéro ?', 'Le client peut modifier son numéro depuis son écran d’attente. De votre côté, après avoir appuyé sur « Prête », un bouton Annuler remet la commande en préparation et arrête la sonnerie.'],
  ['Que faut-il pour démarrer ?', 'Un appareil avec navigateur au comptoir et une imprimante pour le poster. Nous créons votre compte à partir du nom de votre restaurant, vous recevez vos accès et votre poster QR : vous pouvez commencer le jour même.'],
  ['Que deviennent les commandes passées ?', 'Les numéros repartent de zéro chaque jour, et les commandes sont supprimées automatiquement après 3 jours. Nous ne demandons aucune information personnelle à vos clients.'],
];

export default function Landing() {
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const prev = document.title;
    document.title = 'MH Bip – Fini les bippers, le téléphone de vos clients sonne';
    return () => { document.title = prev; };
  }, []);

  const wa = CONTACT.whatsapp
    ? `https://wa.me/${CONTACT.whatsapp}?text=${encodeURIComponent('Bonjour, je voudrais essayer MH Bip pour mon restaurant.')}`
    : null;
  const mail = CONTACT.email ? `mailto:${CONTACT.email}?subject=${encodeURIComponent('Essai MH Bip')}` : null;

  const closeMenu = () => setMenuOpen(false);

  return (
    <div className="lp">
      <header>
        <div className="wrap">
          <a className="logo" href="#haut" onClick={closeMenu}>
            <span><Bell /></span>MH Bip
          </a>

          <button
            type="button"
            className="burger"
            aria-label={menuOpen ? 'Fermer le menu' : 'Ouvrir le menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((o) => !o)}
          >
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {menuOpen ? (
                <path d="M18 6 6 18M6 6l12 12" />
              ) : (
                <path d="M4 7h16M4 12h16M4 17h16" />
              )}
            </svg>
          </button>

          <nav aria-label="Navigation principale" className={menuOpen ? 'open' : ''}>
            <a href="#comment" onClick={closeMenu}>Comment ça marche</a>
            <a href="#avantages" onClick={closeMenu}>Avantages</a>
            <a href="#tarif" onClick={closeMenu}>Tarif</a>
            <a href="#questions" onClick={closeMenu}>Questions</a>
            <a className="cta" href="#contact" onClick={closeMenu}>Essai gratuit</a>
          </nav>
        </div>
      </header>

      <main>
        <section id="haut" className="wrap hero">
          <div className="hero-text">
            <span className="tag">Pour restaurants, cafés et fast-foods</span>
            <h1>Fini les bippers. Le téléphone de vos clients sonne quand la commande est prête.</h1>
            <p>MH Bip remplace les bippers par un simple QR code. Votre client scanne, saisit son numéro de ticket, et son téléphone sonne dès que vous appuyez sur « Prête ». Rien à acheter, rien à installer.</p>
            <div className="row">
              <a className="btn-lp" href="#contact">Essayer gratuitement</a>
              <a className="btn-lp line" href="#comment">Voir comment ça marche</a>
            </div>
            <ul className="checks">
              <li><Check />Aucune application à télécharger</li>
              <li><Check />Aucun matériel à acheter</li>
              <li><Check />Android et iPhone</li>
            </ul>
          </div>
          <div className="mock" aria-hidden="true">
            <div className="phone">
              <div className="screen">
                <small>Café de la Plage</small>
                <div className="bell"><Bell size={46} color="#1e6b4f" sw={2} /></div>
                <b>Votre commande est prête !</b>
                <span>Ticket n°</span>
                <b className="num">112</b>
                <span>Venez la récupérer au comptoir.</span>
              </div>
            </div>
          </div>
        </section>

        <section className="dark sec">
          <div className="wrap col">
            <div className="col" style={{ gap: 16 }}>
              <h2>Les bippers coûtent, tombent en panne et finissent par disparaître.</h2>
              <p className="lead">Chaque service, vous les distribuez, vous les récupérez, vous les comptez. Et vos clients ont déjà dans la poche l’appareil qu’il vous faut.</p>
            </div>
            <div className="grid g3">
              <div className="dcard"><h3>Un achat à répéter</h3><p>Il faut acheter le lot au départ, puis remplacer ceux qui se perdent ou se cassent.</p></div>
              <div className="dcard"><h3>Piles, recharge, pannes</h3><p>Un bipper déchargé au mauvais moment, c’est un client qui attend sans le savoir.</p></div>
              <div className="dcard"><h3>Des clients qui repartent avec</h3><p>Oubliés sur une table ou emportés par distraction : il faut courir après.</p></div>
            </div>
          </div>
        </section>

        <section id="comment" className="wrap sec col" style={{ gap: 48 }}>
          <div className="col" style={{ gap: 14, maxWidth: 680 }}>
            <span className="eyebrow">Comment ça marche</span>
            <h2>Quatre gestes, aucune explication à donner.</h2>
          </div>
          <div className="grid g4">
            {STEPS.map(([t, d], i) => (
              <div key={t} className={`step${i === 3 ? ' hot' : ''}`}>
                <div className="n">{i + 1}</div>
                <h3>{t}</h3>
                <p>{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="avantages" className="sand sec">
          <div className="wrap col" style={{ gap: 48 }}>
            <div className="col" style={{ gap: 14, maxWidth: 680 }}>
              <span className="eyebrow">Pour votre restaurant</span>
              <h2>Simple pour votre équipe, rassurant pour vos clients.</h2>
            </div>
            <div className="grid g6">
              {FEATURES.map(([t, d]) => (
                <div key={t} className="feat">
                  <i><Check color="#fff" size={22} /></i>
                  <div><h3>{t}</h3><p>{d}</p></div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="wrap sec split">
          <div>
            <span className="eyebrow">Pour vos clients</span>
            <h2>Ils peuvent s’asseoir, discuter, même sortir prendre l’air.</h2>
            <p className="lead">Plus besoin de rester debout devant le comptoir à guetter son numéro. Le client est prévenu au bon moment, et il le sait : un écran clair lui confirme que sa commande est bien suivie.</p>
          </div>
          <div>
            <div className="mini"><h3>Sans application, sans compte</h3><p>Il scanne, tape son numéro, c’est tout.</p></div>
            <div className="mini"><h3>Sonnerie et vibration</h3><p>Impossible de rater l’appel, même dans une salle bruyante.</p></div>
            <div className="mini"><h3>Une erreur de numéro ? Il corrige</h3><p>Un bouton « Mauvais numéro ? Modifier » sur son écran d’attente.</p></div>
          </div>
        </section>

        <section id="tarif" className="sand sec">
          <div className="wrap col center">
            <div className="col" style={{ gap: 14, maxWidth: 640 }}>
              <span className="eyebrow">Tarif</span>
              <h2>Un seul abonnement, tout compris.</h2>
            </div>
            <div className="plan">
              <div>
                <div style={{ fontWeight: 600, color: 'var(--soft)' }}>Abonnement mensuel, par restaurant</div>
                <div className="price">{PRICE} <small>DT / mois</small></div>
              </div>
              <div className="trial">{TRIAL_DAYS} jours d’essai gratuit, sans engagement.</div>
              <ul>
                <li><Check size={20} />Nombre de commandes illimité</li>
                <li><Check size={20} />Poster QR code prêt à imprimer</li>
                <li><Check size={20} />Écran comptoir sur tout appareil avec navigateur</li>
                <li><Check size={20} />Page client à l’adresse de votre restaurant</li>
                <li><Check size={20} />Assistance directe</li>
              </ul>
              <a className="btn-lp" href="#contact">Démarrer mon essai gratuit</a>
            </div>
            <p style={{ maxWidth: 520, color: 'var(--soft)', fontSize: 15 }}>Le paiement se fait directement avec nous, sans carte bancaire en ligne.</p>
          </div>
        </section>

        <section id="questions" className="wrap sec faq">
          <h2>Vos questions, nos réponses.</h2>
          <div className="faqs">
            {FAQ.map(([q, a]) => (
              <details key={q}>
                <summary>{q}<i aria-hidden="true">+</i></summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        <section id="contact" className="final sec">
          <div className="wrap col center" style={{ gap: 28 }}>
            <h2>Prêt à ranger vos bippers ?</h2>
            <p>Écrivez-nous le nom de votre restaurant : nous créons votre compte d’essai et vous le testez pendant {TRIAL_DAYS} jours.</p>
            <div className="row" style={{ justifyContent: 'center' }}>
              {wa && <a className="btn-lp white" href={wa}>Nous écrire sur WhatsApp</a>}
              {mail && <a className="btn-lp line-w" href={mail}>{CONTACT.email}</a>}
              {!wa && !mail && import.meta.env.DEV && (
                <span className="btn-lp white">[Renseignez CONTACT dans Landing.jsx]</span>
              )}
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="wrap">
          <div><strong style={{ color: 'var(--ink)' }}>MH Bip</strong> · un service de MH Digital Solution</div>
          <div>Hammamet, Tunisie</div>
        </div>
      </footer>
    </div>
  );
}
