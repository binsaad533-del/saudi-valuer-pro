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

export default function SectionFinalCheck({ formData, updateField, sectionComplete, photos, checkedRequired, totalRequired }: any) {
  const reviewItems = [
    { label: "معلومات عامة", done: sectionComplete[0] },
    { label: "بيانات الموقع + GPS", done: sectionComplete[1] },
    { label: "التحقق من الأصل", done: sectionComplete[2] },
    { label: "المساحات والأبعاد", done: sectionComplete[3] },
    { label: "حالة الأصل", done: sectionComplete[4] },
    { label: "المرافق والخدمات", done: true },
    { label: "العوامل المؤثرة", done: true },
    { label: `التوثيق المصور (${photos.length} صورة)`, done: sectionComplete[7] },
    { label: "المخاطر", done: sectionComplete[8] },
    { label: `قائمة الفحص (${checkedRequired}/${totalRequired})`, done: checkedRequired === totalRequired },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={13} title="التحقق النهائي" icon={FileCheck} subtitle="مراجعة اكتمال جميع البيانات" />
      </CardHeader>
      <CardContent className="space-y-3">
        {reviewItems.map((item, i) => (
          <div key={i} className="flex items-center justify-between py-2 border-b last:border-0">
            <div className="flex items-center gap-2">
              {item.done ? <CheckCircle className="w-5 h-5 text-green-600 shrink-0" /> : <AlertTriangle className="w-5 h-5 text-yellow-500 shrink-0" />}
              <span className="text-sm">{item.label}</span>
            </div>
            <Badge variant={item.done ? "default" : "destructive"} className="text-[10px]">{item.done ? "مكتمل" : "ناقص"}</Badge>
          </div>
        ))}
        <Separator className="my-3" />
        <FieldGroup label="اكتمال البيانات" required>
          <RadioGroup value={formData.data_complete} onValueChange={(v: string) => updateField("data_complete", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.data_complete === "complete" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="complete" className="sr-only" />✅ مكتمل
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.data_complete === "incomplete" ? "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="incomplete" className="sr-only" />⚠️ ناقص
            </label>
          </RadioGroup>
        </FieldGroup>
        <FieldGroup label="ملاحظات المعاين">
          <Textarea value={formData.inspector_final_notes} onChange={(e: any) => updateField("inspector_final_notes", e.target.value)} placeholder="أي ملاحظات إضافية..." rows={3} />
        </FieldGroup>
        <div className="border border-muted bg-muted/40 rounded-lg p-3 space-y-2">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-muted-foreground" />
            <span className="text-xs font-bold text-muted-foreground">🔒 ملاحظات سرية (للمقيّم فقط — لا تُضاف للتقرير)</span>
          </div>
          <Textarea
            value={formData.confidential_notes}
            onChange={(e: any) => updateField("confidential_notes", e.target.value)}
            placeholder="ملاحظات خاصة لا تظهر في التقرير النهائي... (مثال: شكوك حول صحة المستندات، ملاحظات شخصية)"
            rows={3}
            className="border-muted bg-background"
          />
        </div>
      </CardContent>
    </Card>
  );
}

