/**
 * Tiny canvas confetti — no dependency, self-cleaning, motion-safe.
 * Call from an event handler; it paints above the app for ~1.4s and removes itself.
 */
type BurstOptions = {
  /** Viewport coordinates; defaults to screen centre-ish. */
  x?: number;
  y?: number;
  count?: number;
  /** Fewer, calmer particles for routine actions (logging a set). */
  intensity?: "soft" | "party";
};

const COLORS = ["#ffc83d", "#ff9a4d", "#3de0c6", "#7f9bff", "#b79bff", "#f6f3ea"];

export function burstConfetti(opts: BurstOptions = {}): void {
  if (typeof window === "undefined" || typeof document === "undefined") return;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const party = opts.intensity === "party";
  const count = opts.count ?? (party ? 140 : 26);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = window.innerWidth;
  const h = window.innerHeight;

  const canvas = document.createElement("canvas");
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  canvas.setAttribute("aria-hidden", "true");
  Object.assign(canvas.style, {
    position: "fixed",
    inset: "0",
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: "200",
  });
  document.body.appendChild(canvas);
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    canvas.remove();
    return;
  }
  ctx.scale(dpr, dpr);

  const ox = opts.x ?? w / 2;
  const oy = opts.y ?? h * (party ? 0.4 : 0.6);

  type P = { x: number; y: number; vx: number; vy: number; s: number; r: number; vr: number; c: string; shape: 0 | 1 | 2 };
  const parts: P[] = Array.from({ length: count }, () => {
    const angle = (party ? Math.random() * Math.PI * 2 : -Math.PI / 2 + (Math.random() - 0.5) * 1.8);
    const speed = (party ? 5 + Math.random() * 9 : 3 + Math.random() * 5);
    return {
      x: ox,
      y: oy,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - (party ? 2 : 1),
      s: party ? 5 + Math.random() * 6 : 4 + Math.random() * 4,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.35,
      c: COLORS[Math.floor(Math.random() * COLORS.length)],
      shape: Math.floor(Math.random() * 3) as 0 | 1 | 2,
    };
  });

  const start = performance.now();
  const duration = party ? 2200 : 1300;

  const tick = (now: number) => {
    const t = now - start;
    ctx.clearRect(0, 0, w, h);
    const fade = Math.max(0, 1 - Math.max(0, t - duration * 0.6) / (duration * 0.4));
    for (const p of parts) {
      p.vy += 0.22;
      p.vx *= 0.992;
      p.x += p.vx;
      p.y += p.vy;
      p.r += p.vr;
      ctx.save();
      ctx.globalAlpha = fade;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.r);
      ctx.fillStyle = p.c;
      if (p.shape === 0) ctx.fillRect(-p.s / 2, -p.s / 4, p.s, p.s / 2);
      else if (p.shape === 1) {
        ctx.beginPath();
        ctx.arc(0, 0, p.s / 2.4, 0, Math.PI * 2);
        ctx.fill();
      } else {
        // a tiny khatam diamond
        ctx.beginPath();
        ctx.moveTo(0, -p.s / 2);
        ctx.lineTo(p.s / 2, 0);
        ctx.lineTo(0, p.s / 2);
        ctx.lineTo(-p.s / 2, 0);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
    }
    if (t < duration) requestAnimationFrame(tick);
    else canvas.remove();
  };
  requestAnimationFrame(tick);
}
