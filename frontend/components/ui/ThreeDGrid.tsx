"use client";
import React, { useRef, useEffect, useCallback } from "react";

interface ThreeDGridProps {
  className?: string;
  /** Color of grid lines in rgba format */
  lineColor?: string;
  /** Color of grid dots in rgba format */
  dotColor?: string;
  /** Number of grid columns */
  cols?: number;
  /** Number of grid rows */
  rows?: number;
  /** Mouse warp radius in pixels */
  warpRadius?: number;
  /** Warp strength (0-1) */
  warpStrength?: number;
}

export default function ThreeDGrid({
  className = "",
  lineColor = "rgba(99,102,241,0.12)",
  dotColor = "rgba(99,102,241,0.5)",
  cols = 24,
  rows = 16,
  warpRadius = 220,
  warpStrength = 0.38,
}: ThreeDGridProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });
  const rafRef = useRef<number | null>(null);
  const prefersReducedMotion = useRef(false);

  // Generate static point grid
  const buildGrid = useCallback(
    (w: number, h: number) => {
      const pts: { bx: number; by: number }[] = [];
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          pts.push({ bx: (c / cols) * w, by: (r / rows) * h });
        }
      }
      return pts;
    },
    [cols, rows]
  );

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedMotion.current = mq.matches;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    let pts: { bx: number; by: number }[] = [];

    const resize = () => {
      const parent = canvas.parentElement;
      w = parent ? parent.clientWidth : window.innerWidth;
      h = parent ? parent.clientHeight : window.innerHeight;
      canvas.width = w;
      canvas.height = h;
      pts = buildGrid(w, h);
    };
    resize();

    const ro = new ResizeObserver(resize);
    if (canvas.parentElement) ro.observe(canvas.parentElement);

    const onMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    const onMouseLeave = () => {
      mouseRef.current = { x: -9999, y: -9999 };
    };
    canvas.addEventListener("mousemove", onMouseMove);
    canvas.addEventListener("mouseleave", onMouseLeave);

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Compute warped positions
      const warped = pts.map(({ bx, by }) => {
        const dx = bx - mx;
        const dy = by - my;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < warpRadius) {
          const factor =
            (1 - dist / warpRadius) * warpStrength * (prefersReducedMotion.current ? 0 : 1);
          return {
            x: bx - dx * factor,
            y: by - dy * factor,
          };
        }
        return { x: bx, y: by };
      });

      // Draw horizontal lines
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      for (let r = 0; r <= rows; r++) {
        ctx.beginPath();
        for (let c = 0; c <= cols; c++) {
          const idx = r * (cols + 1) + c;
          const { x, y } = warped[idx];
          if (c === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw vertical lines
      for (let c = 0; c <= cols; c++) {
        ctx.beginPath();
        for (let r = 0; r <= rows; r++) {
          const idx = r * (cols + 1) + c;
          const { x, y } = warped[idx];
          if (r === 0) ctx.moveTo(x, y);
          else ctx.lineTo(x, y);
        }
        ctx.stroke();
      }

      // Draw dots at intersections near mouse
      for (let r = 0; r <= rows; r++) {
        for (let c = 0; c <= cols; c++) {
          const idx = r * (cols + 1) + c;
          const { x, y } = warped[idx];
          const { bx, by } = pts[idx];
          const dx = bx - mx;
          const dy = by - my;
          const dist = Math.sqrt(dx * dx + dy * dy);
          const proximity = Math.max(0, 1 - dist / warpRadius);
          if (proximity > 0) {
            ctx.beginPath();
            ctx.arc(x, y, 1.5 + proximity * 2.5, 0, Math.PI * 2);
            ctx.fillStyle = dotColor;
            ctx.globalAlpha = 0.3 + proximity * 0.7;
            ctx.fill();
            ctx.globalAlpha = 1;
          }
        }
      }
    };

    const loop = () => {
      draw();
      rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);

    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      ro.disconnect();
      canvas.removeEventListener("mousemove", onMouseMove);
      canvas.removeEventListener("mouseleave", onMouseLeave);
    };
  }, [buildGrid, lineColor, dotColor, warpRadius, warpStrength, cols, rows]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`pointer-events-none select-none ${className}`}
      style={{ display: "block" }}
    />
  );
}
