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

export default function SectionInterior({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  const conditionOptions = [
    { value: "excellent", label: "ممتازة" },
    { value: "good", label: "جيدة" },
    { value: "acceptable", label: "مقبولة" },
    { value: "poor", label: "رديئة" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={6} title="المبنى - الداخل" icon={Building2} subtitle="وصف مكونات المبنى الداخلية وحالتها" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* التوزيع الداخلي */}
        <ExpandableSection icon="🏠" title="التوزيع الداخلي" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="عدد الغرف">
            <Input type="number" value={formData.interior_rooms_count} onChange={(e: any) => updateField("interior_rooms_count", e.target.value)} placeholder="مثال: 5" />
          </FieldGroup>
          <FieldGroup label="عدد الصالات">
            <Input type="number" value={formData.interior_halls_count} onChange={(e: any) => updateField("interior_halls_count", e.target.value)} placeholder="مثال: 2" />
          </FieldGroup>
          <FieldGroup label="عدد دورات المياه">
            <Input type="number" value={formData.interior_bathrooms_count_num} onChange={(e: any) => updateField("interior_bathrooms_count_num", e.target.value)} placeholder="مثال: 4" />
          </FieldGroup>
          <FieldGroup label="عدد المطابخ">
            <Input type="number" value={formData.interior_kitchens_count} onChange={(e: any) => updateField("interior_kitchens_count", e.target.value)} placeholder="مثال: 1" />
          </FieldGroup>
        </div>
        </ExpandableSection>

        {/* التشطيبات */}
        <ExpandableSection icon="🧱" title="الأرضيات والجدران والأسقف" defaultOpen>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع الأرضيات" required>
            <Select value={formData.interior_floors_type} onValueChange={(v: string) => updateField("interior_floors_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="marble">رخام</SelectItem>
                <SelectItem value="ceramic">سيراميك</SelectItem>
                <SelectItem value="porcelain">بورسلان</SelectItem>
                <SelectItem value="granite">جرانيت</SelectItem>
                <SelectItem value="parquet">باركيه</SelectItem>
                <SelectItem value="carpet">موكيت</SelectItem>
                <SelectItem value="vinyl">فينيل</SelectItem>
                <SelectItem value="concrete">خرساني بدون تشطيب</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الأرضيات">
            <Select value={formData.interior_floors_condition} onValueChange={(v: string) => updateField("interior_floors_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* Remove standalone label - content flows inside ExpandableSection */}
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع التشطيب">
            <Select value={formData.interior_walls_type} onValueChange={(v: string) => updateField("interior_walls_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="paint">دهان</SelectItem>
                <SelectItem value="wallpaper">ورق جدران</SelectItem>
                <SelectItem value="wood_panels">تجليد خشب</SelectItem>
                <SelectItem value="stone">حجر</SelectItem>
                <SelectItem value="gypsum">جبس</SelectItem>
                <SelectItem value="plaster">لياسة بدون دهان</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الجدران">
            <Select value={formData.interior_walls_condition} onValueChange={(v: string) => updateField("interior_walls_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* الأسقف - inside same ExpandableSection */}
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع الأسقف">
            <Select value={formData.interior_ceilings_type} onValueChange={(v: string) => updateField("interior_ceilings_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gypsum_board">جبس بورد</SelectItem>
                <SelectItem value="paint">دهان مباشر</SelectItem>
                <SelectItem value="decorative">ديكور مزخرف</SelectItem>
                <SelectItem value="suspended">سقف معلق</SelectItem>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="concrete">خرساني ظاهر</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الأسقف">
            <Select value={formData.interior_ceilings_condition} onValueChange={(v: string) => updateField("interior_ceilings_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* النوافذ - still inside same ExpandableSection */}
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع النوافذ">
            <Select value={formData.interior_windows_type} onValueChange={(v: string) => updateField("interior_windows_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="aluminum">ألمنيوم</SelectItem>
                <SelectItem value="upvc">UPVC</SelectItem>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
                <SelectItem value="double_glazed">زجاج مزدوج</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة النوافذ">
            <Select value={formData.interior_windows_condition} onValueChange={(v: string) => updateField("interior_windows_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        </ExpandableSection>

        {/* المطبخ والحمامات */}
        <ExpandableSection icon="🍳" title="المطبخ ودورات المياه">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع المطبخ">
            <Select value={formData.interior_kitchen_type} onValueChange={(v: string) => updateField("interior_kitchen_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="builtin">مطبخ مدمج</SelectItem>
                <SelectItem value="modular">تجهيز جاهز</SelectItem>
                <SelectItem value="open">مفتوح</SelectItem>
                <SelectItem value="basic">أساسي</SelectItem>
                <SelectItem value="none">بدون تجهيز</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة المطبخ">
            <Select value={formData.interior_kitchen_condition} onValueChange={(v: string) => updateField("interior_kitchen_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>

        {/* دورات المياه */}
        <p className="text-xs font-bold text-muted-foreground">🚿 دورات المياه</p>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="العدد">
            <Input type="number" value={formData.interior_bathrooms_count} onChange={(e: any) => updateField("interior_bathrooms_count", e.target.value)} placeholder="مثال: 4" />
          </FieldGroup>
          <FieldGroup label="الحالة">
            <Select value={formData.interior_bathrooms_condition} onValueChange={(v: string) => updateField("interior_bathrooms_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        </ExpandableSection>

        {/* الأبواب والسلالم */}
        <ExpandableSection icon="🚪" title="الأبواب والسلالم">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع الأبواب الداخلية">
            <Select value={formData.interior_doors_type} onValueChange={(v: string) => updateField("interior_doors_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="wood_solid">خشب صلب</SelectItem>
                <SelectItem value="wood_hollow">خشب مفرغ</SelectItem>
                <SelectItem value="pvc">PVC</SelectItem>
                <SelectItem value="aluminum">ألمنيوم</SelectItem>
                <SelectItem value="glass">زجاج</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة الأبواب">
            <Select value={formData.interior_doors_condition} onValueChange={(v: string) => updateField("interior_doors_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع السلالم">
            <Select value={formData.interior_stairs_type} onValueChange={(v: string) => updateField("interior_stairs_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="marble">رخام</SelectItem>
                <SelectItem value="granite">جرانيت</SelectItem>
                <SelectItem value="concrete">خرساني</SelectItem>
                <SelectItem value="iron">حديد</SelectItem>
                <SelectItem value="wood">خشب</SelectItem>
                <SelectItem value="none">لا يوجد (دور واحد)</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة السلالم">
            <Select value={formData.interior_stairs_condition} onValueChange={(v: string) => updateField("interior_stairs_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        </ExpandableSection>

        {/* التكييف والأنظمة */}
        <ExpandableSection icon="❄️" title="التكييف والأنظمة">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="نوع التكييف">
            <Select value={formData.interior_ac_type} onValueChange={(v: string) => updateField("interior_ac_type", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="central">مركزي</SelectItem>
                <SelectItem value="split">سبلت</SelectItem>
                <SelectItem value="window">شباك</SelectItem>
                <SelectItem value="ducted">مخفي (دكت)</SelectItem>
                <SelectItem value="mixed">مختلط</SelectItem>
                <SelectItem value="none">لا يوجد</SelectItem>
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة التكييف">
            <Select value={formData.interior_ac_condition} onValueChange={(v: string) => updateField("interior_ac_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="حالة الكهرباء الداخلية">
            <Select value={formData.interior_electrical_condition} onValueChange={(v: string) => updateField("interior_electrical_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
          <FieldGroup label="حالة السباكة">
            <Select value={formData.interior_plumbing_condition} onValueChange={(v: string) => updateField("interior_plumbing_condition", v)}>
              <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
              <SelectContent>
                {conditionOptions.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </FieldGroup>
        </div>
        </ExpandableSection>

        {/* التقييم الكلي */}
        <ExpandableSection icon="⭐" title="التقييم الكلي للتشطيب الداخلي" defaultOpen>
        <FieldGroup label="حالة التشطيب الداخلي الكلية" required>
          <Select value={formData.interior_overall_finishing} onValueChange={(v: string) => updateField("interior_overall_finishing", v)}>
            <SelectTrigger><SelectValue placeholder="اختر التقييم الكلي" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="luxury">فاخر (لوكس)</SelectItem>
              <SelectItem value="super">سوبر ديلوكس</SelectItem>
              <SelectItem value="excellent">ممتاز</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="acceptable">مقبول</SelectItem>
              <SelectItem value="poor">ضعيف</SelectItem>
              <SelectItem value="unfinished">بدون تشطيب</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>

        <FieldGroup label="ملاحظات إضافية">
          <Textarea value={formData.interior_notes} onChange={(e: any) => updateField("interior_notes", e.target.value)} placeholder="أي ملاحظات إضافية عن الحالة الداخلية، عيوب، رطوبة، روائح..." rows={3} />
        </FieldGroup>
        </ExpandableSection>

        {/* صور الداخل */}
        <ExpandableSection icon="📸" title="صور المبنى الداخلية">
        <SectionPhotoUpload section="interior_living" label="الصالة / المعيشة" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="interior_kitchen" label="المطبخ" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="interior_bathroom" label="دورات المياه" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="interior_rooms" label="غرف النوم" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <SectionPhotoUpload section="interior_general" label="صور عامة داخلية" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />

        <AiSuggestionBox
          sectionKey="interior"
          promptHint="تحليل حالة المبنى الداخلية والتشطيبات"
          context={{
            floors_type: formData.interior_floors_type,
            floors_condition: formData.interior_floors_condition,
            walls_condition: formData.interior_walls_condition,
            ceilings_condition: formData.interior_ceilings_condition,
            kitchen_condition: formData.interior_kitchen_condition,
            bathrooms_condition: formData.interior_bathrooms_condition,
            ac_type: formData.interior_ac_type,
            ac_condition: formData.interior_ac_condition,
            electrical: formData.interior_electrical_condition,
            plumbing: formData.interior_plumbing_condition,
            rooms_count: formData.interior_rooms_count,
          }}
        />
        </ExpandableSection>
      </CardContent>
    </Card>
  );
}

