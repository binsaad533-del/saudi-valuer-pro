import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader, FieldGroup } from "./helpers";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export default function MachineryElectrical({ formData, updateField }: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader title="الحالة الكهربائية" subtitle="فحص اللوحة الكهربائية والأسلاك والمحركات" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="اللوحة الكهربائية">
          <Select value={formData.electrical_panel || ""} onValueChange={v => updateField("electrical_panel", v)}>
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
        <FieldGroup label="حالة الأسلاك">
          <Select value={formData.wiring_condition || ""} onValueChange={v => updateField("wiring_condition", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">ممتاز</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="fair">مقبول</SelectItem>
              <SelectItem value="poor">سيء</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="المحركات الكهربائية">
          <Select value={formData.electric_motors || ""} onValueChange={v => updateField("electric_motors", v)}>
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
        <FieldGroup label="القدرة الكهربائية (kW)">
          <Input value={formData.electrical_power || ""} onChange={e => updateField("electrical_power", e.target.value)} placeholder="0" />
        </FieldGroup>
      </div>
      <FieldGroup label="ملاحظات كهربائية">
        <Textarea value={formData.electrical_notes || ""} onChange={e => updateField("electrical_notes", e.target.value)} rows={3} />
      </FieldGroup>
    </div>
  );
}
