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

export default function SectionGeneral({ formData, updateField }: { formData: FormData; updateField: any }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={1} title="بيانات العقار الأساسية" icon={Building2} subtitle="معلومات العقار والمعاينة" />
      </CardHeader>
      <CardContent className="space-y-4">
        {/* رقم الطلب التلقائي */}
        <div className="bg-muted/50 border rounded-lg p-3 flex items-center justify-between">
          <span className="text-xs text-muted-foreground">رقم الطلب</span>
          <Badge variant="secondary" className="font-mono text-sm">{formData.request_number}</Badge>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="تاريخ المعاينة" required>
            <Input type="date" value={formData.inspection_date} onChange={e => updateField("inspection_date", e.target.value)} />
          </FieldGroup>
          <FieldGroup label="اسم المعاين" required>
            <Input value={formData.inspector_name} onChange={e => updateField("inspector_name", e.target.value)} placeholder="الاسم الكامل" />
          </FieldGroup>
        </div>

        <FieldGroup label="نوع العقار" required>
          <RadioGroup value={formData.asset_type} onValueChange={v => updateField("asset_type", v)} className="grid grid-cols-3 gap-2">
            {[
              { value: "apartment", label: "شقة" },
              { value: "villa", label: "فيلا" },
              { value: "land", label: "أرض" },
              { value: "commercial", label: "تجاري" },
              { value: "industrial", label: "صناعي" },
              { value: "other", label: "أخرى" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-1.5 border rounded-lg p-2.5 cursor-pointer text-sm transition-colors ${formData.asset_type === opt.value ? "border-primary bg-primary/5 font-medium" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />
                {opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>

        <FieldGroup label="رقم الصك" required>
          <Input value={formData.deed_number} onChange={e => updateField("deed_number", e.target.value)} placeholder="أدخل رقم الصك" />
        </FieldGroup>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="المدينة" required>
            <Input value={formData.city} onChange={e => updateField("city", e.target.value)} placeholder="مثال: الرياض" />
          </FieldGroup>
          <FieldGroup label="الحي" required>
            <Input value={formData.district} onChange={e => updateField("district", e.target.value)} placeholder="مثال: النرجس" />
          </FieldGroup>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="الشارع">
            <Input value={formData.street} onChange={e => updateField("street", e.target.value)} placeholder="اسم أو رقم الشارع" />
          </FieldGroup>
          <FieldGroup label="رقم المبنى">
            <Input value={formData.building_number} onChange={e => updateField("building_number", e.target.value)} placeholder="رقم المبنى" />
          </FieldGroup>
        </div>

        <FieldGroup label="الغرض من التقييم" required>
          <Select value={formData.valuation_purpose} onValueChange={v => updateField("valuation_purpose", v)}>
            <SelectTrigger><SelectValue placeholder="اختر الغرض من التقييم" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="mortgage">رهن عقاري</SelectItem>
              <SelectItem value="sale">بيع / شراء</SelectItem>
              <SelectItem value="insurance">تأمين</SelectItem>
              <SelectItem value="zakat">زكاة</SelectItem>
              <SelectItem value="financial_reporting">قوائم مالية</SelectItem>
              <SelectItem value="dispute">نزاع / تقاضي</SelectItem>
              <SelectItem value="investment">استثمار</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

