import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  MapPin, Camera, ClipboardCheck, Send, ChevronRight, ChevronLeft, ChevronDown,
  Loader2, CheckCircle, AlertTriangle, Navigation, Trash2,
  Info, Building2, Ruler, Wrench, Zap, TrendingUp, ShieldAlert,
  FileCheck, UserCheck, Home, Upload, LayoutGrid, Sparkles, Copy, Lock,
} from "lucide-react";
import SectionPhotoUpload, { type SectionPhoto } from "@/components/inspection/SectionPhotoUpload";
import AiSuggestionBox from "@/components/inspection/AiSuggestionBox";
import { SectionHeader, FieldGroup, ExpandableSection } from "./helpers";
import type { FormData, PhotoItem, ChecklistItem } from "./types";
import { toast } from "sonner";

export default function SectionLocation({ formData, updateField, gpsLoading, gpsError, onCaptureGPS, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  const nearbyServices = [
    { key: "mosque", label: "مسجد", icon: "🕌" },
    { key: "school", label: "مدرسة", icon: "🏫" },
    { key: "hospital", label: "مستشفى", icon: "🏥" },
    { key: "mall", label: "مول / مركز تجاري", icon: "🛒" },
    { key: "highway", label: "طريق رئيسي", icon: "🛣️" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={2} title="الموقع والمحيط" icon={MapPin} subtitle="وصف الحي والخدمات المحيطة" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* نوع الحي */}
        <FieldGroup label="نوع الحي" required>
          <RadioGroup value={formData.district_type} onValueChange={(v: string) => updateField("district_type", v)} className="flex gap-2">
            {[{ value: "residential", label: "سكني" }, { value: "commercial", label: "تجاري" }, { value: "mixed", label: "مختلط" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.district_type === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        {/* مستوى الحي */}
        <FieldGroup label="مستوى الحي" required>
          <RadioGroup value={formData.district_level} onValueChange={(v: string) => updateField("district_level", v)} className="flex gap-2">
            {[{ value: "upscale", label: "راقي" }, { value: "average", label: "متوسط" }, { value: "popular", label: "شعبي" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.district_level === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <Separator />

        {/* قرب الخدمات */}
        <p className="text-xs font-bold text-muted-foreground">قرب الخدمات</p>
        <div className="space-y-3">
          {nearbyServices.map(svc => {
            const fieldYes = `nearby_${svc.key}` as keyof typeof formData;
            const fieldDist = `nearby_${svc.key}_distance` as keyof typeof formData;
            const isYes = formData[fieldYes] === "yes";
            return (
              <div key={svc.key} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm flex items-center gap-1.5">{svc.icon} {svc.label}</span>
                  <RadioGroup value={String(formData[fieldYes] || "")} onValueChange={(v: string) => updateField(fieldYes, v)} className="flex gap-1.5">
                    <label className={`px-3 py-1 border rounded-md text-xs cursor-pointer transition-colors ${isYes ? "border-primary bg-primary/10 font-medium" : "border-border"}`}>
                      <RadioGroupItem value="yes" className="sr-only" />نعم
                    </label>
                    <label className={`px-3 py-1 border rounded-md text-xs cursor-pointer transition-colors ${formData[fieldYes] === "no" ? "border-muted-foreground bg-muted font-medium" : "border-border"}`}>
                      <RadioGroupItem value="no" className="sr-only" />لا
                    </label>
                  </RadioGroup>
                </div>
                {isYes && (
                  <Input
                    value={String(formData[fieldDist] || "")}
                    onChange={(e: any) => updateField(fieldDist, e.target.value)}
                    placeholder="المسافة التقريبية (مثال: 500 متر)"
                    className="h-8 text-xs"
                  />
                )}
              </div>
            );
          })}
        </div>

        <Separator />

        {/* GPS */}
        <FieldGroup label="الإحداثيات (GPS)" required>
          {formData.gps_lat && formData.gps_lng ? (
            <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-3 text-center space-y-1 border border-green-200 dark:border-green-800">
              <CheckCircle className="w-6 h-6 text-green-600 mx-auto" />
              <p className="text-sm font-medium text-green-700 dark:text-green-400">تم تحديد الموقع</p>
              <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                {formData.gps_lat.toFixed(6)}, {formData.gps_lng.toFixed(6)}
              </p>
            </div>
          ) : gpsError ? (
            <div className="bg-destructive/10 rounded-lg p-3 text-center">
              <AlertTriangle className="w-6 h-6 text-destructive mx-auto" />
              <p className="text-sm text-destructive mt-1">{gpsError}</p>
            </div>
          ) : null}
          <Button onClick={onCaptureGPS} disabled={gpsLoading} className="w-full h-12" variant={formData.gps_lat ? "outline" : "default"}>
            {gpsLoading ? <Loader2 className="w-5 h-5 animate-spin ml-2" /> : <Navigation className="w-5 h-5 ml-2" />}
            {formData.gps_lat ? "إعادة تحديد الموقع" : "تحديد الموقع"}
          </Button>
        </FieldGroup>

        <FieldGroup label="سهولة الوصول">
          <RadioGroup value={formData.access_ease} onValueChange={(v: string) => updateField("access_ease", v)} className="flex gap-2">
            {[{ value: "excellent", label: "ممتاز" }, { value: "good", label: "جيد" }, { value: "poor", label: "ضعيف" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.access_ease === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <Separator />

        <FieldGroup label="✅ إيجابيات المحيط">
          <Textarea value={formData.surrounding_positives} onChange={(e: any) => updateField("surrounding_positives", e.target.value)} placeholder="مثال: قرب من مدارس ومساجد، شوارع مسفلتة، إنارة جيدة، حدائق..." rows={3} />
        </FieldGroup>
        <FieldGroup label="⚠️ سلبيات المحيط">
          <Textarea value={formData.surrounding_negatives} onChange={(e: any) => updateField("surrounding_negatives", e.target.value)} placeholder="مثال: ضوضاء، ازدحام مروري، قرب من محطة كهرباء، أرض فضاء مهملة..." rows={3} />
        </FieldGroup>

        <SectionPhotoUpload section="location" label="صور الموقع والمحيط" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />

        <div className="border border-muted bg-muted/40 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground">🔒 ملاحظات الموقع للمعاين (سرية — للمقيّم فقط)</span>
          </div>
          <Textarea
            value={formData.location_confidential_notes}
            onChange={(e: any) => updateField("location_confidential_notes", e.target.value)}
            placeholder="ملاحظات سرية عن الموقع لا تظهر في التقرير..."
            rows={2}
            className="border-muted bg-background"
          />
        </div>

        <AiSuggestionBox
          sectionKey="location"
          promptHint="تحليل الموقع والمحيط والخدمات القريبة"
          context={{
            district_type: formData.district_type,
            district_level: formData.district_level,
            nearby_mosque: formData.nearby_mosque,
            nearby_school: formData.nearby_school,
            nearby_hospital: formData.nearby_hospital,
            nearby_mall: formData.nearby_mall,
            nearby_highway: formData.nearby_highway,
            surrounding_positives: formData.surrounding_positives,
            surrounding_negatives: formData.surrounding_negatives,
            access_ease: formData.access_ease,
          }}
        />
      </CardContent>
    </Card>
  );
}

