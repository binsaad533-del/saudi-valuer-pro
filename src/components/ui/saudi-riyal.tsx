import saudiRiyalIcon from "@/assets/saudi-riyal.png";
import { formatNumber } from "@/lib/utils";

interface SARProps {
  className?: string;
  size?: number;
}

/** Inline Saudi Riyal icon – use instead of "ر.س" text */
export function SAR({ className = "", size = 14 }: SARProps) {
  return (
    <img
      src={saudiRiyalIcon}
      alt="ر.س"
      className={`inline-block align-middle ${className}`}
      style={{ width: size, height: size }}
    />
  );
}

/** Format a number with the SAR icon as a React element */
export function CurrencyDisplay({ amount, className, iconSize }: { amount: number; className?: string; iconSize?: number }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className || ""}`}>
      {formatNumber(Math.round(amount))}
      <SAR size={iconSize} />
    </span>
  );
}
