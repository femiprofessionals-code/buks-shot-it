"use client";

import { useEffect, useRef, useState } from "react";

/**
 * A camera-aperture cursor for mouse and trackpad users.
 * - a small dot sits exactly at the pointer, so clicking stays precise
 * - the aperture follows with a soft delay and turns as the mouse moves, like a focus ring
 * - over links and buttons the blades open; over photographs they open wide and show "View"
 * - pressing closes the blades like a shutter
 * Off on touch screens, when reduced motion is requested, and over text fields (the normal cursor returns there).
 */

const BLADES = 6;
const R = 22; // aperture radius in px (viewBox units = px)

type Mode = "idle" | "link" | "view" | "text" | "hidden";

const GAP: Record<Mode, number> = { idle: 6.5, link: 12, view: 15.5, text: 6.5, hidden: 6.5 };
const SCALE: Record<Mode, number> = { idle: 1, link: 1.2, view: 1.9, text: 0.6, hidden: 0.6 };

function modeFor(el: Element | null): Mode {
  if (!el) return "idle";
  if (el.closest("input:not([type=checkbox]):not([type=radio]):not([type=submit]):not([type=button]), textarea, select, [contenteditable=true]")) return "text";
  const interactive = el.closest("a, button, summary, label, [role=button], [data-cursor]");
  const cursorHint = el.closest("[data-cursor]")?.getAttribute("data-cursor");
  if (cursorHint === "view") return "view";
  if (el.tagName === "IMG" && interactive) return "view";
  if (interactive) return "link";
  return "idle";
}

export function ApertureCursor() {
  const [enabled, setEnabled] = useState(false);
  const ring = useRef<HTMLDivElement>(null);
  const dot = useRef<HTMLDivElement>(null);
  const svg = useRef<SVGSVGElement>(null);
  const label = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)");
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setEnabled(fine.matches && !still.matches);
    update();
    fine.addEventListener("change", update);
    still.addEventListener("change", update);
    return () => {
      fine.removeEventListener("change", update);
      still.removeEventListener("change", update);
    };
  }, []);

  useEffect(() => {
    if (!enabled) return;
    const root = document.documentElement;
    root.classList.add("aperture-cursor");

    const target = { x: -100, y: -100 };
    const pos = { x: -100, y: -100 };
    let spin = 0;
    let gap = GAP.idle;
    let scale = SCALE.idle;
    let mode: Mode = "hidden";
    let pressed = false;
    let visible = false;
    let raf = 0;
    let last = performance.now();

    const draw = (now: number) => {
      const dt = Math.min(64, now - last) / 16.67; // frames at 60 fps
      last = now;
      const k = 1 - Math.pow(1 - 0.18, dt);
      const dx = target.x - pos.x;
      const dy = target.y - pos.y;
      pos.x += dx * k;
      pos.y += dy * k;
      // Turn with movement, like a focus ring, plus a very slow drift.
      spin += (Math.hypot(dx, dy) * 0.35 + 0.08) * dt;

      const wantGap = pressed ? 0.5 : GAP[mode];
      const wantScale = (pressed ? 0.85 : 1) * SCALE[mode];
      const kk = 1 - Math.pow(1 - (pressed ? 0.45 : 0.2), dt);
      gap += (wantGap - gap) * kk;
      scale += (wantScale - scale) * kk;

      if (ring.current) {
        ring.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${scale})`;
        ring.current.style.opacity = visible && mode !== "text" && mode !== "hidden" ? "1" : "0";
      }
      if (svg.current) {
        svg.current.style.setProperty("--gap", `${gap}px`);
        svg.current.style.setProperty("--spin", `${spin}deg`);
      }
      if (label.current) label.current.style.opacity = mode === "view" && !pressed ? "1" : "0";
      if (dot.current) {
        dot.current.style.transform = `translate3d(${target.x}px, ${target.y}px, 0) translate(-50%, -50%) scale(${mode === "view" ? 0 : 1})`;
        dot.current.style.opacity = visible && mode !== "text" && mode !== "hidden" ? "1" : "0";
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      target.x = e.clientX;
      target.y = e.clientY;
      if (!visible) {
        pos.x = target.x;
        pos.y = target.y;
        visible = true;
      }
      mode = modeFor(e.target as Element);
    };
    const onDown = (e: PointerEvent) => {
      if (e.pointerType === "mouse") pressed = true;
    };
    const onUp = () => {
      pressed = false;
    };
    const onLeave = () => {
      visible = false;
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      cancelAnimationFrame(raf);
      root.classList.remove("aperture-cursor");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-0 z-[9999]">
      <div ref={ring} className="absolute left-0 top-0 opacity-0 transition-opacity duration-300 will-change-transform">
        <svg ref={svg} width={R * 2 + 4} height={R * 2 + 4} viewBox={`${-R - 2} ${-R - 2} ${R * 2 + 4} ${R * 2 + 4}`} className="block overflow-visible drop-shadow-[0_2px_6px_rgb(0_0_0/0.45)]">
          <defs>
            <clipPath id="aperture-clip">
              <circle r={R - 1.5} />
            </clipPath>
            <radialGradient id="aperture-fill" r="1">
              <stop offset="0.25" stopColor="#c7aa80" />
              <stop offset="1" stopColor="#8f7350" />
            </radialGradient>
          </defs>
          <circle r={R} fill="#0e0d0c" fillOpacity="0.55" />
          <g clipPath="url(#aperture-clip)">
            <g style={{ transform: "rotate(var(--spin))" }}>
              {Array.from({ length: BLADES }, (_, i) => (
                <g key={i} style={{ transform: `rotate(${(360 / BLADES) * i}deg) translateY(calc(var(--gap) * -1))` }}>
                  {/* One blade: its straight inner edge forms one side of the opening. */}
                  <path d={`M ${-R * 1.6} 0 L ${R * 1.2} 0 L ${R * 1.6} ${-R * 1.4} L ${-R * 1.6} ${-R * 1.4} Z`} fill="url(#aperture-fill)" stroke="#3a2e20" strokeWidth="0.9" strokeLinejoin="round" />
                </g>
              ))}
            </g>
          </g>
          <circle r={R} fill="none" stroke="#a88962" strokeWidth="2" />
          <circle r={R - 1.5} fill="none" stroke="#3a2e20" strokeWidth="0.8" />
        </svg>
        <span ref={label} className="absolute inset-0 flex items-center justify-center text-[6px] font-semibold uppercase tracking-[0.2em] text-ivory opacity-0 transition-opacity duration-200">
          View
        </span>
      </div>
      <div ref={dot} className="absolute left-0 top-0 h-1.5 w-1.5 rounded-full bg-ivory opacity-0 shadow-[0_0_0_1px_rgb(14_13_12/0.6)] transition-[opacity] duration-200" />
    </div>
  );
}
