// Sonnerie générée avec WebAudio (aucun fichier audio à héberger).
// unlockAudio() doit être appelé dans un geste utilisateur (clic sur "Suivre ma commande"),
// sinon iOS/Android bloquent le son.
let ctx = null;
let timer = null;

export function unlockAudio() {
  try {
    // iPhone (Safari 16.4+) : sans cela, le mode silencieux coupe totalement le son de la page
    if (navigator.audioSession) navigator.audioSession.type = 'playback';
  } catch {
    // non supporté
  }
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    ctx = ctx || new AudioCtx();
    // Sur iOS l'état peut aussi être « interrupted » (écran verrouillé, appel, etc.)
    if (ctx.state !== 'running') ctx.resume();
  } catch {
    // audio indisponible
  }
}

// Au retour sur la page (écran déverrouillé, retour depuis une notification), on réveille le son
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && ctx && ctx.state !== 'running') ctx.resume().catch(() => {});
  });
}

function beep(freq, start, duration) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.7, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(start);
  osc.stop(start + duration + 0.05);
}

function ring() {
  if (ctx) {
    if (ctx.state !== 'running') ctx.resume().catch(() => {});
    const t = ctx.currentTime;
    beep(880, t, 0.18);
    beep(1175, t + 0.25, 0.18);
    beep(880, t + 0.5, 0.18);
    beep(1175, t + 0.75, 0.3);
  }
  if (navigator.vibrate) navigator.vibrate([300, 150, 300, 150, 600]);
}

export function startAlarm() {
  stopAlarm();
  ring();
  timer = setInterval(ring, 2500);
}

export function stopAlarm() {
  if (timer) clearInterval(timer);
  timer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}
