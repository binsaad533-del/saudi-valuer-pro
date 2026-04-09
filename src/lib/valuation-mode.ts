export type ValuationMode =
  | "field"
  | "desktop"
  | "desktop_with_photos"
  | "desktop_without_photos"
  | string
  | null
  | undefined;

export function normalizeValuationMode(mode: ValuationMode, hasPhotos = false) {
  if (!mode || mode === "field") return "field" as const;
  if (mode === "desktop_with_photos" || mode === "desktop_without_photos") return mode;
  if (mode === "desktop") return hasPhotos ? "desktop_with_photos" : "desktop_without_photos";
  return String(mode).includes("desktop") ? "desktop_without_photos" : "field";
}

export function isDesktopValuationMode(mode: ValuationMode) {
  return normalizeValuationMode(mode) !== "field";
}

export function getValuationModeLabel(mode: ValuationMode, hasPhotos = false) {
  const normalized = normalizeValuationMode(mode, hasPhotos);
  if (normalized === "desktop_with_photos") return "تقييم مكتبي (مع صور)";
  if (normalized === "desktop_without_photos") return "تقييم مكتبي";
  return "تقييم ميداني";
}

export function getTurnaroundDays(mode: ValuationMode) {
  return isDesktopValuationMode(mode) ? 5 : 10;
}