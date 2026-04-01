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

export default function SectionCondition({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={7} title="حالة الأصل" icon={Wrench} subtitle="تقييم الحالة الفعلية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="الحالة العامة" required>
          <RadioGroup value={formData.overall_condition} onValueChange={(v: string) => updateField("overall_condition", v)} className="grid grid-cols-2 gap-2">
            {[
              { value: "excellent", label: "ممتاز", color: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "good", label: "جيد", color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
              { value: "average", label: "متوسط", color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
              { value: "poor", label: "سيء", color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.overall_condition === opt.value ? opt.color + " font-bold" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        <FieldGroup label="عمر الأصل (بالسنوات)">
          <Input type="number" value={formData.asset_age} onChange={(e: any) => updateField("asset_age", e.target.value)} placeholder="مثال: 10" />
        </FieldGroup>
        <FieldGroup label="مستوى التشطيب">
          <Select value={formData.finishing_level} onValueChange={(v: string) => updateField("finishing_level", v)}>
            <SelectTrigger><SelectValue placeholder="اختر مستوى التشطيب" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="luxury">فاخر (لوكس)</SelectItem>
              <SelectItem value="super">سوبر ديلوكس</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="standard">عادي</SelectItem>
              <SelectItem value="under_construction">تحت الإنشاء</SelectItem>
              <SelectItem value="shell">عظم</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="التقييم الكلي للصيانة" required>
          <RadioGroup value={formData.maintenance_rating} onValueChange={(v: string) => updateField("maintenance_rating", v)} className="grid grid-cols-3 gap-2">
            {[
              { value: "excellent", label: "ممتازة", color: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "good", label: "جيدة", color: "border-blue-500 bg-blue-50 dark:bg-blue-900/20" },
              { value: "average", label: "متوسطة", color: "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20" },
              { value: "needs_maintenance", label: "تحتاج صيانة", color: "border-orange-500 bg-orange-50 dark:bg-orange-900/20" },
              { value: "poor", label: "رديئة", color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.maintenance_rating === opt.value ? opt.color + " font-bold" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <Separator />

        <p className="text-xs font-bold text-muted-foreground">🔍 الأضرار والعيوب المكتشفة</p>
        <div className="space-y-2">
          {[
            { key: "cracks_severity", label: "تشققات", icon: "🧱" },
            { key: "moisture_severity", label: "رطوبة / تسربات", icon: "💧" },
            { key: "corrosion_severity", label: "تآكل / صدأ", icon: "⚙️" },
            { key: "fire_damage_severity", label: "أضرار حريق", icon: "🔥" },
            { key: "structural_damage_severity", label: "أضرار هيكلية", icon: "🏗️" },
          ].map(item => (
            <div key={item.key} className={`flex items-center justify-between border rounded-lg p-3 transition-colors ${formData[item.key] && formData[item.key] !== "none" ? (formData[item.key] === "severe" ? "border-destructive/50 bg-destructive/5" : formData[item.key] === "moderate" ? "border-orange-400/50 bg-orange-50/50 dark:bg-orange-900/10" : "border-yellow-400/50 bg-yellow-50/50 dark:bg-yellow-900/10") : "border-border"}`}>
              <span className="text-sm font-medium">{item.icon} {item.label}</span>
              <Select value={formData[item.key] || "none"} onValueChange={(v: string) => updateField(item.key, v)}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">لا يوجد</SelectItem>
                  <SelectItem value="minor">بسيط</SelectItem>
                  <SelectItem value="moderate">متوسط</SelectItem>
                  <SelectItem value="severe">خطير</SelectItem>
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>

        {[formData.cracks_severity, formData.moisture_severity, formData.corrosion_severity, formData.fire_damage_severity, formData.structural_damage_severity].some((v: string) => v && v !== "none") && (
          <FieldGroup label="تفاصيل الأضرار">
            <Textarea value={formData.damage_details} onChange={(e: any) => updateField("damage_details", e.target.value)} placeholder="صف الأضرار بالتفصيل: موقعها، حجمها، تأثيرها..." rows={3} />
          </FieldGroup>
        )}

        <FieldGroup label="ملاحظات الحالة">
          <Textarea value={formData.condition_notes} onChange={(e: any) => updateField("condition_notes", e.target.value)} placeholder="تفاصيل عن الحالة الإنشائية، التشطيبات، العيوب..." rows={3} />
        </FieldGroup>
        <SectionPhotoUpload section="condition" label="صور حالة الأصل والعيوب" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="damage" label="📸 صور المشاكل والأضرار (تشققات، رطوبة، تلف)" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="condition"
          promptHint="تقييم حالة الأصل والصيانة مع تقدير تكلفة الصيانة المتوقعة"
          context={{ overall_condition: formData.overall_condition, asset_age: formData.asset_age, finishing_level: formData.finishing_level, maintenance_rating: formData.maintenance_rating, cracks_severity: formData.cracks_severity, moisture_severity: formData.moisture_severity, corrosion_severity: formData.corrosion_severity, fire_damage_severity: formData.fire_damage_severity, structural_damage_severity: formData.structural_damage_severity, damage_details: formData.damage_details, condition_notes: formData.condition_notes }}
        />
      </CardContent>
    </Card>
  );
}

