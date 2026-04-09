export function isDesktopMode(mode?: string | null) {
  return !!mode && mode !== "field";
}

export function getTurnaroundDays(mode?: string | null) {
  return isDesktopMode(mode) ? 5 : 10;
}

export function getValuationModeLabel(mode?: string | null) {
  if (mode === "desktop_with_photos") return "مكتبي (مع صور)";
  if (mode === "desktop_without_photos") return "مكتبي (بدون صور)";
  if (mode === "desktop") return "مكتبي";
  if (!mode || mode === "field") return "ميداني";
  return mode;
}