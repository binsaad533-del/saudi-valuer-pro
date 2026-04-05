import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { SectionHeader, FieldGroup } from "./helpers";

interface Props {
  formData: Record<string, any>;
  updateField: (key: string, value: any) => void;
}

export default function MachinerySafety({ formData, updateField }: Props) {
  const safetyItems = [
    { key: "has_emergency_stop", label: "زر إيقاف طوارئ" },
    { key: "has_safety_guards", label: "حواجز أمان" },
    { key: "has_fire_extinguisher", label: "طفاية حريق" },
    { key: "has_warning_labels", label: "ملصقات تحذيرية" },
    { key: "has_valid_certificate", label: "شهادة فحص سارية" },
    { key: "has_calibration", label: "معايرة حديثة" },
  ];

  return (
    <div className="space-y-4">
      <SectionHeader title="السلامة والمعايير" subtitle="فحص أجهزة السلامة والشهادات والمعايرة" />
      <div className="space-y-2">
        {safetyItems.map(item => (
          <div key={item.key} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/30 border">
            <Checkbox checked={formData[item.key] || false} onCheckedChange={v => updateField(item.key, v)} />
            <span className="text-sm">{item.label}</span>
          </div>
        ))}
      </div>
      <FieldGroup label="رقم شهادة الفحص / الترخيص">
        <Input value={formData.safety_certificate_number || ""} onChange={e => updateField("safety_certificate_number", e.target.value)} />
      </FieldGroup>
      <FieldGroup label="تاريخ انتهاء الشهادة">
        <Input type="date" value={formData.certificate_expiry || ""} onChange={e => updateField("certificate_expiry", e.target.value)} />
      </FieldGroup>
      <FieldGroup label="ملاحظات السلامة">
        <Textarea value={formData.safety_notes || ""} onChange={e => updateField("safety_notes", e.target.value)} rows={3} />
      </FieldGroup>
    </div>
  );
}
