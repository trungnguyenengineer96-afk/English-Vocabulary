// Lightweight visual effects (confetti bursts) using plain DOM + CSS so they work
// from anywhere. Disabled when the learner prefers reduced motion.

const COLORS = ['#5b4ae6', '#f15bb5', '#ffd166', '#06d6a0', '#118ab2', '#ff9f1c', '#9b5de5'];

export function motionAllowed(): boolean {
  if (typeof document === 'undefined') return false;
  if (document.documentElement.classList.contains('reduce-motion')) return false;
  return !(typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches);
}

/** Burst confetti from an element (or the top centre of the screen). */
export function confetti(from?: Element | null, opts: { count?: number; spread?: number } = {}): void {
  if (!motionAllowed() || typeof document === 'undefined') return;
  const count = opts.count ?? 18;
  const spread = opts.spread ?? 160;
  const r = from?.getBoundingClientRect();
  const x = r ? r.left + r.width / 2 : window.innerWidth / 2;
  const y = r ? r.top + r.height / 2 : window.innerHeight * 0.25;
  const layer = document.createElement('div');
  layer.className = 'fx-layer';
  layer.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < count; i++) {
    const p = document.createElement('span');
    p.className = `confetti ${i % 3 === 0 ? 'round' : ''}`;
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.6;
    const dist = spread * (0.5 + Math.random() * 0.7);
    p.style.left = `${x}px`;
    p.style.top = `${y}px`;
    p.style.background = COLORS[i % COLORS.length];
    p.style.setProperty('--dx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--dy', `${Math.sin(angle) * dist - spread * 0.4}px`);
    p.style.setProperty('--rot', `${Math.round(Math.random() * 720 - 360)}deg`);
    p.style.animationDelay = `${Math.random() * 80}ms`;
    layer.appendChild(p);
  }
  document.body.appendChild(layer);
  setTimeout(() => layer.remove(), 1400);
}
