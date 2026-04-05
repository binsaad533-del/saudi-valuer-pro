
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader, FieldGroup } from "./helpers";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export default function MachineryMechanical({ formData, updateField }: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader title="الحالة الميكانيكية" subtitle="فحص المحرك وناقل الحركة والنظام الهيدروليكي" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="حالة المحرك">
          <Select value={formData.engine_condition || ""} onValueChange={v => updateField("engine_condition", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">ممتاز</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="fair">مقبول</SelectItem>
              <SelectItem value="poor">سيء</SelectItem>
              <SelectItem value="not_applicable">لا ينطبق</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="حالة ناقل الحركة">
          <Select value={formData.transmission_condition || ""} onValueChange={v => updateField("transmission_condition", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">ممتاز</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="fair">مقبول</SelectItem>
              <SelectItem value="poor">سيء</SelectItem>
              <SelectItem value="not_applicable">لا ينطبق</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="النظام الهيدروليكي">
          <Select value={formData.hydraulic_condition || ""} onValueChange={v => updateField("hydraulic_condition", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">ممتاز</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="fair">مقبول</SelectItem>
              <SelectItem value="poor">سيء</SelectItem>
              <SelectItem value="not_applicable">لا ينطبق</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="نوع الوقود / الطاقة">
          <Select value={formData.fuel_type || ""} onValueChange={v => updateField("fuel_type", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="diesel">ديزل</SelectItem>
              <SelectItem value="gasoline">بنزين</SelectItem>
              <SelectItem value="electric">كهربائي</SelectItem>
              <SelectItem value="gas">غاز</SelectItem>
              <SelectItem value="hybrid">هجين</SelectItem>
              <SelectItem value="other">أخرى</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="ساعات التشغيل">
          <Input type="number" value={formData.operating_hours || ""} onChange={e => updateField("operating_hours", e.target.value)} placeholder="0" />
        </FieldGroup>
        <FieldGroup label="عداد الكيلومترات">
          <Input type="number" value={formData.odometer_km || ""} onChange={e => updateField("odometer_km", e.target.value)} placeholder="0" />
        </FieldGroup>
      </div>
      <FieldGroup label="ملاحظات ميكانيكية">
        <Textarea value={formData.mechanical_notes || ""} onChange={e => updateField("mechanical_notes", e.target.value)} rows={3} />
      </FieldGroup>
    </div>
  );
}
