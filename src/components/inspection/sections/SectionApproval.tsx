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

export default function SectionApproval({ formData, updateField, canSubmit, submitting, onSubmit }: any) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={14} title="اعتماد المعاينة" icon={UserCheck} subtitle="تأكيد واعتماد المعاينة" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-primary/5 border border-primary/20 rounded-lg p-4 text-center space-y-2">
          <p className="text-sm font-bold text-primary">"جودة المعاينة = جودة التقييم"</p>
          <p className="text-xs text-muted-foreground">أقر بأن جميع البيانات المدخلة صحيحة ودقيقة وتعكس الواقع الفعلي للأصل</p>
        </div>
        <FieldGroup label="اسم المعاين" required>
          <Input value={formData.approval_inspector_name} onChange={(e: any) => updateField("approval_inspector_name", e.target.value)} placeholder="الاسم الكامل للمعاين" />
        </FieldGroup>
        <FieldGroup label="تاريخ الاعتماد">
          <Input type="date" value={formData.approval_date} onChange={(e: any) => updateField("approval_date", e.target.value)} dir="ltr" />
        </FieldGroup>
        {!canSubmit && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive text-center">
            <AlertTriangle className="w-5 h-5 mx-auto mb-1" />
            يرجى إكمال جميع المتطلبات الإلزامية قبل الإرسال
          </div>
        )}
        <Separator />
        <Button onClick={onSubmit} disabled={!canSubmit || submitting} className="w-full h-14 text-lg">
          {submitting ? <Loader2 className="w-6 h-6 animate-spin ml-2" /> : <Send className="w-6 h-6 ml-2" />}
          إرسال واعتماد المعاينة
        </Button>
        <p className="text-[10px] text-muted-foreground text-center">
          بالضغط على "إرسال" فإنك تقر بصحة جميع البيانات المدخلة
        </p>
      </CardContent>
    </Card>
  );
}
