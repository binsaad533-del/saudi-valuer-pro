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

export default function SectionDimensions({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  const facades = [
    { key: "north", label: "الشمال", icon: "⬆️" },
    { key: "south", label: "الجنوب", icon: "⬇️" },
    { key: "east", label: "الشرق", icon: "➡️" },
    { key: "west", label: "الغرب", icon: "⬅️" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={4} title="الحدود والمساحة" icon={Ruler} subtitle="المساحة الإجمالية وأطوال الواجهات" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="المساحة الإجمالية (م²)" required>
          <Input type="number" value={formData.total_area} onChange={(e: any) => updateField("total_area", e.target.value)} placeholder="مثال: 625" />
        </FieldGroup>

        <Separator />
        <p className="text-xs font-bold text-muted-foreground">الواجهات والحدود</p>

        {facades.map(f => {
          const lengthKey = `front_${f.key}_length` as keyof typeof formData;
          const descKey = `front_${f.key}_desc` as keyof typeof formData;
          const boundaryKey = `front_${f.key}_boundary` as keyof typeof formData;
          const plateKey = `front_${f.key}_plate` as keyof typeof formData;
          const isStreet = formData[boundaryKey] === "street";
          return (
            <div key={f.key} className="border rounded-lg p-3 space-y-2">
              <p className="text-sm font-medium flex items-center gap-1.5">{f.icon} {f.label}</p>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <Label className="text-xs text-muted-foreground">الطول (م)</Label>
                  <Input type="number" value={String(formData[lengthKey] || "")} onChange={(e: any) => updateField(lengthKey, e.target.value)} placeholder="0" className="mt-1" />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">نوع الحد</Label>
                  <Select value={String(formData[boundaryKey] || "")} onValueChange={(v: string) => updateField(boundaryKey, v)}>
                    <SelectTrigger className="mt-1"><SelectValue placeholder="اختر" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="street">شارع</SelectItem>
                      <SelectItem value="neighbor">جار</SelectItem>
                      <SelectItem value="wall">سور</SelectItem>
                      <SelectItem value="passage">ممر</SelectItem>
                      <SelectItem value="other">أخرى</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">يطل على</Label>
                <Input value={String(formData[descKey] || "")} onChange={(e: any) => updateField(descKey, e.target.value)} placeholder="وصف: شارع 15م / جار عبدالله / ..." className="mt-1" />
              </div>
              {isStreet && (
                <div>
                  <Label className="text-xs text-muted-foreground">رقم لوحة الشارع (إن وجدت)</Label>
                  <Input value={String(formData[plateKey] || "")} onChange={(e: any) => updateField(plateKey, e.target.value)} placeholder="مثال: شارع 25" className="mt-1" />
                </div>
              )}
            </div>
          );
        })}

        <Separator />

        <FieldGroup label="تطابق المساحة مع الصك" required>
          <RadioGroup value={formData.area_matches_deed} onValueChange={(v: string) => updateField("area_matches_deed", v)} className="flex gap-2">
            {[{ value: "yes", label: "✅ نعم" }, { value: "no", label: "❌ لا" }, { value: "slight_diff", label: "↔️ فرق بسيط" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.area_matches_deed === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        {formData.area_matches_deed === "no" && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> تنبيه: عدم تطابق المساحة يستوجب توثيق الفارق بالتفصيل
            </p>
          </div>
        )}

        <Separator />

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="مساحة الأرض (م²)">
            <Input type="number" value={formData.land_area} onChange={(e: any) => updateField("land_area", e.target.value)} placeholder="0" />
          </FieldGroup>
          <FieldGroup label="المساحة المبنية (م²)">
            <Input type="number" value={formData.building_area} onChange={(e: any) => updateField("building_area", e.target.value)} placeholder="0" />
          </FieldGroup>
        </div>
        <FieldGroup label="عدد الأدوار">
          <Input type="number" value={formData.num_floors} onChange={(e: any) => updateField("num_floors", e.target.value)} placeholder="0" />
        </FieldGroup>
        <FieldGroup label="ملاحظات إضافية">
          <Textarea value={formData.dimensions_notes} onChange={(e: any) => updateField("dimensions_notes", e.target.value)} placeholder="عدد الوحدات، المواقف، الملاحق، السرداب..." rows={3} />
        </FieldGroup>

        {/* رفع صورة مخطط الموقع */}
        <div className="border border-dashed border-primary/30 rounded-lg p-4 space-y-3 bg-primary/5">
          <div className="flex items-center gap-2">
            <Upload className="w-4 h-4 text-primary" />
            <span className="text-sm font-bold text-primary">رفع صورة مخطط الموقع</span>
          </div>
          <p className="text-xs text-muted-foreground">أرفق مخطط الموقع المعتمد أو الكروكي (صورة أو مسح ضوئي)</p>
          <SectionPhotoUpload section="site_plan" label="مخطط الموقع" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        </div>

        <SectionPhotoUpload section="dimensions" label="صور القياسات والمخططات" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="dimensions"
          promptHint="تحليل الحدود والمساحات"
          context={{ total_area: formData.total_area, land_area: formData.land_area, building_area: formData.building_area, num_floors: formData.num_floors, front_north_length: formData.front_north_length, front_south_length: formData.front_south_length, front_east_length: formData.front_east_length, front_west_length: formData.front_west_length }}
        />
      </CardContent>
    </Card>
  );
}

