import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SectionHeader, FieldGroup } from "./helpers";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export default function MachineryMaintenance({ formData, updateField }: Props) {
  return (
    <div className="space-y-4">
      <SectionHeader title="سجل الصيانة" subtitle="تاريخ الصيانة وتكرار الأعطال وقطع الغيار" />
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="تاريخ آخر صيانة">
          <Input type="date" value={formData.last_maintenance_date || ""} onChange={e => updateField("last_maintenance_date", e.target.value)} />
        </FieldGroup>
        <FieldGroup label="تكرار الصيانة">
          <Select value={formData.maintenance_frequency || ""} onValueChange={v => updateField("maintenance_frequency", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="regular">منتظمة</SelectItem>
              <SelectItem value="occasional">عرضية</SelectItem>
              <SelectItem value="rare">نادرة</SelectItem>
              <SelectItem value="none">لا توجد صيانة</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <FieldGroup label="تكرار الأعطال">
          <Select value={formData.breakdown_frequency || ""} onValueChange={v => updateField("breakdown_frequency", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">لا يوجد</SelectItem>
              <SelectItem value="rare">نادر</SelectItem>
              <SelectItem value="occasional">عرضي</SelectItem>
              <SelectItem value="frequent">متكرر</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
        <FieldGroup label="توفر قطع الغيار">
          <Select value={formData.spare_parts_availability || ""} onValueChange={v => updateField("spare_parts_availability", v)}>
            <SelectTrigger><SelectValue placeholder="اختر" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="available">متوفرة</SelectItem>
              <SelectItem value="limited">محدودة</SelectItem>
              <SelectItem value="scarce">نادرة</SelectItem>
              <SelectItem value="unavailable">غير متوفرة</SelectItem>
            </SelectContent>
          </Select>
        </FieldGroup>
      </div>
      <FieldGroup label="ملاحظات الصيانة">
        <Textarea value={formData.maintenance_notes || ""} onChange={e => updateField("maintenance_notes", e.target.value)} rows={3} />
      </FieldGroup>
    </div>
  );
}
