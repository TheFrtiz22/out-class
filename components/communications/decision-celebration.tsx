'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CelebrationKind } from '@/lib/decision-letters';

/**
 * Acceptance celebration drawn on one canvas overlay (no dependency, no CSS keyframes).
 * Decorative only: aria-hidden, pointer-events none, removed when it finishes.
 * Reduced motion: callers skip autoplay; an explicit replay shows a still sparkle that only fades.
 */
export function prefersReducedMotion() {
 return typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** `play()` starts (or restarts) the overlay; `run` is the key the overlay watches. */
export function useCelebration() {
 const [run, setRun] = useState(0);
 const play = useCallback(() => setRun(value => value + 1), []);
 return { run, play };
}

type Rgb = [number, number, number];
function accentRgb(accent: string): Rgb {
 const match = /^#?([\da-f]{2})([\da-f]{2})([\da-f]{2})$/i.exec(accent);
 return match ? [parseInt(match[1], 16), parseInt(match[2], 16), parseInt(match[3], 16)] : [20, 45, 78];
}
const mix = (a: Rgb, b: Rgb, t: number): Rgb => [0, 1, 2].map(i => Math.round(a[i] + (b[i] - a[i]) * t)) as Rgb;
const rgb = ([r, g, b]: Rgb) => `rgb(${r} ${g} ${b})`;
/** Club accent, its tints, and a warm gold so every club palette reads as celebratory. */
export function celebrationPalette(accent: string) {
 const base = accentRgb(accent), white: Rgb = [255, 255, 255], gold: Rgb = [227, 177, 62], champagne: Rgb = [246, 222, 160];
 return [rgb(base), rgb(mix(base, white, .35)), rgb(mix(base, white, .65)), rgb(gold), rgb(champagne), rgb(mix(gold, white, .4))];
}

type Particle = { x: number; y: number; vx: number; vy: number; size: number; color: string; rotation: number; spin: number; shape: 0 | 1 | 2; life: number; ttl: number; twinkle: number };
type Rocket = { x: number; y: number; vy: number; targetY: number; color: string; launchAt: number; burst: boolean };
const DURATION: Record<Exclude<CelebrationKind, 'none'>, number> = { confetti: 4200, fireworks: 4800, sparkles: 3600 };
const random = (min: number, max: number) => min + Math.random() * (max - min);
const pick = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

function star(ctx: CanvasRenderingContext2D, size: number) {
 ctx.beginPath();
 for (let i = 0; i < 8; i++) { const r = i % 2 ? size * .28 : size; const a = (Math.PI / 4) * i; ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
 ctx.closePath(); ctx.fill();
}

export function Celebration({ kind, accent, run }: { kind: CelebrationKind; accent: string; run: number }) {
 const canvas = useRef<HTMLCanvasElement>(null);
 const [active, setActive] = useState(false);
 useEffect(() => { if (run > 0 && kind !== 'none') setActive(true); }, [run, kind]);
 useEffect(() => {
  const el = canvas.current;
  if (!active || !el || kind === 'none') return;
  const ctx = el.getContext('2d');
  if (!ctx) { setActive(false); return; }
  const dpr = Math.min(window.devicePixelRatio || 1, 2), width = window.innerWidth, height = window.innerHeight;
  el.width = width * dpr; el.height = height * dpr; el.style.width = `${width}px`; el.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const colors = celebrationPalette(accent), reduced = prefersReducedMotion();
  const duration = reduced ? 1400 : DURATION[kind], particles: Particle[] = [], rockets: Rocket[] = [];
  const scale = Math.min(1, Math.max(.55, width / 1100));
  const particle = (p: Partial<Particle>): Particle => ({ x: 0, y: 0, vx: 0, vy: 0, size: 8, color: pick(colors), rotation: random(0, Math.PI * 2), spin: random(-.2, .2), shape: 0, life: 0, ttl: duration, twinkle: random(0, Math.PI * 2), ...p });
  if (reduced) {
   for (let i = 0; i < 48; i++) particles.push(particle({ x: random(0, width), y: random(0, height * .7), size: random(4, 9), shape: 2 }));
  } else if (kind === 'confetti') {
   const count = Math.round(190 * scale);
   for (let i = 0; i < count; i++) {
    const left = i % 2 === 0, angle = -random(Math.PI * .28, Math.PI * .45), speed = random(11, 20) * Math.sqrt(scale);
    particles.push(particle({ x: left ? -10 : width + 10, y: height * random(.62, .82), vx: Math.cos(angle) * speed * (left ? 1 : -1), vy: Math.sin(angle) * speed, size: random(6, 12), shape: Math.random() < .7 ? 0 : 1, life: -random(0, 260) }));
   }
  } else if (kind === 'fireworks') {
   for (let i = 0; i < 7; i++) rockets.push({ x: width * (.12 + (.76 * ((i * 3) % 7)) / 6) + random(-30, 30), y: height + 10, vy: -random(15, 18) * Math.sqrt(height / 800), targetY: height * random(.14, .4), color: pick(colors), launchAt: i * 330 + random(0, 120), burst: false });
  } else {
   const count = Math.round(110 * scale);
   for (let i = 0; i < count; i++) particles.push(particle({ x: random(0, width), y: random(-height * .1, height * .55), vx: random(-.15, .15), vy: random(.25, .9), size: random(4, 11), shape: 2, life: -random(0, 1400), ttl: random(1300, 2200) }));
  }
  let frame = 0, last = performance.now();
  const start = last;
  const tick = (now: number) => {
   const elapsed = now - start, dt = Math.min(32, now - last) / 16.67; last = now;
   const fade = reduced ? 1 - elapsed / duration : Math.min(1, (duration - elapsed) / 900);
   if (kind === 'fireworks' && !reduced) { ctx.globalCompositeOperation = 'destination-out'; ctx.fillStyle = 'rgb(0 0 0 / 22%)'; ctx.fillRect(0, 0, width, height); ctx.globalCompositeOperation = 'source-over'; }
   else ctx.clearRect(0, 0, width, height);
   for (const rocket of rockets) {
    if (rocket.burst || elapsed < rocket.launchAt) continue;
    rocket.y += rocket.vy * dt; rocket.vy *= .985;
    ctx.globalAlpha = Math.max(0, fade); ctx.strokeStyle = rocket.color; ctx.lineWidth = 2.2; ctx.lineCap = 'round'; ctx.beginPath(); ctx.moveTo(rocket.x, rocket.y); ctx.lineTo(rocket.x, rocket.y - rocket.vy * 1.6); ctx.stroke();
    if (rocket.y <= rocket.targetY || rocket.vy > -2) {
     rocket.burst = true;
     const count = Math.round(96 * scale), hue = rocket.color;
     for (let i = 0; i < count; i++) { const a = (Math.PI * 2 * i) / count + random(-.05, .05), speed = random(3, 7.5); particles.push(particle({ x: rocket.x, y: rocket.y, vx: Math.cos(a) * speed, vy: Math.sin(a) * speed, size: random(2.2, 3.8), color: Math.random() < .7 ? hue : pick(colors), shape: 1, ttl: random(1100, 1700), life: 0 })); }
    }
   }
   for (const p of particles) {
    p.life += 16.67 * dt;
    if (p.life < 0 || p.life > p.ttl) continue;
    if (!reduced) {
     if (kind === 'confetti') { p.vx *= .985 ** dt; p.vy = p.vy * .985 ** dt + .32 * dt; p.x += (p.vx + Math.sin(p.twinkle + p.life / 180) * .6) * dt; p.y += p.vy * dt; p.rotation += p.spin * dt; }
     else if (kind === 'fireworks') { p.vx *= .96 ** dt; p.vy = p.vy * .96 ** dt + .07 * dt; p.x += p.vx * dt; p.y += p.vy * dt; }
     else { p.x += p.vx * dt; p.y += p.vy * dt; p.rotation += .01 * dt; }
    }
    const lifeFade = kind === 'confetti' && !reduced ? 1 : Math.sin(Math.min(1, p.life / p.ttl) * Math.PI);
    ctx.globalAlpha = Math.max(0, Math.min(1, fade, kind === 'sparkles' || kind === 'fireworks' || reduced ? lifeFade * (.65 + .35 * Math.sin(p.twinkle + p.life / 90)) : 1));
    ctx.fillStyle = p.color; ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rotation);
    if (p.shape === 0) { ctx.scale(1, Math.cos(p.twinkle + p.life / 140)); ctx.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2); }
    else if (p.shape === 1) { ctx.beginPath(); ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2); ctx.fill(); }
    else star(ctx, p.size);
    ctx.restore();
   }
   ctx.globalAlpha = 1;
   if (elapsed < duration) frame = requestAnimationFrame(tick); else setActive(false);
  };
  frame = requestAnimationFrame(tick);
  return () => { cancelAnimationFrame(frame); ctx.clearRect(0, 0, width, height); };
 }, [active, run, kind, accent]);
 if (!active || kind === 'none') return null;
 return <canvas ref={canvas} className="decision-celebration-canvas" aria-hidden="true" data-celebration={kind} />;
}
