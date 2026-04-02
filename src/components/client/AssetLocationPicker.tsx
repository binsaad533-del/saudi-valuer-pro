import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, X, ExternalLink, Navigation } from "lucide-react";

export interface AssetLocation {
  id: string;
  name: string;
  city: string;
  googleMapsUrl: string;
  latitude?: number;
  longitude?: number;
}

interface AssetLocationPickerProps {
  locations: AssetLocation[];
  onChange: (locations: AssetLocation[]) => void;
}

function extractCoordsFromUrl(url: string): { lat?: number; lng?: number } {
  // Try patterns like @24.7136,46.6753 or q=24.7136,46.6753
  const atMatch = url.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (atMatch) return { lat: parseFloat(atMatch[1]), lng: parseFloat(atMatch[2]) };
  const qMatch = url.match(/[?&]q=(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (qMatch) return { lat: parseFloat(qMatch[1]), lng: parseFloat(qMatch[2]) };
  const placeMatch = url.match(/place\/[^/]+\/(-?\d+\.?\d*),(-?\d+\.?\d*)/);
  if (placeMatch) return { lat: parseFloat(placeMatch[1]), lng: parseFloat(placeMatch[2]) };
  return {};
}

function isValidGoogleMapsUrl(url: string): boolean {
  return /^https?:\/\/(www\.)?(google\.\w+\/maps|maps\.google|maps\.app\.goo\.gl|goo\.gl\/maps)/i.test(url);
}

export default function AssetLocationPicker({ locations, onChange }: AssetLocationPickerProps) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", city: "", googleMapsUrl: "" });
  const [urlError, setUrlError] = useState("");

  const handleAdd = () => {
    if (!form.name.trim() || !form.googleMapsUrl.trim()) return;

    if (!isValidGoogleMapsUrl(form.googleMapsUrl.trim())) {
      setUrlError("يرجى إدخال رابط خرائط قوقل صالح");
      return;
    }

    const coords = extractCoordsFromUrl(form.googleMapsUrl);
    const newLocation: AssetLocation = {
      id: crypto.randomUUID(),
      name: form.name.trim(),
      city: form.city.trim(),
      googleMapsUrl: form.googleMapsUrl.trim(),
      latitude: coords.lat,
      longitude: coords.lng,
    };

    onChange([...locations, newLocation]);
    setForm({ name: "", city: "", googleMapsUrl: "" });
    setUrlError("");
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    onChange(locations.filter(l => l.id !== id));
  };

  // Group by city for display
  const cities = [...new Set(locations.map(l => l.city).filter(Boolean))];

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5 text-primary" />
          مواقع الأصول
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          أضف مواقع الأصول المراد تقييمها عبر روابط خرائط قوقل. يمكنك إضافة موقع واحد أو عدة مواقع.
        </p>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Location chips */}
        {locations.length > 0 && (
          <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {locations.map(loc => (
              <LocationChip key={loc.id} location={loc} onRemove={handleRemove} />
            ))}
          </div>
          </div>
        )}

        {/* Add form */}
        {showForm ? (
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">اسم الموقع / الأصل <span className="text-destructive">*</span></Label>
                <Input
                  value={form.name}
                  onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                  placeholder="مثال: فيلا حي النرجس"
                  className="text-sm"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">المدينة</Label>
                <Input
                  value={form.city}
                  onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                  placeholder="مثال: الرياض"
                  className="text-sm"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">رابط خرائط قوقل <span className="text-destructive">*</span></Label>
              <Input
                value={form.googleMapsUrl}
                onChange={e => { setForm(p => ({ ...p, googleMapsUrl: e.target.value })); setUrlError(""); }}
                placeholder="https://maps.google.com/..."
                className="text-sm font-mono"
                dir="ltr"
              />
              {urlError && <p className="text-[11px] text-destructive">{urlError}</p>}
              <p className="text-[10px] text-muted-foreground">
                افتح خرائط قوقل → حدد الموقع → اضغط "مشاركة" → انسخ الرابط والصقه هنا
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleAdd} disabled={!form.name.trim() || !form.googleMapsUrl.trim()} className="text-xs gap-1">
                <Plus className="w-3.5 h-3.5" />
                إضافة الموقع
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setShowForm(false); setUrlError(""); }} className="text-xs">
                إلغاء
              </Button>
            </div>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowForm(true)}
            className="w-full border-dashed text-xs gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            {locations.length === 0 ? "إضافة موقع الأصل" : "إضافة موقع آخر"}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

function LocationChip({ location, onRemove }: { location: AssetLocation; onRemove: (id: string) => void }) {
  return (
    <div className="group inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card border border-border hover:border-primary/40 transition-colors shadow-sm">
      <a
        href={location.googleMapsUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary transition-colors"
        title="فتح في خرائط قوقل"
      >
        <Navigation className="w-3.5 h-3.5 text-primary shrink-0" />
        <span className="max-w-[160px] truncate">{location.name}</span>
        <ExternalLink className="w-3 h-3 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </a>
      <button
        onClick={() => onRemove(location.id)}
        className="text-muted-foreground hover:text-destructive transition-colors opacity-0 group-hover:opacity-100 mr-0.5"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
