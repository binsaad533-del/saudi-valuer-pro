import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Label } from "@/components/ui/label";
import { SectionHeader, FieldGroup, ExpandableSection } from "./helpers";
import type { FormData, PhotoItem, ChecklistItem } from "./types";
import { toast } from "sonner";

export default function SectionUtilities({ formData, updateField, checklist, setChecklist, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  const categoryLabels: Record<string, string> = {
    structure: "الهيكل الإنشائي",
    utilities: "المرافق والخدمات",
    exterior: "الخارجي",
    interior: "الداخلي",
    compliance: "المطابقة",
  };
  const categories = [...new Set(checklist.map((c: ChecklistItem) => c.category))];
  const toggle = (index: number) => {
    const next = [...checklist];
    next[index].is_checked = !next[index].is_checked;
    setChecklist(next);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3">
          <SectionHeader num={8} title="المرافق والخدمات" icon={Zap} subtitle="توفر الخدمات الأساسية" />
        </CardHeader>
        <CardContent className="space-y-4">
          {/* الكهرباء */}
          <p className="text-xs font-bold text-muted-foreground">⚡ الكهرباء</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="حالة التوفر">
              <Select value={formData.electricity_status} onValueChange={(v: string) => updateField("electricity_status", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available">متوفر</SelectItem>
                  <SelectItem value="temporary">مؤقت</SelectItem>
                  <SelectItem value="unavailable">غير متوفر</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="حالة الكهرباء">
              <Select value={formData.electricity_condition} onValueChange={(v: string) => updateField("electricity_condition", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">ممتازة</SelectItem>
                  <SelectItem value="good">جيدة</SelectItem>
                  <SelectItem value="acceptable">مقبولة</SelectItem>
                  <SelectItem value="poor">رديئة</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <Separator />

          {/* الماء */}
          <p className="text-xs font-bold text-muted-foreground">💧 المياه</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="مصدر المياه">
              <Select value={formData.water_source} onValueChange={(v: string) => updateField("water_source", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">شبكة عامة</SelectItem>
                  <SelectItem value="tank">خزان</SelectItem>
                  <SelectItem value="well">بئر</SelectItem>
                  <SelectItem value="unavailable">غير متوفر</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="حالة المياه">
              <Select value={formData.water_condition} onValueChange={(v: string) => updateField("water_condition", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">ممتازة</SelectItem>
                  <SelectItem value="good">جيدة</SelectItem>
                  <SelectItem value="acceptable">مقبولة</SelectItem>
                  <SelectItem value="poor">رديئة</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <Separator />

          {/* الصرف الصحي */}
          <p className="text-xs font-bold text-muted-foreground">🔧 الصرف الصحي</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="نوع الصرف">
              <Select value={formData.sewage_type} onValueChange={(v: string) => updateField("sewage_type", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="network">شبكة عامة</SelectItem>
                  <SelectItem value="septic">خزان امتصاص (بيارة)</SelectItem>
                  <SelectItem value="unavailable">غير متوفر</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            <FieldGroup label="حالة الصرف">
              <Select value={formData.sewage_condition} onValueChange={(v: string) => updateField("sewage_condition", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="excellent">ممتازة</SelectItem>
                  <SelectItem value="good">جيدة</SelectItem>
                  <SelectItem value="acceptable">مقبولة</SelectItem>
                  <SelectItem value="poor">رديئة</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
          </div>

          <Separator />

          {/* الطرق */}
          <p className="text-xs font-bold text-muted-foreground">🛣️ الطرق</p>
          <label className={`flex items-center justify-between border rounded-lg p-3 cursor-pointer transition-colors ${formData.roads_paved ? "border-primary/30 bg-primary/5" : "border-border"}`}>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium">طرق معبدة</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">{formData.roads_paved ? "متوفر" : "غير متوفر"}</span>
              <Checkbox checked={formData.roads_paved} onCheckedChange={(v: any) => updateField("roads_paved", !!v)} />
            </div>
          </label>

          <Separator />

          {/* الغاز */}
          <p className="text-xs font-bold text-muted-foreground">🔥 الغاز</p>
          <FieldGroup label="حالة الغاز">
            <Select value={formData.gas_status} onValueChange={(v: string) => updateField("gas_status", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="central">غاز مركزي</SelectItem>
                <SelectItem value="cylinder">أسطوانات</SelectItem>
                <SelectItem value="unavailable">غير متوفر</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>

          {/* الإنترنت */}
          <p className="text-xs font-bold text-muted-foreground">🌐 الإنترنت</p>
          <FieldGroup label="حالة الإنترنت">
            <Select value={formData.internet_status} onValueChange={(v: string) => updateField("internet_status", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="fiber">ألياف بصرية</SelectItem>
                <SelectItem value="dsl">DSL</SelectItem>
                <SelectItem value="available">متوفر</SelectItem>
                <SelectItem value="unavailable">غير متوفر</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>

          <Separator />

          {/* التكييف المركزي */}
          <p className="text-xs font-bold text-muted-foreground">❄️ التكييف المركزي</p>
          <FieldGroup label="حالة التكييف المركزي">
            <Select value={formData.central_ac_status} onValueChange={(v: string) => updateField("central_ac_status", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="available_working">متوفر ويعمل</SelectItem>
                <SelectItem value="available_broken">متوفر لا يعمل</SelectItem>
                <SelectItem value="unavailable">غير متوفر</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>

          {/* المصعد */}
          <p className="text-xs font-bold text-muted-foreground">🛗 المصعد</p>
          <div className="grid grid-cols-2 gap-3">
            <FieldGroup label="حالة المصعد">
              <Select value={formData.elevator_status} onValueChange={(v: string) => updateField("elevator_status", v)}>
                <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="available_working">متوفر ويعمل</SelectItem>
                  <SelectItem value="available_broken">متوفر لا يعمل</SelectItem>
                  <SelectItem value="unavailable">غير متوفر</SelectItem>
                </SelectContent>
              </Select>
            </FieldGroup>
            {formData.elevator_status && formData.elevator_status !== "unavailable" && (
              <FieldGroup label="عدد المصاعد">
                <Input type="number" value={formData.elevator_count} onChange={(e: any) => updateField("elevator_count", e.target.value)} placeholder="مثال: 2" />
              </FieldGroup>
            )}
          </div>

          <Separator />

          <FieldGroup label="ملاحظات المرافق">
            <Textarea value={formData.utilities_notes} onChange={(e: any) => updateField("utilities_notes", e.target.value)} placeholder="ملاحظات إضافية..." rows={2} />
          </FieldGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <ClipboardCheck className="w-4 h-4 text-primary" /> قائمة الفحص التفصيلية
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {categories.map((cat: string) => (
            <div key={cat}>
              <p className="text-xs font-bold text-muted-foreground mb-2">{categoryLabels[cat] || cat}</p>
              {checklist.map((item: ChecklistItem, idx: number) => {
                if (item.category !== cat) return null;
                return (
                  <label key={idx} className="flex items-start gap-3 cursor-pointer py-1.5">
                    <Checkbox checked={item.is_checked} onCheckedChange={() => toggle(idx)} className="mt-0.5" />
                    <div className="flex-1 flex items-center gap-1">
                      <span className="text-sm">{item.label_ar}</span>
                      {item.is_required && <Badge variant="secondary" className="text-[8px] px-1">مطلوب</Badge>}
                    </div>
                  </label>
                );
              })}
              <Separator className="my-2" />
            </div>
          ))}
        </CardContent>
      </Card>
      <SectionPhotoUpload section="utilities" label="صور المرافق والخدمات" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />

      <div className="border border-muted bg-muted/40 rounded-lg p-3 space-y-2">
        <div className="flex items-center gap-2">
          <Lock className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-bold text-muted-foreground">🔒 ملاحظات المعاين على الخدمات (سرية — للمقيّم فقط)</span>
        </div>
        <Textarea
          value={formData.utilities_confidential_notes}
          onChange={(e: any) => updateField("utilities_confidential_notes", e.target.value)}
          placeholder="ملاحظات سرية عن حالة الخدمات لا تظهر في التقرير... (مثال: اشتباه بتوصيلات غير نظامية، روائح صرف صحي)"
          rows={2}
          className="border-muted bg-background"
        />
      </div>

      <AiSuggestionBox
        sectionKey="utilities"
        promptHint="تحليل حالة المرافق والخدمات المتوفرة"
        context={{
          electricity_status: formData.electricity_status,
          electricity_condition: formData.electricity_condition,
          water_source: formData.water_source,
          water_condition: formData.water_condition,
          sewage_type: formData.sewage_type,
          sewage_condition: formData.sewage_condition,
          roads_paved: formData.roads_paved,
          utilities_notes: formData.utilities_notes,
          checklist_done: checklist.filter((c: any) => c.is_checked).length,
          checklist_total: checklist.length,
        }}
      />
    </div>
  );
}

