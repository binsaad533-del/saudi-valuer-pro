import React from "react";
import { isolateBidiText } from "@/lib/bidi-text";
import { cn } from "@/lib/utils";

interface BidiTextProps {
  /** The mixed-direction text to render */
  children: string;
  /** HTML element to render as */
  as?: "p" | "span" | "div" | "li" | "td" | "h1" | "h2" | "h3" | "h4";
  /** Additional class names */
  className?: string;
  /** Whether to apply line-clamp (number of lines) */
  lineClamp?: number;
  /** Whether to preserve whitespace / newlines */
  preserveNewlines?: boolean;
}

/**
 * Renders mixed Arabic+English text with proper BiDi isolation.
 * 
 * - Wraps Latin/number sequences in LRI/PDI Unicode isolates
 * - Sets dir="rtl", text-align: right, unicode-bidi: plaintext
 * - Optimized line-height for Arabic readability
 * 
 * Usage:
 *   <BidiText>نص عربي يحتوي IVS 2025 ومصطلحات DRC</BidiText>
 *   <BidiText as="span" className="text-sm">قيمة 15%</BidiText>
 */
export default function BidiText({
  children,
  as: Tag = "p",
  className,
  lineClamp,
  preserveNewlines = false,
}: BidiTextProps) {
  if (!children) return null;

  const clampClass = lineClamp ? `line-clamp-${lineClamp}` : "";

  return (
    <Tag
      dir="rtl"
      className={cn(
        "text-right leading-[1.9]",
        preserveNewlines && "whitespace-pre-wrap",
        clampClass,
        className,
      )}
      style={{ unicodeBidi: "plaintext" }}
    >
      {isolateBidiText(children)}
    </Tag>
  );
}

/**
 * Inline variant for use inside paragraphs / flex rows.
 */
export function BidiSpan({
  children,
  className,
}: {
  children: string;
  className?: string;
}) {
  return (
    <BidiText as="span" className={className}>
      {children}
    </BidiText>
  );
}
