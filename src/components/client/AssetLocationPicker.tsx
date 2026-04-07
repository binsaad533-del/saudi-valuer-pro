import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MapPin, Plus, X, ExternalLink, Navigation, Link2, LocateFixed } from "lucide-react";

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
  maxLocations?: number;
  compact?: boolean;
}

type InputMode = "url" | "coords";

function extractCoordsFromUrl(url: string): { lat?: number; lng?: number } {
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

function isValidCoordinate(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

function coordsToGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${lat},${lng}`;
}

export default function AssetLocationPicker({ locations, onChange, maxLocations = 50, compact = false }: AssetLocationPickerProps) {
  const [showForm, setShowForm] = useState(false);
  const [quickUrl, setQuickUrl] = useState("");
  const [quickUrlError, setQuickUrlError] = useState("");
  const [inputMode, setInputMode] = useState<InputMode>("url");
  const [form, setForm] = useState({ name: "", city: "", googleMapsUrl: "" });
  const [coordsForm, setCoordsForm] = useState({ name: "", city: "", latitude: "", longitude: "" });
  const [urlError, setUrlError] = useState("");
  const [coordsError, setCoordsError] = useState("");

  const atLimit = locations.length >= maxLocations;

  const handleQuickAdd = () => {
    const url = quickUrl.trim();
    if (!url) return;
    if (!isValidGoogleMapsUrl(url)) {
      setQuickUrlError("يرجى إدخال رابط خرائط قوقل صالح");
      return;
    }
    if (atLimit) return;
    const coords = extractCoordsFromUrl(url);
    const newLocation: AssetLocation = {
      id: crypto.randomUUID(),
      name: `موقع ${locations.length + 1}`,
      city: "",
      googleMapsUrl: url,
      latitude: coords.lat,
      longitude: coords.lng,
    };
    onChange([...locations, newLocation]);
    setQuickUrl("");
    setQuickUrlError("");
  };

  const handleAddFromUrl = () => {
    if (atLimit) return;
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

  const handleAddFromCoords = () => {
    if (atLimit) return;
    if (!coordsForm.name.trim() || !coordsForm.latitude.trim() || !coordsForm.longitude.trim()) return;

    const lat = parseFloat(coordsForm.latitude);
    const lng = parseFloat(coordsForm.longitude);

    if (isNaN(lat) || isNaN(lng) || !isValidCoordinate(lat, lng)) {
      setCoordsError("إحداثيات غير صالحة. خط العرض: -90 إلى 90، خط الطول: -180 إلى 180");
      return;
    }

    const newLocation: AssetLocation = {
      id: crypto.randomUUID(),
      name: coordsForm.name.trim(),
      city: coordsForm.city.trim(),
      googleMapsUrl: coordsToGoogleMapsUrl(lat, lng),
      latitude: lat,
      longitude: lng,
    };

    onChange([...locations, newLocation]);
    setCoordsForm({ name: "", city: "", latitude: "", longitude: "" });
    setCoordsError("");
    setShowForm(false);
  };

  const handleRemove = (id: string) => {
    onChange(locations.filter(l => l.id !== id));
  };

  const resetAndClose = () => {
    setShowForm(false);
    setUrlError("");
    setCoordsError("");
  };

  if (compact) {
    return (
      <div className="space-y-3">
        {/* Quick URL paste */}
        {!atLimit && (
          <div className="flex gap-2">
            <Input
              value={quickUrl}
              onChange={e => { setQuickUrl(e.target.value); setQuickUrlError(""); }}
              placeholder="الصق رابط خرائط قوقل هنا..."
              className="text-sm font-mono flex-1"
              dir="ltr"
              onKeyDown={e => { if (e.key === "Enter") handleQuickAdd(); }}
            />
            <Button size="sm" onClick={handleQuickAdd} disabled={!quickUrl.trim()} className="text-xs gap-1 shrink-0">
              <Plus className="w-3.5 h-3.5" />
              إضافة
            </Button>
          </div>
        )}
        {quickUrlError && <p className="text-[11px] text-destructive">{quickUrlError}</p>}

        {/* Location chips */}
        {locations.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {locations.map(loc => (
              <LocationChip key={loc.id} location={loc} onRemove={handleRemove} />
            ))}
          </div>
        )}

        <div className="flex items-center justify-between">
          {!atLimit && (
            <Button variant="ghost" size="sm" onClick={() => setShowForm(!showForm)} className="text-[11px] gap-1 text-muted-foreground">
              <LocateFixed className="w-3 h-3" />
              إضافة بالإحداثيات أو بالتفاصيل
            </Button>
          )}
          <span className="text-[10px] text-muted-foreground">{locations.length} / {maxLocations}</span>
        </div>

        {atLimit && (
          <p className="text-[11px] text-amber-600 bg-amber-50 rounded-md px-2 py-1">تم الوصول للحد الأقصى ({maxLocations} موقع)</p>
        )}

        {/* Detailed form */}
        {showForm && !atLimit && (
          <div className="p-3 rounded-lg border border-primary/20 bg-primary/5 space-y-3">
            <div className="flex gap-1 p-0.5 rounded-lg bg-muted w-fit">
              <button
                onClick={() => { setInputMode("url"); setCoordsError(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  inputMode === "url" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                رابط
              </button>
              <button
                onClick={() => { setInputMode("coords"); setUrlError(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  inputMode === "coords" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LocateFixed className="w-3.5 h-3.5" />
                إحداثيات
              </button>
            </div>

            {inputMode === "url" ? (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">اسم الموقع <span className="text-destructive">*</span></Label>
                    <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: فيلا حي النرجس" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">المدينة</Label>
                    <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))} placeholder="مثال: الرياض" className="text-sm" />
                  </div>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">رابط خرائط قوقل <span className="text-destructive">*</span></Label>
                  <Input value={form.googleMapsUrl} onChange={e => { setForm(p => ({ ...p, googleMapsUrl: e.target.value })); setUrlError(""); }} placeholder="https://maps.google.com/..." className="text-sm font-mono" dir="ltr" />
                  {urlError && <p className="text-[11px] text-destructive">{urlError}</p>}
                </div>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddFromUrl} disabled={!form.name.trim() || !form.googleMapsUrl.trim()} className="text-xs gap-1"><Plus className="w-3.5 h-3.5" />إضافة</Button>
                  <Button size="sm" variant="ghost" onClick={resetAndClose} className="text-xs">إلغاء</Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">اسم الموقع <span className="text-destructive">*</span></Label>
                    <Input value={coordsForm.name} onChange={e => setCoordsForm(p => ({ ...p, name: e.target.value }))} placeholder="مثال: مصنع" className="text-sm" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">المدينة</Label>
                    <Input value={coordsForm.city} onChange={e => setCoordsForm(p => ({ ...p, city: e.target.value }))} placeholder="مثال: جدة" className="text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">خط العرض <span className="text-destructive">*</span></Label>
                    <Input value={coordsForm.latitude} onChange={e => { setCoordsForm(p => ({ ...p, latitude: e.target.value })); setCoordsError(""); }} placeholder="24.7136" className="text-sm font-mono" dir="ltr" inputMode="decimal" />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">خط الطول <span className="text-destructive">*</span></Label>
                    <Input value={coordsForm.longitude} onChange={e => { setCoordsForm(p => ({ ...p, longitude: e.target.value })); setCoordsError(""); }} placeholder="46.6753" className="text-sm font-mono" dir="ltr" inputMode="decimal" />
                  </div>
                </div>
                {coordsError && <p className="text-[11px] text-destructive">{coordsError}</p>}
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddFromCoords} disabled={!coordsForm.name.trim() || !coordsForm.latitude.trim() || !coordsForm.longitude.trim()} className="text-xs gap-1"><Plus className="w-3.5 h-3.5" />إضافة</Button>
                  <Button size="sm" variant="ghost" onClick={resetAndClose} className="text-xs">إلغاء</Button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <MapPin className="w-5 h-5 text-primary" />
          مواقع الأصول
          <span className="text-xs text-muted-foreground font-normal">({locations.length} / {maxLocations})</span>
        </CardTitle>
        <p className="text-sm text-muted-foreground mt-1">
          أضف مواقع الأصول المراد تقييمها عبر رابط خرائط قوقل أو إحداثيات GPS مباشرة.
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
            {/* Mode toggle */}
            <div className="flex gap-1 p-0.5 rounded-lg bg-muted w-fit">
              <button
                onClick={() => { setInputMode("url"); setCoordsError(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  inputMode === "url" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Link2 className="w-3.5 h-3.5" />
                رابط خرائط قوقل
              </button>
              <button
                onClick={() => { setInputMode("coords"); setUrlError(""); }}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                  inputMode === "coords" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LocateFixed className="w-3.5 h-3.5" />
                إحداثيات GPS
              </button>
            </div>

            {inputMode === "url" ? (
              <>
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
                  <Button size="sm" onClick={handleAddFromUrl} disabled={!form.name.trim() || !form.googleMapsUrl.trim()} className="text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    إضافة الموقع
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetAndClose} className="text-xs">إلغاء</Button>
                </div>
              </>
            ) : (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">اسم الموقع / الأصل <span className="text-destructive">*</span></Label>
                    <Input
                      value={coordsForm.name}
                      onChange={e => setCoordsForm(p => ({ ...p, name: e.target.value }))}
                      placeholder="مثال: مصنع المنطقة الصناعية"
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">المدينة</Label>
                    <Input
                      value={coordsForm.city}
                      onChange={e => setCoordsForm(p => ({ ...p, city: e.target.value }))}
                      placeholder="مثال: جدة"
                      className="text-sm"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs">خط العرض (Latitude) <span className="text-destructive">*</span></Label>
                    <Input
                      value={coordsForm.latitude}
                      onChange={e => { setCoordsForm(p => ({ ...p, latitude: e.target.value })); setCoordsError(""); }}
                      placeholder="مثال: 24.7136"
                      className="text-sm font-mono"
                      dir="ltr"
                      type="text"
                      inputMode="decimal"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs">خط الطول (Longitude) <span className="text-destructive">*</span></Label>
                    <Input
                      value={coordsForm.longitude}
                      onChange={e => { setCoordsForm(p => ({ ...p, longitude: e.target.value })); setCoordsError(""); }}
                      placeholder="مثال: 46.6753"
                      className="text-sm font-mono"
                      dir="ltr"
                      type="text"
                      inputMode="decimal"
                    />
                  </div>
                </div>
                {coordsError && <p className="text-[11px] text-destructive">{coordsError}</p>}
                <p className="text-[10px] text-muted-foreground">
                  يمكنك نسخ الإحداثيات من خرائط قوقل بالضغط مطولاً على الموقع، أو من أي تطبيق GPS
                </p>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleAddFromCoords} disabled={!coordsForm.name.trim() || !coordsForm.latitude.trim() || !coordsForm.longitude.trim()} className="text-xs gap-1">
                    <Plus className="w-3.5 h-3.5" />
                    إضافة الموقع
                  </Button>
                  <Button size="sm" variant="ghost" onClick={resetAndClose} className="text-xs">إلغاء</Button>
                </div>
              </>
            )}
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
        {location.latitude && location.longitude && (
          <Badge variant="outline" className="text-[9px] px-1 py-0 font-mono">
            {location.latitude.toFixed(4)},{location.longitude.toFixed(4)}
          </Badge>
        )}
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