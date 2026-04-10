import { useEffect, useState } from "react";

interface RaqeemAnimatedLogoProps {
  size?: number;
  className?: string;
}

/**
 * ChatGPT-style animated AI logo.
 * A pulsing circular icon with the OpenAI sparkle/bolt motif.
 */
export default function RaqeemAnimatedLogo({ size = 112, className = "" }: RaqeemAnimatedLogoProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const s = size;
  const cx = s / 2;
  const cy = s / 2;
  const r = s * 0.42;

  return (
    <svg
      width={s}
      height={s}
      viewBox={`0 0 ${s} ${s}`}
      className={className}
      style={{ overflow: "visible" }}
    >
      <defs>
        <linearGradient id="gpt-grad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10a37f" />
          <stop offset="100%" stopColor="#1a7f64" />
        </linearGradient>
        <filter id="gpt-glow">
          <feGaussianBlur stdDeviation={s * 0.02} result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Outer pulse ring */}
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke="#10a37f"
        strokeWidth={s * 0.02}
        opacity={0.3}
        style={{
          animation: mounted ? "gpt-pulse 2.5s ease-in-out infinite" : "none",
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />

      {/* Main circle */}
      <circle cx={cx} cy={cy} r={r * 0.85} fill="url(#gpt-grad)" filter="url(#gpt-glow)" />

      {/* ChatGPT sparkle/bolt icon — scaled to center */}
      <g transform={`translate(${cx - s * 0.18}, ${cy - s * 0.22}) scale(${s / 140})`}>
        <path
          d="M37.5 2.5C37.5 2.5 40 12 45 17C50 22 59.5 24.5 59.5 24.5C59.5 24.5 50 27 45 32C40 37 37.5 46.5 37.5 46.5C37.5 46.5 35 37 30 32C25 27 15.5 24.5 15.5 24.5C15.5 24.5 25 22 30 17C35 12 37.5 2.5 37.5 2.5Z"
          fill="white"
          opacity={0.95}
          style={{
            animation: mounted ? "gpt-sparkle 3s ease-in-out infinite" : "none",
            transformOrigin: "37.5px 24.5px",
          }}
        />
        {/* Smaller secondary sparkle */}
        <path
          d="M18 38C18 38 19.5 43.5 22 46C24.5 48.5 30 50 30 50C30 50 24.5 51.5 22 54C19.5 56.5 18 62 18 62C18 62 16.5 56.5 14 54C11.5 51.5 6 50 6 50C6 50 11.5 48.5 14 46C16.5 43.5 18 38 18 38Z"
          fill="white"
          opacity={0.7}
          style={{
            animation: mounted ? "gpt-sparkle 3s ease-in-out 0.8s infinite" : "none",
            transformOrigin: "18px 50px",
          }}
        />
      </g>

      {/* Orbiting dot */}
      <circle
        cx={cx + r * 0.92}
        cy={cy}
        r={s * 0.025}
        fill="#10a37f"
        opacity={0.6}
        style={{
          animation: mounted ? "gpt-orbit 4s linear infinite" : "none",
          transformOrigin: `${cx}px ${cy}px`,
        }}
      />

      <style>{`
        @keyframes gpt-pulse {
          0%, 100% { transform: scale(1); opacity: 0.3; }
          50% { transform: scale(1.15); opacity: 0.1; }
        }
        @keyframes gpt-sparkle {
          0%, 100% { transform: scale(1); opacity: 0.95; }
          50% { transform: scale(0.85); opacity: 0.6; }
        }
        @keyframes gpt-orbit {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </svg>
  );
}
