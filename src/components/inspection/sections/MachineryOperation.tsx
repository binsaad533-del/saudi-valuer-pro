import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionHeader, FieldGroup } from "./helpers";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export default function MachineryOperation({ formData, updateField }: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader title="نظام التشغيل والأداء" subtitle="اختبار التشغيل والقراءات والكفاءة" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="الحالة التشغيلية">
          <Select value={formData.operational_status || ""} onValueChange={v => updateField("operational_status", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="operational">تعمل بشكل طبيعي</SelectItem>
              <SelectItem value="operational_issues">تعمل مع مشاكل</SelectItem>
              <SelectItem value="stopped">متوقفة</SelectItem>
              <SelectItem value="needs_repair">تحتاج صيانة</SelectItem>
              <SelectItem value="scrap">خردة</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="مستوى الكفاءة (%)">
          <Input type="number" value={formData.efficiency_pct || ""} onChange={e => updateField("efficiency_pct", e.target.value)} placeholder="0-100" />
        </FieldGroup>
      </div>
      <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border">
        <Checkbox checked={formData.test_run_done || false} onCheckedChange={v => updateField("test_run_done", v)} />
        <span className="text-sm font-medium">تم إجراء اختبار تشغيل</span>
      </div>
      {formData.test_run_done && (
        <FieldGroup label="نتائج اختبار التشغيل">
          <Textarea value={formData.test_run_results || ""} onChange={e => updateField("test_run_results", e.target.value)} rows={3} />
        </FieldGroup>
      )}
      <FieldGroup label="السعة / القدرة">
        <Input value={formData.capacity || ""} onChange={e => updateField("capacity", e.target.value)} placeholder="مثال: 200 طن/ساعة، 500 كيلوواط" />
      </FieldGroup>
      <FieldGroup label="ملاحظات التشغيل">
        <Textarea value={formData.operation_notes || ""} onChange={e => updateField("operation_notes", e.target.value)} rows={3} />
      </FieldGroup>
    </div>
  );
}
