import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";

interface RaqeemIconProps {
  size?: number;
  className?: string;
}

/**
 * Inline Raqeem AI icon — drop-in replacement for Brain/Sparkles icons.
 * Accepts size in pixels (default 16 = w-4 h-4 equivalent).
 * Also parses Tailwind w-N h-N classes to derive size automatically.
 */
export default function RaqeemIcon({ size, className = "" }: RaqeemIconProps) {
  // Parse size from className if not explicitly provided
  let resolvedSize = size ?? 16;
  if (!size && className) {
    const match = className.match(/w-(\d+(?:\.\d+)?)/);
    if (match) {
      resolvedSize = parseFloat(match[1]) * 4; // Tailwind: w-4 = 16px
    }
  }
  return <RaqeemAnimatedLogo size={resolvedSize} className={`inline-block shrink-0 ${className}`} />;
}
