"use client";

import { useEffect, useRef } from "react";

/*
 * Fond de la page de connexion : halo vert sombre (comme l'intro TwinsChat) et ciel étoilé animé.
 * Trois couches dessinées sur un canvas :
 *  - poussière d'étoiles qui scintille (avec un léger effet de profondeur sous la souris) ;
 *  - quelques halos flous verts (bokeh) qui dérivent lentement ;
 *  - une constellation : des étoiles brillantes qui dérivent et se relient quand elles sont proches,
 *    et se tournent vers le pointeur de la souris.
 * Une étoile filante passe de temps en temps. Si l'utilisateur préfère réduire les animations,
 * le ciel est dessiné une seule fois, immobile.
 */

type Dust = { x: number; y: number; r: number; base: number; phase: number; speed: number; green: boolean };
type Node = { x: number; y: number; vx: number; vy: number; r: number; phase: number; green: boolean; ox: number; oy: number };
type Bokeh = { x: number; y: number; r: number; vx: number; vy: number; alpha: number };
type Meteor = { x: number; y: number; vx: number; vy: number; life: number; max: number };

const LINK = 140; // distance max (px) entre deux étoiles reliées
const POINTER_LINK = 180; // rayon d'influence du pointeur
const MAX_DT = 0.05;

const rand = (min: number, max: number) => min + Math.random() * (max - min);
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

/** Petite image de halo réutilisée pour chaque étoile (bien plus rapide qu'un dégradé par étoile). */
function makeGlow(rgb: string, stops: [number, number][]) {
  const size = 64;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = size;
  const g = canvas.getContext("2d");
  if (g) {
    const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
    for (const [at, alpha] of stops) grad.addColorStop(at, `rgba(${rgb},${alpha})`);
    g.fillStyle = grad;
    g.fillRect(0, 0, size, size);
  }
  return canvas;
}

export function StarfieldBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const starGlow = makeGlow("255,255,255", [[0, 1], [0.2, 0.5], [1, 0]]);
    const greenGlow = makeGlow("74,222,128", [[0, 1], [0.2, 0.45], [1, 0]]);
    // Halo vert de la palette (#22c55e) autour des étoiles de la constellation
    const auraGlow = makeGlow("34,197,94", [[0, 0.9], [0.25, 0.4], [0.6, 0.12], [1, 0]]);
    const bokehGlow = makeGlow("34,197,94", [[0, 0.6], [0.55, 0.24], [1, 0]]);

    let w = 0;
    let h = 0;
    let dust: Dust[] = [];
    let nodes: Node[] = [];
    let bokeh: Bokeh[] = [];
    let meteor: Meteor | null = null;
    let nextMeteor = rand(3, 7);
    let time = 0;
    let last = performance.now();
    let raf = 0;
    const pointer = { x: 0, y: 0, active: false };
    const parallax = { x: 0, y: 0 };

    function populate() {
      const area = w * h;
      dust = Array.from({ length: clamp(Math.floor(area / 4200), 90, 340) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() < 0.85 ? rand(0.35, 0.9) : rand(0.9, 1.5),
        base: rand(0.25, 0.9),
        phase: Math.random() * Math.PI * 2,
        speed: rand(0.6, 2.2),
        green: Math.random() < 0.35,
      }));
      nodes = Array.from({ length: clamp(Math.floor(area / 17000), 22, 85) }, () => {
        const angle = Math.random() * Math.PI * 2;
        const speed = rand(4, 11);
        return {
          x: Math.random() * w,
          y: Math.random() * h,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: rand(0.9, 1.7),
          phase: Math.random() * Math.PI * 2,
          green: Math.random() < 0.45,
          ox: 0,
          oy: 0,
        };
      });
      bokeh = Array.from({ length: clamp(Math.floor(area / 80000), 6, 18) }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: rand(10, 34),
        vx: rand(-3, 3),
        vy: rand(-2.5, 1),
        alpha: rand(0.08, 0.22),
      }));
    }

    function resize() {
      if (!canvas || !ctx) return;
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(rect.width * dpr);
      canvas.height = Math.round(rect.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      // Sur mobile, la barre d'adresse ne change que la hauteur : on garde alors le même ciel.
      const widthChanged = Math.abs(rect.width - w) > 1;
      w = rect.width;
      h = rect.height;
      if (widthChanged) populate();
      if (reduceMotion.matches) draw(0);
    }

    const wrap = (v: number, max: number, margin: number) =>
      v < -margin ? max + margin : v > max + margin ? -margin : v;

    function draw(dt: number) {
      if (!ctx) return;
      time += dt;
      ctx.clearRect(0, 0, w, h);

      // Profondeur : la poussière et les halos glissent légèrement à l'opposé de la souris.
      const targetX = pointer.active ? pointer.x / w - 0.5 : 0;
      const targetY = pointer.active ? pointer.y / h - 0.5 : 0;
      const ease = Math.min(1, dt * 2.5);
      parallax.x += (targetX - parallax.x) * ease;
      parallax.y += (targetY - parallax.y) * ease;

      // Halos flous
      for (const b of bokeh) {
        b.x = wrap(b.x + b.vx * dt, w, b.r);
        b.y = wrap(b.y + b.vy * dt, h, b.r);
        const x = b.x - parallax.x * 26;
        const y = b.y - parallax.y * 26;
        ctx.globalAlpha = b.alpha * (0.75 + 0.25 * Math.sin(time * 0.4 + b.r));
        ctx.drawImage(bokehGlow, x - b.r, y - b.r, b.r * 2, b.r * 2);
      }

      // Poussière d'étoiles qui scintille
      for (const s of dust) {
        const twinkle = 0.55 + 0.45 * Math.sin(time * s.speed + s.phase);
        const x = s.x - parallax.x * 8;
        const y = s.y - parallax.y * 8;
        ctx.globalAlpha = s.base * twinkle;
        if (s.r > 0.9) {
          const g = s.r * 7;
          ctx.drawImage(s.green ? greenGlow : starGlow, x - g / 2, y - g / 2, g, g);
        }
        ctx.fillStyle = s.green ? "#86efac" : "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, s.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Constellation : déplacement, attirance douce vers le pointeur
      for (const n of nodes) {
        n.x = wrap(n.x + n.vx * dt, w, 20);
        n.y = wrap(n.y + n.vy * dt, h, 20);
        let tx = 0;
        let ty = 0;
        if (pointer.active) {
          const dx = pointer.x - n.x;
          const dy = pointer.y - n.y;
          const d = Math.hypot(dx, dy);
          if (d < POINTER_LINK) {
            const pull = (1 - d / POINTER_LINK) * 0.18;
            tx = dx * pull;
            ty = dy * pull;
          }
        }
        const k = Math.min(1, dt * 3);
        n.ox += (tx - n.ox) * k;
        n.oy += (ty - n.oy) * k;
      }

      // Liens lumineux : un trait large et diffus (lueur) puis un trait fin, en mode additif
      // pour que les croisements s'illuminent en vert.
      ctx.globalCompositeOperation = "lighter";
      ctx.strokeStyle = "#22c55e";
      for (let i = 0; i < nodes.length; i++) {
        const a = nodes[i];
        const ax = a.x + a.ox;
        const ay = a.y + a.oy;
        for (let j = i + 1; j < nodes.length; j++) {
          const b = nodes[j];
          const dx = ax - (b.x + b.ox);
          const dy = ay - (b.y + b.oy);
          const d2 = dx * dx + dy * dy;
          if (d2 > LINK * LINK) continue;
          const strength = 1 - Math.sqrt(d2) / LINK;
          ctx.beginPath();
          ctx.moveTo(ax, ay);
          ctx.lineTo(b.x + b.ox, b.y + b.oy);
          ctx.lineWidth = 3.5;
          ctx.globalAlpha = strength * 0.12;
          ctx.stroke();
          ctx.lineWidth = 0.8;
          ctx.globalAlpha = strength * 0.5;
          ctx.stroke();
        }
      }

      // Fils vers le pointeur
      if (pointer.active) {
        ctx.strokeStyle = "#4ade80";
        for (const n of nodes) {
          const x = n.x + n.ox;
          const y = n.y + n.oy;
          const d = Math.hypot(pointer.x - x, pointer.y - y);
          if (d > POINTER_LINK) continue;
          const strength = 1 - d / POINTER_LINK;
          ctx.beginPath();
          ctx.moveTo(x, y);
          ctx.lineTo(pointer.x, pointer.y);
          ctx.lineWidth = 4;
          ctx.globalAlpha = strength * 0.14;
          ctx.stroke();
          ctx.lineWidth = 0.9;
          ctx.globalAlpha = strength * 0.6;
          ctx.stroke();
        }
      }

      // Étoiles de la constellation : aura verte + cœur lumineux
      for (const n of nodes) {
        const x = n.x + n.ox;
        const y = n.y + n.oy;
        const near = pointer.active ? Math.max(0, 1 - Math.hypot(pointer.x - x, pointer.y - y) / POINTER_LINK) : 0;
        const twinkle = 0.65 + 0.35 * Math.sin(time * 1.3 + n.phase);
        const aura = n.r * (22 + near * 14);
        ctx.globalAlpha = Math.min(1, twinkle * 0.55 + near * 0.35);
        ctx.drawImage(auraGlow, x - aura / 2, y - aura / 2, aura, aura);
        const g = n.r * (8 + near * 6);
        ctx.globalAlpha = Math.min(1, twinkle * 0.8 + near * 0.4);
        ctx.drawImage(n.green ? greenGlow : starGlow, x - g / 2, y - g / 2, g, g);
        ctx.globalAlpha = Math.min(1, twinkle + near);
        ctx.fillStyle = n.green ? "#bbf7d0" : "#ffffff";
        ctx.beginPath();
        ctx.arc(x, y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // Étoile filante occasionnelle
      if (dt > 0) {
        nextMeteor -= dt;
        if (!meteor && nextMeteor <= 0) {
          const dir = Math.random() < 0.5 ? -1 : 1;
          const speed = rand(650, 900);
          const angle = rand(0.35, 0.6); // descente douce
          meteor = {
            x: rand(w * 0.15, w * 0.85),
            y: rand(-10, h * 0.35),
            vx: Math.cos(angle) * speed * dir,
            vy: Math.sin(angle) * speed,
            life: 0,
            max: rand(0.7, 1.1),
          };
          nextMeteor = rand(7, 14);
        }
      }
      if (meteor) {
        meteor.life += dt;
        meteor.x += meteor.vx * dt;
        meteor.y += meteor.vy * dt;
        const fade = Math.sin(Math.PI * Math.min(1, meteor.life / meteor.max));
        const len = 150 / Math.hypot(meteor.vx, meteor.vy);
        const tailX = meteor.x - meteor.vx * len;
        const tailY = meteor.y - meteor.vy * len;
        const grad = ctx.createLinearGradient(meteor.x, meteor.y, tailX, tailY);
        grad.addColorStop(0, "rgba(255,255,255,0.9)");
        grad.addColorStop(0.3, "rgba(134,239,172,0.35)");
        grad.addColorStop(1, "rgba(134,239,172,0)");
        ctx.globalAlpha = fade;
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1.3;
        ctx.beginPath();
        ctx.moveTo(meteor.x, meteor.y);
        ctx.lineTo(tailX, tailY);
        ctx.stroke();
        ctx.drawImage(starGlow, meteor.x - 6, meteor.y - 6, 12, 12);
        if (meteor.life >= meteor.max) meteor = null;
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";
    }

    function frame(now: number) {
      const dt = Math.min(MAX_DT, (now - last) / 1000);
      last = now;
      draw(dt);
      raf = requestAnimationFrame(frame);
    }

    function start() {
      cancelAnimationFrame(raf);
      if (reduceMotion.matches) {
        draw(0);
        return;
      }
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    const onPointerMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      pointer.x = e.clientX;
      pointer.y = e.clientY;
      pointer.active = true;
    };
    const onPointerLeave = () => {
      pointer.active = false;
    };

    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    resize();
    start();

    window.addEventListener("pointermove", onPointerMove, { passive: true });
    document.documentElement.addEventListener("mouseleave", onPointerLeave);
    reduceMotion.addEventListener("change", start);

    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      window.removeEventListener("pointermove", onPointerMove);
      document.documentElement.removeEventListener("mouseleave", onPointerLeave);
      reduceMotion.removeEventListener("change", start);
    };
  }, []);

  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 overflow-hidden bg-[#05090b]">
      {/* Halo vert sombre derrière le logo et la carte, comme sur l'intro */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 38%, rgba(26,84,62,0.55), rgba(12,36,30,0.35) 45%, transparent 78%)",
        }}
      />
      <canvas ref={canvasRef} className="absolute inset-0 size-full" />
      {/* Vignette : bords plus sombres pour garder l'œil au centre */}
      <div
        className="absolute inset-0"
        style={{ background: "radial-gradient(ellipse 85% 75% at 50% 45%, transparent 55%, rgba(0,0,0,0.55) 100%)" }}
      />
    </div>
  );
}
