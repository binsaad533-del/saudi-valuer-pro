import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { SectionHeader, FieldGroup } from "./helpers";

interface MachineryFormData {
  [key: string]: any;
}

interface Props {
  formData: MachineryFormData;
  updateField: (key: string, value: any) => void;
}

export default function MachineryGeneral({ formData, updateField }: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader title="معلومات عامة عن الأصل" subtitle="بيانات تعريف الآلة أو المعدة" />
      <FieldGroup label="اسم الآلة / المعدة" required>
        <Input value={formData.machine_name || ""} onChange={e => updateField("machine_name", e.target.value)} placeholder="مثال: حفار هيدروليكي" />
      </FieldGroup>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="الشركة المصنعة">
          <Input value={formData.manufacturer || ""} onChange={e => updateField("manufacturer", e.target.value)} placeholder="CAT, Komatsu..." />
        </FieldGroup>
        <FieldGroup label="الموديل">
          <Input value={formData.model_number || ""} onChange={e => updateField("model_number", e.target.value)} placeholder="320D, PC200..." />
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="سنة الصنع">
          <Input type="number" value={formData.year_manufactured || ""} onChange={e => updateField("year_manufactured", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="الرقم التسلسلي">
          <Input value={formData.serial_number || ""} onChange={e => updateField("serial_number", e.target.value)} dir="ltr" />
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="نوع الأصل">
          <Select value={formData.machine_type || ""} onValueChange={v => updateField("machine_type", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="heavy_equipment">معدات ثقيلة</SelectItem>
              <SelectItem value="industrial">آلات صناعية</SelectItem>
              <SelectItem value="vehicle">مركبات</SelectItem>
              <SelectItem value="generator">مولدات</SelectItem>
              <SelectItem value="production_line">خطوط إنتاج</SelectItem>
              <SelectItem value="workshop">معدات ورش</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="بلد المنشأ">
          <Input value={formData.country_of_origin || ""} onChange={e => updateField("country_of_origin", e.target.value)} />
        </FieldGroup>
      </div>
      <FieldGroup label="ملاحظات عامة">
        <Textarea value={formData.machine_general_notes || ""} onChange={e => updateField("machine_general_notes", e.target.value)} rows={3} />
      </FieldGroup>
    </div>
  );
}
