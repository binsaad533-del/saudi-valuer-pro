import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader, FieldGroup } from "./helpers";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export default function MachineryStructural({ formData, updateField }: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader title="الحالة الهيكلية" subtitle="فحص الشاسيه والهيكل والصدأ والتشققات" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="حالة الشاسيه/الهيكل">
          <Select value={formData.chassis_condition || ""} onValueChange={v => updateField("chassis_condition", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="excellent">ممتاز</SelectItem>
              <SelectItem value="good">جيد</SelectItem>
              <SelectItem value="fair">مقبول</SelectItem>
              <SelectItem value="poor">سيء</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="مستوى الصدأ">
          <Select value={formData.rust_level || ""} onValueChange={v => updateField("rust_level", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">لا يوجد</SelectItem>
              <SelectItem value="minor">بسيط</SelectItem>
              <SelectItem value="moderate">متوسط</SelectItem>
              <SelectItem value="severe">شديد</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="تشققات/كسور">
          <Select value={formData.cracks_fractures || ""} onValueChange={v => updateField("cracks_fractures", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">لا يوجد</SelectItem>
              <SelectItem value="minor">بسيط</SelectItem>
              <SelectItem value="moderate">متوسط</SelectItem>
              <SelectItem value="severe">خطير</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="الوزن (طن)">
          <Input type="number" value={formData.weight_tons || ""} onChange={e => updateField("weight_tons", e.target.value)} />
        </FieldGroup>
      </div>
      <FieldGroup label="الأبعاد (الطول × العرض × الارتفاع)">
        <Input value={formData.dimensions || ""} onChange={e => updateField("dimensions", e.target.value)} placeholder="مثال: 12م × 3م × 4م" />
      </FieldGroup>
      <FieldGroup label="ملاحظات هيكلية">
        <Textarea value={formData.structural_notes || ""} onChange={e => updateField("structural_notes", e.target.value)} rows={3} />
      </FieldGroup>
    </div>
  );
}
