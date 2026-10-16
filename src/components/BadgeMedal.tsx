import React, { useId } from "react";
import { TestTube, Droplet, Microscope, Syringe, Dna, Trophy, Lock } from "lucide-react";

// Per-discipline medal palette: rim gradient (light → dark), inner face, ribbon.
const MEDALS: Record<string, { light: string; dark: string; face: string; ribbon: string; icon: typeof TestTube }> = {
  chemistry: { light: "#67e8f9", dark: "#0e7490", face: "#083344", ribbon: "#155e75", icon: TestTube },
  hematology: { light: "#fda4af", dark: "#be123c", face: "#4c0519", ribbon: "#9f1239", icon: Droplet },
  microbiology: { light: "#86efac", dark: "#15803d", face: "#052e16", ribbon: "#166534", icon: Microscope },
  bloodbank: { light: "#93c5fd", dark: "#1d4ed8", face: "#172554", ribbon: "#1e40af", icon: Syringe },
  immunology: { light: "#c4b5fd", dark: "#6d28d9", face: "#2e1065", ribbon: "#5b21b6", icon: Dna }
};

const LOCKED = { light: "#4b5563", dark: "#1f2937", face: "#111827", ribbon: "#374151" };

const hex = (r: number, cx = 60, cy = 58) =>
  [-90, -30, 30, 90, 150, 210]
    .map(a => {
      const rad = (a * Math.PI) / 180;
      return `${(cx + r * Math.cos(rad)).toFixed(1)},${(cy + r * Math.sin(rad)).toFixed(1)}`;
    })
    .join(" ");

interface BadgeMedalProps {
  category: string;
  earned: boolean;
  /** 0–1 progress toward the requirement, traced around the rim when locked. */
  progress?: number;
  size?: number;
  /** Adds a sweeping shine + glow (badge-earned moment). */
  celebrate?: boolean;
}

export default function BadgeMedal({ category, earned, progress = 0, size = 96, celebrate = false }: BadgeMedalProps) {
  const uid = useId().replace(/:/g, "");
  const m = MEDALS[category];
  const c = earned && m ? m : LOCKED;
  const Icon = m?.icon || Trophy;
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const height = (size * 140) / 120;

  return (
    <div
      className={`relative shrink-0 ${earned ? "medal-earned" : ""}`}
      style={{ width: size, height, ["--medal-glow" as string]: m?.light || "#fbbf24" }}
      aria-hidden="true"
    >
      <svg viewBox="0 0 120 140" width={size} height={height} className="overflow-visible">
        <defs>
          <linearGradient id={`rim-${uid}`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={c.light} />
            <stop offset="0.55" stopColor={c.dark} />
            <stop offset="1" stopColor={c.light} stopOpacity="0.85" />
          </linearGradient>
          <radialGradient id={`face-${uid}`} cx="0.35" cy="0.3" r="0.8">
            <stop offset="0" stopColor={c.dark} />
            <stop offset="1" stopColor={c.face} />
          </radialGradient>
          <linearGradient id={`shine-${uid}`} x1="0" y1="0" x2="1" y2="0">
            <stop offset="0" stopColor="#fff" stopOpacity="0" />
            <stop offset="0.5" stopColor="#fff" stopOpacity="0.55" />
            <stop offset="1" stopColor="#fff" stopOpacity="0" />
          </linearGradient>
          <clipPath id={`clip-${uid}`}>
            <polygon points={hex(50)} />
          </clipPath>
        </defs>

        {/* Ribbon tails */}
        <polygon points="36,86 56,98 50,136 42,127 31,133" fill={c.ribbon} />
        <polygon points="84,86 64,98 70,136 78,127 89,133" fill={c.ribbon} />
        <polygon points="36,86 56,98 54,108 34,96" fill="#000" opacity="0.25" />
        <polygon points="84,86 64,98 66,108 86,96" fill="#000" opacity="0.25" />

        {/* Rim + face (stroke-linejoin rounds the hexagon corners) */}
        <polygon points={hex(48)} fill={`url(#rim-${uid})`} stroke={`url(#rim-${uid})`} strokeWidth="6" strokeLinejoin="round" />
        <polygon points={hex(38)} fill={`url(#face-${uid})`} stroke={c.face} strokeWidth="4" strokeLinejoin="round" />
        <polygon points={hex(33)} fill="none" stroke={c.light} strokeOpacity={earned ? 0.35 : 0.15} strokeWidth="1" strokeDasharray="2 3" />

        {/* Top gloss */}
        <path d="M24,36 L60,15 L96,36 Q60,30 24,36 Z" fill="#fff" opacity={earned ? 0.18 : 0.06} />

        {earned && (
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="medal-shine" x="-40" y="0" width="34" height="120" fill={`url(#shine-${uid})`} transform="skewX(-18)" />
          </g>
        )}

        {/* Progress toward requirement, traced around the rim */}
        {!earned && (
          <>
            <polygon points={hex(57)} fill="none" stroke="currentColor" className="text-line" strokeWidth="3" strokeLinejoin="round" />
            {pct > 0 && (
              <path
                d={`M${hex(57).split(" ").join(" L")} Z`}
                pathLength={100}
                fill="none"
                stroke={m?.light || "#fbbf24"}
                strokeWidth="3"
                strokeLinejoin="round"
                strokeLinecap="round"
                strokeDasharray={`${pct} 100`}
              />
            )}
          </>
        )}
      </svg>

      <Icon
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ top: `${(58 / 140) * 100}%`, width: size * 0.3, height: size * 0.3, color: earned ? "#fff" : m?.light || "#6b7280", opacity: earned ? 1 : 0.55 }}
        strokeWidth={2.2}
      />

      {!earned && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-surface border border-line"
          style={{ width: size * 0.26, height: size * 0.26, right: size * 0.06, top: size * 0.62 }}
        >
          <Lock className="text-ink-3" style={{ width: size * 0.13, height: size * 0.13 }} />
        </span>
      )}

      {celebrate && earned && <span className="medal-burst" />}
    </div>
  );
}
