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

export default function SectionRisks({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={12} title="المخاطر والملاحظات" icon={ShieldAlert} subtitle="أي مخاطر تؤثر على التقييم" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="هل توجد مخاطر تؤثر على التقييم؟" required>
          <RadioGroup value={formData.has_risks} onValueChange={(v: string) => updateField("has_risks", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.has_risks === "yes" ? "border-destructive bg-destructive/5 font-medium" : "border-border"}`}>
              <RadioGroupItem value="yes" className="sr-only" />⚠️ نعم
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.has_risks === "no" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="no" className="sr-only" />✅ لا
            </label>
          </RadioGroup>
        </FieldGroup>
        {formData.has_risks === "yes" && (
          <FieldGroup label="تفصيل المخاطر" required>
            <Textarea value={formData.risk_details} onChange={(e: any) => updateField("risk_details", e.target.value)} placeholder="وصف تفصيلي للمخاطر المحددة..." rows={4} className="border-destructive/30" />
          </FieldGroup>
        )}
        <SectionPhotoUpload section="risks" label="صور المخاطر المكتشفة" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="risks"
          promptHint="تحليل المخاطر"
          context={{ has_risks: formData.has_risks, risk_details: formData.risk_details }}
        />
      </CardContent>
    </Card>
  );
}

