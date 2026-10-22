"use client";

import React from "react";

export type MascotExpression = "idle" | "listening" | "thinking" | "speaking";

export interface TutorMascotProps {
  expression?: MascotExpression;
  className?: string;
  size?: number;
  animate?: boolean;
}

/**
 * Tutor Buddy: An original, friendly, accessible SVG character designed
 * from scratch for neurodiverse school students.
 * Supports 4 expressions: 'idle', 'listening', 'thinking', 'speaking'.
 */
export function TutorMascot({
  expression = "idle",
  className = "",
  size = 96,
  animate = true,
}: TutorMascotProps) {
  return (
    <div
      className={`inline-flex items-center justify-center select-none relative ${className}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 120 120"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="w-full h-full drop-shadow-sm calm-fade"
      >
        <defs>
          {/* Gradients */}
          <linearGradient id="buddyBodyGrad" x1="20" y1="20" x2="100" y2="100" gradientUnits="userSpaceOnUse">
            <stop stopColor="#4F46E5" />
            <stop offset="1" stopColor="#7C3AED" />
          </linearGradient>
          <linearGradient id="buddyFaceGrad" x1="30" y1="35" x2="90" y2="85" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FFFFFF" />
            <stop offset="1" stopColor="#F6F8FF" />
          </linearGradient>
          <linearGradient id="buddyScreenGrad" x1="32" y1="40" x2="88" y2="80" gradientUnits="userSpaceOnUse">
            <stop stopColor="#EEF2FF" />
            <stop offset="1" stopColor="#E0E7FF" />
          </linearGradient>
          <linearGradient id="buddyBulbGrad" x1="52" y1="6" x2="68" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#F59E0B" />
            <stop offset="1" stopColor="#FCD34D" />
          </linearGradient>
          <linearGradient id="buddyCheekGrad" x1="0" y1="0" x2="1" y2="1">
            <stop stopColor="#F472B6" stopOpacity="0.45" />
            <stop offset="1" stopColor="#FDA4AF" stopOpacity="0.1" />
          </linearGradient>
        </defs>

        {/* Ambient Glow behind bulb */}
        <circle
          cx="60"
          cy="16"
          r={expression === "thinking" || expression === "listening" ? "14" : "10"}
          fill="url(#buddyBulbGrad)"
          opacity={expression === "thinking" ? "0.6" : "0.3"}
          className={animate && expression === "thinking" ? "animate-pulse" : ""}
        />

        {/* Antenna Stem & Lightbulb */}
        <path d="M60 28 V20" stroke="#7C3AED" strokeWidth="3.5" strokeLinecap="round" />
        <circle cx="60" cy="15" r="7" fill="url(#buddyBulbGrad)" stroke="#B45309" strokeWidth="1.2" />
        {/* Filament / Sparkle */}
        <path d="M58 15 L62 15" stroke="#FFFFFF" strokeWidth="1.5" strokeLinecap="round" />

        {/* Outer Ears / Headphone Cushions */}
        <rect x="18" y="44" width="8" height="24" rx="4" fill="#6366F1" />
        <rect x="94" y="44" width="8" height="24" rx="4" fill="#6366F1" />

        {/* Soundwaves if Listening */}
        {expression === "listening" && (
          <>
            <path
              d="M12 48 C9 53 9 59 12 64"
              stroke="#0D9488"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={animate ? "animate-pulse" : ""}
            />
            <path
              d="M108 48 C111 53 111 59 108 64"
              stroke="#0D9488"
              strokeWidth="2.5"
              strokeLinecap="round"
              className={animate ? "animate-pulse" : ""}
            />
          </>
        )}

        {/* Main Body Shell */}
        <rect
          x="24"
          y="28"
          width="72"
          height="64"
          rx="22"
          fill="url(#buddyBodyGrad)"
          stroke="#3730A3"
          strokeWidth="1.5"
        />

        {/* Face Visor / Screen */}
        <rect
          x="32"
          y="36"
          width="56"
          height="46"
          rx="15"
          fill="url(#buddyScreenGrad)"
          stroke="#C7D2FE"
          strokeWidth="1.5"
        />

        {/* Soft Cheeks */}
        <circle cx="39" cy="65" r="4.5" fill="url(#buddyCheekGrad)" />
        <circle cx="81" cy="65" r="4.5" fill="url(#buddyCheekGrad)" />

        {/* Expression Specific Elements */}
        {expression === "idle" && (
          <>
            {/* Friendly sparkling eyes */}
            <circle cx="46" cy="54" r="4.5" fill="#1E1B4B" />
            <circle cx="74" cy="54" r="4.5" fill="#1E1B4B" />
            {/* Eye glints */}
            <circle cx="44.5" cy="52.5" r="1.5" fill="#FFFFFF" />
            <circle cx="72.5" cy="52.5" r="1.5" fill="#FFFFFF" />
            {/* Happy curved smile */}
            <path d="M54 63 Q60 69 66 63" stroke="#1E1B4B" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </>
        )}

        {expression === "listening" && (
          <>
            {/* Attentive wide eyes */}
            <ellipse cx="46" cy="54" rx="4.5" ry="5.5" fill="#0F766E" />
            <ellipse cx="74" cy="54" rx="4.5" ry="5.5" fill="#0F766E" />
            <circle cx="45" cy="52" r="1.8" fill="#FFFFFF" />
            <circle cx="73" cy="52" r="1.8" fill="#FFFFFF" />
            {/* Curious friendly smile */}
            <path d="M55 64 Q60 67 65 64" stroke="#0F766E" strokeWidth="2.5" strokeLinecap="round" fill="none" />
          </>
        )}

        {expression === "thinking" && (
          <>
            {/* Eyes looking up thoughtfully */}
            <circle cx="47" cy="50" r="4.5" fill="#4338CA" />
            <circle cx="75" cy="50" r="4.5" fill="#4338CA" />
            <circle cx="48" cy="48.5" r="1.5" fill="#FFFFFF" />
            <circle cx="76" cy="48.5" r="1.5" fill="#FFFFFF" />
            {/* Pondering mouth: small 'o' */}
            <ellipse cx="60" cy="64" rx="3" ry="3.5" fill="#4338CA" />
            {/* Little floating thought sparkle */}
            <path
              d="M86 36 L88 32 L90 36 L94 38 L90 40 L88 44 L86 40 L82 38 Z"
              fill="#F59E0B"
              className={animate ? "animate-pulse" : ""}
            />
          </>
        )}

        {expression === "speaking" && (
          <>
            {/* Happy squinting/curved eyes */}
            <path d="M42 53 Q46 48 50 53" stroke="#1E1B4B" strokeWidth="2.8" strokeLinecap="round" fill="none" />
            <path d="M70 53 Q74 48 78 53" stroke="#1E1B4B" strokeWidth="2.8" strokeLinecap="round" fill="none" />
            {/* Open cheerful speaking mouth */}
            <path
              d="M54 62 Q60 71 66 62 Z"
              fill="#BE123C"
              stroke="#881337"
              strokeWidth="1.5"
              strokeLinejoin="round"
            />
            <path d="M57 63 Q60 65 63 63" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="round" fill="none" />
          </>
        )}

        {/* Little Open Mini Book held below */}
        <g transform="translate(42, 86)">
          <path
            d="M2 14 C7 10 12 11 18 13 C24 11 29 10 34 14 L34 22 C29 19 24 20 18 21 C12 20 7 19 2 22 Z"
            fill="#FFFFFF"
            stroke="#4338CA"
            strokeWidth="1.2"
          />
          <path d="M18 13 L18 21" stroke="#4338CA" strokeWidth="1.5" strokeLinecap="round" />
          {/* Subtle page lines */}
          <line x1="6" y1="14" x2="14" y2="15" stroke="#C7D2FE" strokeWidth="1" strokeLinecap="round" />
          <line x1="22" y1="15" x2="30" y2="14" stroke="#C7D2FE" strokeWidth="1" strokeLinecap="round" />
        </g>
      </svg>
    </div>
  );
}
