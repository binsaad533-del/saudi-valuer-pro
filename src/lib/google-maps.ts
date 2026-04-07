import type { AssetLocation } from "@/components/client/AssetLocationPicker";

export function normalizeGoogleMapsUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  return /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
}

export function isValidGoogleMapsUrl(url: string): boolean {
  const normalized = normalizeGoogleMapsUrl(url);
  return /^(https?:\/\/)(www\.)?(google\.\w+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(normalized);
}

export function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function coordsToGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`;
}

function parseCoordinate(value?: string | null): number | undefined {
  if (!value) return undefined;
  const normalized = value.trim().replace(/^\+/, "");
  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

export function extractCoordsFromUrl(url: string): { lat?: number; lng?: number } {
  const normalizedUrl = normalizeGoogleMapsUrl(url);
  const decodedUrl = decodeURIComponent(normalizedUrl.replace(/\+/g, " "));

  const patterns = [
    /@\s*([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/,
    /[?&]q=\s*([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/,
    /[?&]query=\s*([-+]?\d+(?:\.\d+)?),\s*([-+]?\d+(?:\.\d+)?)/,
    /\/maps\/search\/\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)/,
    /place\/[^/]+\/\s*([-+]?\d+(?:\.\d+)?)\s*,\s*([-+]?\d+(?:\.\d+)?)/,
  ];

  for (const pattern of patterns) {
    const match = decodedUrl.match(pattern);
    if (!match) continue;

    const lat = parseCoordinate(match[1]);
    const lng = parseCoordinate(match[2]);
    if (lat != null && lng != null && isValidCoordinate(lat, lng)) {
      return { lat, lng };
    }
  }

  return {};
}

export function getLocationUrl(location: Pick<AssetLocation, "googleMapsUrl" | "latitude" | "longitude">): string {
  if (location.latitude != null && location.longitude != null) {
    return coordsToGoogleMapsUrl(location.latitude, location.longitude);
  }

  const coords = extractCoordsFromUrl(location.googleMapsUrl);
  if (coords.lat != null && coords.lng != null) {
    return coordsToGoogleMapsUrl(coords.lat, coords.lng);
  }

  return normalizeGoogleMapsUrl(location.googleMapsUrl);
}

export function openLocationInGoogleMaps(location: Pick<AssetLocation, "googleMapsUrl" | "latitude" | "longitude">) {
  const url = getLocationUrl(location);

  const popup = window.open("", "_blank");
  if (popup) {
    popup.opener = null;
    popup.location.replace(url);
    popup.focus();
    return;
  }

  const link = document.createElement("a");
  link.href = url;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.referrerPolicy = "no-referrer";
  link.click();
}