import React, { useId } from "react";
import { TestTube, Droplet, Microscope, Syringe, Dna, Trophy, Lock, FlaskConical } from "lucide-react";

// Per-discipline palette: rim gradient (light → dark), inner face, ribbon.
const PALETTE: Record<string, { light: string; dark: string; face: string; ribbon: string; icon: typeof TestTube }> = {
  chemistry: { light: "#67e8f9", dark: "#0e7490", face: "#083344", ribbon: "#155e75", icon: TestTube },
  hematology: { light: "#fda4af", dark: "#be123c", face: "#4c0519", ribbon: "#9f1239", icon: Droplet },
  microbiology: { light: "#86efac", dark: "#15803d", face: "#052e16", ribbon: "#166534", icon: Microscope },
  bloodbank: { light: "#93c5fd", dark: "#1d4ed8", face: "#172554", ribbon: "#1e40af", icon: Syringe },
  immunology: { light: "#c4b5fd", dark: "#6d28d9", face: "#2e1065", ribbon: "#5b21b6", icon: Dna }
};

const LOCKED = { light: "#4b5563", dark: "#1f2937", face: "#111827", ribbon: "#374151" };

type Shape = "medal" | "coin";
type Colors = typeof LOCKED;

const hex = (r: number, cx = 60, cy = 58) =>
  [-90, -30, 30, 90, 150, 210]
    .map(a => {
      const rad = (a * Math.PI) / 180;
      return `${(cx + r * Math.cos(rad)).toFixed(1)},${(cy + r * Math.sin(rad)).toFixed(1)}`;
    })
    .join(" ");

// Medals are hexagons with ribbon tails (viewBox 120×140); coins are round (120×120).
const GEOMETRY = {
  medal: { vbH: 140, cy: 58 },
  coin: { vbH: 120, cy: 60 }
};

interface FaceProps {
  shape: Shape;
  c: Colors;
  accent: string;
  earned: boolean;
  pct: number;
  size: number;
  Icon: typeof TestTube;
  showProgress: boolean;
}

/** One flat face of the badge: rim, face, gloss, shine, icon. */
function Face({ shape, c, accent, earned, pct, size, Icon, showProgress }: FaceProps) {
  const uid = useId().replace(/:/g, "");
  const { vbH, cy } = GEOMETRY[shape];
  const height = (size * vbH) / 120;
  const isMedal = shape === "medal";

  return (
    <>
      <svg viewBox={`0 0 120 ${vbH}`} width={size} height={height} className="overflow-visible block">
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
            {isMedal ? <polygon points={hex(50)} /> : <circle cx="60" cy={cy} r="51" />}
          </clipPath>
        </defs>

        {isMedal ? (
          <>
            {/* Ribbon tails */}
            <polygon points="36,86 56,98 50,136 42,127 31,133" fill={c.ribbon} />
            <polygon points="84,86 64,98 70,136 78,127 89,133" fill={c.ribbon} />
            <polygon points="36,86 56,98 54,108 34,96" fill="#000" opacity="0.25" />
            <polygon points="84,86 64,98 66,108 86,96" fill="#000" opacity="0.25" />
            {/* Rim + face (stroke-linejoin rounds the hexagon corners) */}
            <polygon points={hex(48)} fill={`url(#rim-${uid})`} stroke={`url(#rim-${uid})`} strokeWidth="6" strokeLinejoin="round" />
            <polygon points={hex(38)} fill={`url(#face-${uid})`} stroke={c.face} strokeWidth="4" strokeLinejoin="round" />
            <polygon points={hex(33)} fill="none" stroke={c.light} strokeOpacity={earned ? 0.35 : 0.15} strokeWidth="1" strokeDasharray="2 3" />
            <path d="M24,36 L60,15 L96,36 Q60,30 24,36 Z" fill="#fff" opacity={earned ? 0.18 : 0.06} />
          </>
        ) : (
          <>
            {/* Milled coin edge, rim and face */}
            <circle cx="60" cy={cy} r="50" fill={`url(#rim-${uid})`} />
            <circle cx="60" cy={cy} r="49" fill="none" stroke={c.dark} strokeWidth="3" strokeDasharray="1.6 1.6" opacity="0.7" />
            <circle cx="60" cy={cy} r="40" fill={`url(#face-${uid})`} stroke={c.face} strokeWidth="3" />
            <circle cx="60" cy={cy} r="34" fill="none" stroke={c.light} strokeOpacity={earned ? 0.35 : 0.15} strokeWidth="1" strokeDasharray="2 3" />
            <path d={`M26,${cy - 14} A36,36 0 0 1 94,${cy - 14} Q60,${cy - 24} 26,${cy - 14} Z`} fill="#fff" opacity={earned ? 0.16 : 0.05} />
          </>
        )}

        {earned && (
          <g clipPath={`url(#clip-${uid})`}>
            <rect className="medal-shine" x="-40" y="0" width="34" height="120" fill={`url(#shine-${uid})`} transform="skewX(-18)" />
          </g>
        )}

        {/* Progress toward the requirement, traced around the rim */}
        {showProgress && !earned && (
          isMedal ? (
            <>
              <polygon points={hex(57)} fill="none" stroke="currentColor" className="text-line" strokeWidth="3" strokeLinejoin="round" />
              {pct > 0 && (
                <path d={`M${hex(57).split(" ").join(" L")} Z`} pathLength={100} fill="none" stroke={accent} strokeWidth="3"
                  strokeLinejoin="round" strokeLinecap="round" strokeDasharray={`${pct} 100`} />
              )}
            </>
          ) : (
            <>
              <circle cx="60" cy={cy} r="57" fill="none" stroke="currentColor" className="text-line" strokeWidth="3" />
              {pct > 0 && (
                <circle cx="60" cy={cy} r="57" fill="none" stroke={accent} strokeWidth="3" strokeLinecap="round" pathLength={100}
                  strokeDasharray={`${pct} 100`} transform={`rotate(-90 60 ${cy})`} />
              )}
            </>
          )
        )}
      </svg>

      <Icon
        className="absolute left-1/2 -translate-x-1/2 -translate-y-1/2"
        style={{ top: `${(cy / vbH) * 100}%`, width: size * 0.3, height: size * 0.3, color: earned ? "#fff" : accent, opacity: earned ? 1 : 0.55 }}
        strokeWidth={2.2}
      />
    </>
  );
}

interface BadgeMedalProps {
  category: string;
  earned: boolean;
  /** 0–1 progress toward the requirement, traced around the rim when locked. */
  progress?: number;
  size?: number;
  /** "medal" = hexagon with ribbons (discipline), "coin" = round (topic). */
  shape?: Shape;
  /** Overrides the discipline icon (topic badges have their own). */
  icon?: typeof TestTube;
  /**
   * Earned badges spin in 3D whenever this value changes (and once on mount).
   * Leave undefined for a badge that never spins.
   */
  spinKey?: number;
  /** Seconds to wait before this badge's spin starts (for staggered waves). */
  spinDelay?: number;
  /** Adds a pulsing glow behind the badge (badge-earned moment). */
  celebrate?: boolean;
}

/**
 * A badge rendered as a 3D object: two faces with an extruded edge between them,
 * built from stacked CSS-3D layers so it needs no WebGL.
 */
export default function BadgeMedal({
  category,
  earned,
  progress = 0,
  size = 96,
  shape = "medal",
  icon,
  spinKey,
  spinDelay = 0,
  celebrate = false
}: BadgeMedalProps) {
  const m = PALETTE[category];
  const c = earned && m ? m : LOCKED;
  const accent = m?.light || "#fbbf24";
  const Icon = icon || m?.icon || Trophy;
  const pct = Math.max(0, Math.min(1, progress)) * 100;
  const { vbH, cy } = GEOMETRY[shape];
  const height = (size * vbH) / 120;
  const depth = Math.max(4, size * 0.14);
  const layers = 8;
  const spins = earned && spinKey !== undefined;

  // Edge silhouette: only the body is extruded, not the ribbons.
  const silhouette = (
    <svg viewBox={`0 0 120 ${vbH}`} width={size} height={height} className="block">
      {shape === "medal"
        ? <polygon points={hex(48)} fill={c.dark} stroke={c.dark} strokeWidth="6" strokeLinejoin="round" />
        : <circle cx="60" cy={cy} r="50" fill={c.dark} />}
    </svg>
  );

  return (
    <div
      className={`b3d relative shrink-0 ${earned ? "b3d-earned" : ""}`}
      style={{ width: size, height, ["--medal-glow" as string]: accent, ["--b3d-delay" as string]: `${spinDelay}s` }}
      aria-hidden="true"
    >
      {celebrate && earned && <span className="medal-burst" />}
      <span key={`s${spinKey}`} className={`b3d-shadow ${spins ? "b3d-shadow-spin" : ""}`} />
      <div key={`b${spinKey}`} className={`b3d-body ${spins ? "b3d-spin" : ""}`}>
        {Array.from({ length: layers }, (_, i) => {
          const z = -depth / 2 + ((i + 1) * depth) / (layers + 1);
          return (
            <div key={i} className="b3d-layer" style={{ transform: `translateZ(${z.toFixed(2)}px)`, filter: `brightness(${0.75 + (i % 2) * 0.12})` }}>
              {silhouette}
            </div>
          );
        })}
        <div className="b3d-face" style={{ transform: `translateZ(${depth / 2}px)` }}>
          <Face shape={shape} c={c} accent={accent} earned={earned} pct={pct} size={size} Icon={Icon} showProgress />
        </div>
        <div className="b3d-face" style={{ transform: `rotateY(180deg) translateZ(${depth / 2}px)` }}>
          <Face shape={shape} c={c} accent={accent} earned={earned} pct={pct} size={size} Icon={FlaskConical} showProgress={false} />
        </div>
      </div>

      {!earned && (
        <span
          className="absolute flex items-center justify-center rounded-full bg-surface border border-line"
          style={{ width: size * 0.26, height: size * 0.26, right: size * 0.04, top: size * (shape === "medal" ? 0.62 : 0.7) }}
        >
          <Lock className="text-ink-3" style={{ width: size * 0.13, height: size * 0.13 }} />
        </span>
      )}
    </div>
  );
}
