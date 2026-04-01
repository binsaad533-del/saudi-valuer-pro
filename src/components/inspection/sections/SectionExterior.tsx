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

export default function SectionExterior({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  const conditionOptions = [
    { value: "excellent", label: "ممتازة" },
    { value: "good", label: "جيدة" },
    { value: "acceptable", label: "مقبولة" },
    { value: "poor", label: "رديئة" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={5} title="المبنى - الخارج" icon={Home} subtitle="وصف مكونات المبنى الخارجية وحالتها" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* بيانات المبنى الأساسية */}
        <p className="text-xs font-bold text-muted-foreground">🏢 بيانات المبنى الأساسية</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="عمر المبنى (سنة)" required>
            <Input type="number" value={formData.exterior_building_age} onChange={(e: any) => updateField("exterior_building_age", e.target.value)} placeholder="مثال: 10" />
          </FieldGroup>
          <FieldGroup label="عدد الأدوار" required>
            <Input type="number" value={formData.exterior_num_floors} onChange={(e: any) => updateField("exterior_num_floors", e.target.value)} placeholder="مثال: 3" />
          </FieldGroup>
        </div>
        <FieldGroup label="نوع الهيكل الإنشائي" required>
          <RadioGroup value={formData.exterior_structure_type} onValueChange={(v: string) => updateField("exterior_structure_type", v)} className="flex gap-2">
            {[{ value: "concrete", label: "خرساني" }, { value: "steel", label: "حديدي" }, { value: "wood", label: "خشبي" }, { value: "mixed", label: "مختلط" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2.5 cursor-pointer text-xs transition-colors ${formData.exterior_structure_type === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <Separator />

        {/* الواجهة */}
        <ExpandableSection icon="🏗️" title="الواجهة الخارجية" defaultOpen>
        <FieldGroup label="مادة الواجهة" required>
          <Select value={formData.exterior_facade_material} onValueChange={(v: string) => updateField("exterior_facade_material", v)}>
            <SelectTrigger><SelectValue placeholder="اختر مادة الواجهة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="stone">حجر</SelectItem>
              <SelectItem value="brick">طوب</SelectItem>
              <SelectItem value="plaster">لياسة / بياض</SelectItem>
              <SelectItem value="glass">زجاج</SelectItem>
              <SelectItem value="cladding">كلادينج</SelectItem>
              <SelectItem value="mixed">مختلط</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="حالة الواجهة">
          <RadioGroup value={formData.exterior_facade_condition} onValueChange={(v: string) => updateField("exterior_facade_condition", v)} className="flex gap-2">
            {conditionOptions.map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_facade_condition === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <FieldGroup label="نوع تشطيب الواجهة">
          <Select value={formData.exterior_facade_finishing} onValueChange={(v: string) => updateField("exterior_facade_finishing", v)}>
            <SelectTrigger><SelectValue placeholder="اختر نوع التشطيب" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="paint">دهان</SelectItem>
              <SelectItem value="stone_cladding">تكسية حجرية</SelectItem>
              <SelectItem value="marble">رخام</SelectItem>
              <SelectItem value="ceramic">سيراميك</SelectItem>
              <SelectItem value="grc">GRC</SelectItem>
              <SelectItem value="curtain_wall">حائط ستائري (زجاج)</SelectItem>
              <SelectItem value="composite">مركّب / مختلط</SelectItem>
              <SelectItem value="none">بدون تشطيب</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup label="حالة الدهان الخارجي">
          <RadioGroup value={formData.exterior_paint_condition} onValueChange={(v: string) => updateField("exterior_paint_condition", v)} className="flex gap-2">
            {conditionOptions.map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_paint_condition === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        </ExpandableSection>

        {/* النوافذ والأبواب */}
        <ExpandableSection icon="🪟" title="النوافذ والأبواب">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع النوافذ">
            <Select value={formData.exterior_windows_type} onValueChange={(v: string) => updateField("exterior_windows_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aluminum">ألمنيوم</SelectItem>
                <SelectItem value="upvc">UPVC</SelectItem>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة النوافذ">
            <Select value={formData.exterior_windows_condition} onValueChange={(v: string) => updateField("exterior_windows_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع الأبواب الخارجية">
            <Select value={formData.exterior_doors_type} onValueChange={(v: string) => updateField("exterior_doors_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
                <SelectItem value="aluminum">ألمنيوم</SelectItem>
                <SelectItem value="glass">زجاج</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الأبواب">
            <Select value={formData.exterior_doors_condition} onValueChange={(v: string) => updateField("exterior_doors_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        </ExpandableSection>

        {/* السطح */}
        <ExpandableSection icon="🏠" title="السطح والعزل">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع السطح">
            <Select value={formData.exterior_roof_type} onValueChange={(v: string) => updateField("exterior_roof_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="concrete">خرساني</SelectItem>
                <SelectItem value="steel">حديد / معدني</SelectItem>
                <SelectItem value="tiles">قرميد</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة السطح">
            <Select value={formData.exterior_roof_condition} onValueChange={(v: string) => updateField("exterior_roof_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="العزل">
            <Select value={formData.exterior_roof_insulation} onValueChange={(v: string) => updateField("exterior_roof_insulation", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="thermal_water">حراري ومائي</SelectItem>
                <SelectItem value="thermal">حراري فقط</SelectItem>
                <SelectItem value="water">مائي فقط</SelectItem>
                <SelectItem value="none">بدون عزل</SelectItem>
                <SelectItem value="unknown">غير معروف</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="تسربات مائية">
            <RadioGroup value={formData.exterior_roof_leaks} onValueChange={(v: string) => updateField("exterior_roof_leaks", v)} className="flex gap-2">
              {[{ value: "no", label: "لا يوجد" }, { value: "minor", label: "بسيطة" }, { value: "major", label: "كبيرة" }].map(opt => (
                <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_roof_leaks === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                  <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
                </label>
              ))}
            </RadioGroup>
          </FieldGroup>
        </div>
        </ExpandableSection>

        {/* الأسوار والمداخل والمواقف */}
        <ExpandableSection icon="🚧" title="الأسوار والمدخل والمواقف">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع السور">
            <Select value={formData.exterior_fence_type} onValueChange={(v: string) => updateField("exterior_fence_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="concrete_block">بلك خرساني</SelectItem>
                <SelectItem value="stone">حجر</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
                <SelectItem value="none">لا يوجد</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة السور">
            <Select value={formData.exterior_fence_condition} onValueChange={(v: string) => updateField("exterior_fence_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع المدخل الرئيسي">
            <Select value={formData.exterior_main_entrance_type} onValueChange={(v: string) => updateField("exterior_main_entrance_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="iron_gate">بوابة حديد</SelectItem>
                <SelectItem value="automatic">بوابة أوتوماتيك</SelectItem>
                <SelectItem value="glass_door">باب زجاجي</SelectItem>
                <SelectItem value="wood_door">باب خشبي</SelectItem>
                <SelectItem value="open">مفتوح (بدون بوابة)</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة المدخل">
            <Select value={formData.exterior_main_entrance_condition} onValueChange={(v: string) => updateField("exterior_main_entrance_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        <FieldGroup label="المواقف">
          <RadioGroup value={formData.exterior_parking} onValueChange={(v: string) => updateField("exterior_parking", v)} className="flex gap-2">
            {[{ value: "covered", label: "مغطاة" }, { value: "open", label: "مفتوحة" }, { value: "basement", label: "سرداب" }, { value: "none", label: "لا يوجد" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_parking === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        {formData.exterior_parking && formData.exterior_parking !== "none" && (
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="عدد المواقف">
              <Input type="number" value={formData.exterior_parking_count} onChange={(e: any) => updateField("exterior_parking_count", e.target.value)} placeholder="0" />
            </FieldGroup>
            <FieldGroup label="حالة المواقف">
              <Select value={formData.exterior_parking_condition} onValueChange={(v: string) => updateField("exterior_parking_condition", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>
        )}

        <FieldGroup label="التشجير والمسطحات الخضراء">
          <RadioGroup value={formData.exterior_landscaping} onValueChange={(v: string) => updateField("exterior_landscaping", v)} className="flex gap-2">
            {[{ value: "excellent", label: "ممتاز" }, { value: "average", label: "متوسط" }, { value: "none", label: "لا يوجد" }].map(opt => (
              <label key={opt.value} className={`flex-1 text-center border rounded-lg p-2 cursor-pointer text-xs transition-colors ${formData.exterior_landscaping === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <FieldGroup label="عدد المداخل">
          <Input type="number" value={formData.exterior_entrance_count} onChange={(e: any) => updateField("exterior_entrance_count", e.target.value)} placeholder="مثال: 2" />
        </FieldGroup>
        </ExpandableSection>

        <ExpandableSection icon="📝" title="ملاحظات إضافية">
        <FieldGroup label="ملاحظات إضافية">
          <Textarea value={formData.exterior_notes} onChange={(e: any) => updateField("exterior_notes", e.target.value)} placeholder="أي ملاحظات إضافية عن الحالة الخارجية للمبنى..." rows={3} />
        </FieldGroup>
        </ExpandableSection>

        <Separator />
        <p className="text-xs font-bold text-muted-foreground">📸 صور الواجهات</p>
        <SectionPhotoUpload section="exterior_front" label="الواجهة الأمامية" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="exterior_back" label="الواجهة الخلفية" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="exterior_side" label="الواجهة الجانبية" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="exterior_general" label="صور عامة للمبنى" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="exterior"
          promptHint="تحليل حالة المبنى الخارجية"
          context={{
            facade_material: formData.exterior_facade_material,
            facade_condition: formData.exterior_facade_condition,
            paint_condition: formData.exterior_paint_condition,
            roof_type: formData.exterior_roof_type,
            roof_condition: formData.exterior_roof_condition,
            fence_type: formData.exterior_fence_type,
            parking: formData.exterior_parking,
          }}
        />
      </CardContent>
    </Card>
  );
}

