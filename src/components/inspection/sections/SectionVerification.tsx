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

export default function SectionVerification({ formData, updateField, sectionPhotos, onAddPhoto, onRemovePhoto }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={3} title="التحقق من الأصل" icon={Building2} subtitle="مطابقة الأصل الفعلي مع المستندات" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="هل الأصل مطابق للمستندات؟" required>
          <RadioGroup value={formData.matches_documents} onValueChange={(v: string) => updateField("matches_documents", v)} className="flex gap-3">
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.matches_documents === "yes" ? "border-green-500 bg-green-50 dark:bg-green-900/20 font-medium" : "border-border"}`}>
              <RadioGroupItem value="yes" className="sr-only" />✅ نعم
            </label>
            <label className={`flex-1 text-center border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.matches_documents === "no" ? "border-destructive bg-destructive/5 font-medium" : "border-border"}`}>
              <RadioGroupItem value="no" className="sr-only" />❌ لا
            </label>
          </RadioGroup>
        </FieldGroup>
        {formData.matches_documents === "no" && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3">
            <p className="text-sm text-destructive font-medium flex items-center gap-1">
              <AlertTriangle className="w-4 h-4" /> تنبيه: عدم التطابق سيتم تصعيده تلقائياً
            </p>
          </div>
        )}
        <FieldGroup label="وصف الأصل" required>
          <Textarea value={formData.asset_description} onChange={(e: any) => updateField("asset_description", e.target.value)} placeholder="وصف تفصيلي للأصل المعاين..." rows={4} />
        </FieldGroup>
        <FieldGroup label="الاستخدام الحالي">
          <Input value={formData.current_use} onChange={(e: any) => updateField("current_use", e.target.value)} placeholder="مثال: سكني - فيلا مأهولة" />
        </FieldGroup>
        <FieldGroup label="الاستخدام الأعلى والأفضل (إن أمكن)">
          <Input value={formData.highest_best_use} onChange={(e: any) => updateField("highest_best_use", e.target.value)} placeholder="مثال: تجاري - موقع مناسب لمحلات" />
        </FieldGroup>
        <SectionPhotoUpload section="verification" label="صور التحقق من الأصل" photos={sectionPhotos} onAdd={onAddPhoto} onRemove={onRemovePhoto} />
        <AiSuggestionBox
          sectionKey="verification"
          promptHint="تحقق من مطابقة الأصل للمستندات"
          context={{ matches_documents: formData.matches_documents, asset_description: formData.asset_description, current_use: formData.current_use }}
        />
      </CardContent>
    </Card>
  );
}

