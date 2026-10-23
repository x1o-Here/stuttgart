import { useId } from "react";
import { cn } from "@/lib/utils";

const RIBS = [100, 140, 180, 220, 260, 300, 340, 380];
const WHEELS = [130, 340, 480];
const GROUND = 236;
const AXLE = 212;

/**
 * Technical-drawing side elevation of a cab-over lorry. Line work uses
 * currentColor; the cab and a dot-matrix panel are tinted with --brand
 * ("classic build, powered by new tech").
 */
export function BlueprintLorry({ className }: { className?: string }) {
  const id = useId();
  const dots = `${id}-dots`;

  return (
    <svg
      viewBox="0 0 640 280"
      fill="none"
      stroke="currentColor"
      strokeWidth={0.75}
      aria-hidden="true"
      className={cn("text-muted-foreground", className)}
    >
      <defs>
        <pattern id={dots} width="6" height="6" patternUnits="userSpaceOnUse">
          <circle cx="1.5" cy="1.5" r="1" fill="var(--brand)" stroke="none" />
        </pattern>
      </defs>

      {/* Construction circle around the front axle */}
      <circle
        cx={WHEELS[2]}
        cy={AXLE}
        r="74"
        strokeDasharray="2 4"
        opacity="0.5"
      />

      {/* Cargo box, ribs and the "powered" dot-matrix panel */}
      <rect x="60" y="70" width="340" height="120" />
      <rect
        x="260"
        y="70"
        width="140"
        height="120"
        fill={`url(#${dots})`}
        stroke="none"
        opacity="0.8"
      />
      {RIBS.map((x) => (
        <line key={x} x1={x} y1="70" x2={x} y2="190" />
      ))}
      <line x1="60" y1="82" x2="400" y2="82" />

      {/* Cab, tinted brand */}
      <path
        d="M410 190 V86 Q410 76 420 76 H500 L530 112 Q540 120 540 132 V190 Z"
        fill="var(--brand)"
        fillOpacity="0.9"
        stroke="var(--brand)"
      />
      <path
        d="M424 90 H496 L520 118 H424 Z"
        fill="var(--card)"
        stroke="var(--brand)"
      />
      <line x1="470" y1="124" x2="470" y2="186" stroke="var(--card)" />
      <line x1="476" y1="134" x2="488" y2="134" stroke="var(--card)" />
      <circle cx="532" cy="162" r="5" fill="var(--card)" stroke="none" />

      {/* Chassis and bumper */}
      <rect x="50" y="190" width="498" height="8" />
      <rect x="540" y="176" width="14" height="22" />

      {/* Wheels with arches and hub cross-hairs */}
      {WHEELS.map((cx) => (
        <g key={cx}>
          <path
            d={`M${cx - 32} 198 A32 32 0 0 1 ${cx + 32} 198 Z`}
            fill="var(--card)"
          />
          <circle cx={cx} cy={AXLE} r="24" fill="var(--card)" />
          <circle cx={cx} cy={AXLE} r="15" />
          <circle cx={cx} cy={AXLE} r="3" />
          <line x1={cx - 30} y1={AXLE} x2={cx + 30} y2={AXLE} opacity="0.5" />
          <line
            x1={cx}
            y1="176"
            x2={cx}
            y2="252"
            strokeDasharray="6 3 1 3"
            opacity="0.6"
          />
        </g>
      ))}

      {/* Ground line */}
      <line x1="16" y1={GROUND} x2="624" y2={GROUND} />

      {/* Length dimension */}
      <line x1="60" y1="262" x2="554" y2="262" />
      <line x1="60" y1="256" x2="60" y2="268" />
      <line x1="554" y1="256" x2="554" y2="268" />
      <rect
        x="282"
        y="255"
        width="50"
        height="14"
        fill="var(--card)"
        stroke="none"
      />
      <text
        x="307"
        y="266"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        className="font-mono"
        fontSize="10"
        letterSpacing="0.08em"
      >
        7.2 M
      </text>

      {/* Height dimension */}
      <line x1="36" y1="70" x2="36" y2={GROUND} />
      <line x1="30" y1="70" x2="42" y2="70" />
      <line x1="30" y1={GROUND} x2="42" y2={GROUND} />
      <text
        x="24"
        y="156"
        textAnchor="middle"
        fill="currentColor"
        stroke="none"
        className="font-mono"
        fontSize="10"
        letterSpacing="0.08em"
        transform="rotate(-90 24 156)"
      >
        3.4 M
      </text>
    </svg>
  );
}
