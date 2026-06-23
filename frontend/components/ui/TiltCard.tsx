"use client";
import React, { useRef, useCallback } from "react";

interface TiltCardProps {
  children: React.ReactNode;
  className?: string;
  contentClassName?: string;
  /** Max rotation in degrees */
  maxTilt?: number;
  /** Perspective depth in px */
  perspective?: number;
  /** Scale on hover */
  scale?: number;
  /** Transition duration for the reset in ms */
  resetDuration?: number;
  /** Shine overlay color */
  shineColor?: string;
  /** Disable the 3D tilt (e.g. on mobile) */
  disabled?: boolean;
}

export default function TiltCard({
  children,
  className = "",
  contentClassName = "",
  maxTilt = 12,
  perspective = 900,
  scale = 1.02,
  resetDuration = 500,
  shineColor = "rgba(255,255,255,0.06)",
  disabled = false,
}: TiltCardProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const shineRef = useRef<HTMLDivElement>(null);
  const isHovered = useRef(false);
  const animFrame = useRef<number | null>(null);

  // Check reduced motion once
  const prefersReducedMotion =
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (disabled || prefersReducedMotion) return;
      const card = cardRef.current;
      if (!card) return;

      if (animFrame.current) cancelAnimationFrame(animFrame.current);
      animFrame.current = requestAnimationFrame(() => {
        const rect = card.getBoundingClientRect();
        // Normalise mouse position to [-1, 1]
        const nx = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
        const ny = ((e.clientY - rect.top) / rect.height - 0.5) * 2;

        const rotX = -ny * maxTilt;
        const rotY = nx * maxTilt;

        card.style.transform = `perspective(${perspective}px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale})`;
        card.style.transition = "transform 80ms linear";

        // Shine effect position
        if (shineRef.current) {
          const shineX = ((e.clientX - rect.left) / rect.width) * 100;
          const shineY = ((e.clientY - rect.top) / rect.height) * 100;
          shineRef.current.style.background = `radial-gradient(circle at ${shineX}% ${shineY}%, ${shineColor}, transparent 60%)`;
          shineRef.current.style.opacity = "1";
        }
      });
    },
    [disabled, prefersReducedMotion, maxTilt, perspective, scale, shineColor]
  );

  const handleMouseEnter = useCallback(() => {
    isHovered.current = true;
  }, []);

  const handleMouseLeave = useCallback(() => {
    isHovered.current = false;
    if (animFrame.current) cancelAnimationFrame(animFrame.current);
    const card = cardRef.current;
    if (card) {
      card.style.transform = `perspective(${perspective}px) rotateX(0deg) rotateY(0deg) scale(1)`;
      card.style.transition = `transform ${resetDuration}ms cubic-bezier(0.23, 1, 0.32, 1)`;
    }
    if (shineRef.current) {
      shineRef.current.style.opacity = "0";
    }
  }, [perspective, resetDuration]);

  return (
    <div
      ref={cardRef}
      className={`relative ${className}`}
      style={{
        transformStyle: "preserve-3d",
        willChange: "transform",
      }}
      onMouseMove={handleMouseMove}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Shine overlay */}
      <div
        ref={shineRef}
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: "inherit",
          pointerEvents: "none",
          opacity: 0,
          transition: "opacity 300ms ease",
          zIndex: 1,
        }}
      />
      {/* Content layer sits above shine */}
      <div className={contentClassName} style={{ position: "relative", zIndex: 2 }}>{children}</div>
    </div>
  );
}
