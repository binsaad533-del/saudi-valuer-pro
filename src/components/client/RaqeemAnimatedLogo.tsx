import { useEffect, useState } from "react";

interface RaqeemAnimatedLogoProps {
  size?: number;
  className?: string;
}

export default function RaqeemAnimatedLogo({ size = 40, className = "" }: RaqeemAnimatedLogoProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const cx = size / 2;
  const cy = size / 2;
  const pupilR = size * 0.10;

  const arcs = [
    { radius: size * 0.18, width: size * 0.06, color: "hsl(var(--primary))", dir: 1, startAngle: 200, sweep: 280 },
    { radius: size * 0.26, width: size * 0.05, color: "hsl(210, 60%, 70%)", dir: -1, startAngle: 160, sweep: 260 },
    { radius: size * 0.34, width: size * 0.045, color: "hsl(210, 50%, 78%)", dir: 1, startAngle: 140, sweep: 240 },
    { radius: size * 0.42, width: size * 0.04, color: "hsl(210, 40%, 84%)", dir: -1, startAngle: 120, sweep: 220 },
  ];

  const squares = [
    { angle: 295, color: "#4A90D9", s: size * 0.055, dist: size * 0.46 },
    { angle: 305, color: "#E74C3C", s: size * 0.05, dist: size * 0.40 },
    { angle: 312, color: "#2ECC71", s: size * 0.045, dist: size * 0.48 },
    { angle: 320, color: "#9B59B6", s: size * 0.04, dist: size * 0.35 },
    { angle: 328, color: "#F39C12", s: size * 0.05, dist: size * 0.44 },
    { angle: 338, color: "#1ABC9C", s: size * 0.045, dist: size * 0.38 },
    { angle: 345, color: "#3498DB", s: size * 0.04, dist: size * 0.48 },
    { angle: 355, color: "#E67E22", s: size * 0.035, dist: size * 0.42 },
  ];

  function arcPath(radius: number, startAngle: number, sweep: number) {
    const start = (startAngle * Math.PI) / 180;
    const end = ((startAngle + sweep) * Math.PI) / 180;
    const x1 = cx + radius * Math.cos(start);
    const y1 = cy + radius * Math.sin(start);
    const x2 = cx + radius * Math.cos(end);
    const y2 = cy + radius * Math.sin(end);
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`;
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={className}
      style={{ overflow: "visible" }}
    >
      {/* Rotating arcs */}
      {arcs.map((arc, i) => (
        <path
          key={i}
          d={arcPath(arc.radius, arc.startAngle, arc.sweep)}
          fill="none"
          stroke={arc.color}
          strokeWidth={arc.width}
          strokeLinecap="round"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
            animation: mounted
              ? `raqeem-spin-${arc.dir > 0 ? "cw" : "ccw"} ${6 + i * 2}s linear infinite`
              : "none",
          }}
        />
      ))}

      {/* Colored squares - fixed position, random blink */}
      {squares.map((sq, i) => {
        const rad = (sq.angle * Math.PI) / 180;
        const dist = sq.dist;
        const x = cx + dist * Math.cos(rad) - sq.s / 2;
        const y = cy + dist * Math.sin(rad) - sq.s / 2;
        const delay = (i * 0.7 + Math.random() * 0.5).toFixed(2);
        const duration = (1.5 + i * 0.3).toFixed(2);
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={sq.s}
            height={sq.s}
            rx={sq.s * 0.2}
            fill={sq.color}
            style={{
              animation: mounted
                ? `raqeem-blink ${duration}s ease-in-out ${delay}s infinite`
                : "none",
              opacity: 0.9,
            }}
          />
        );
      })}

      {/* Central eye */}
      <circle cx={cx} cy={cy} r={pupilR * 1.8} fill="white" />
      <circle cx={cx} cy={cy} r={pupilR} fill="#1a1a2e" />
      <circle cx={cx + pupilR * 0.35} cy={cy - pupilR * 0.35} r={pupilR * 0.3} fill="white" />

      <style>{`
        @keyframes raqeem-spin-cw {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes raqeem-spin-ccw {
          from { transform: rotate(0deg); }
          to { transform: rotate(-360deg); }
        }
        @keyframes raqeem-blink {
          0%, 100% { opacity: 0.9; }
          50% { opacity: 0.15; }
        }
      `}</style>
    </svg>
  );
}
