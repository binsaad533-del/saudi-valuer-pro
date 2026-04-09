import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";

interface RaqeemIconProps {
  size?: number;
  className?: string;
}

/**
 * Inline Raqeem AI icon — drop-in replacement for Brain/Sparkles icons.
 * Accepts size in pixels (default 16 = w-4 h-4 equivalent).
 */
export default function RaqeemIcon({ size = 16, className = "" }: RaqeemIconProps) {
  return <RaqeemAnimatedLogo size={size} className={`inline-block shrink-0 ${className}`} />;
}
