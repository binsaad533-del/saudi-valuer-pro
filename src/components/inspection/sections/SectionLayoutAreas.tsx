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
import { Label } from "@/components/ui/label";
import { SectionHeader, FieldGroup, ExpandableSection } from "./helpers";
import type { FormData, PhotoItem, ChecklistItem } from "./types";
import { toast } from "sonner";

export default function SectionLayoutAreas({ formData, updateField }: any) {
  const floorAreas = formData.floor_areas ? formData.floor_areas.split(",") : [];

  const updateFloorArea = (index: number, value: string) => {
    const areas = formData.floor_areas ? formData.floor_areas.split(",") : [];
    while (areas.length <= index) areas.push("");
    areas[index] = value;
    updateField("floor_areas", areas.join(","));
  };

  const floorLabels = (i: number) => {
    if (i === 0) return "البدروم / القبو";
    if (i === 1) return "الدور الأرضي";
    if (i === 2) return "الدور الأول";
    if (i === 3) return "الدور الثاني";
    if (i === 4) return "الدور الثالث";
    return `الدور ${i - 1}`;
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={9} title="المخطط والمساحات" icon={LayoutGrid} subtitle="تفصيل المساحات لكل دور" />
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <FieldGroup label="مساحة البناء الكلية (م²)" required>
            <Input type="number" value={formData.total_building_area} onChange={(e: any) => updateField("total_building_area", e.target.value)} placeholder="مثال: 450" />
          </FieldGroup>
          <FieldGroup label="عدد الأدوار (للتفصيل)">
            <Input type="number" min={1} max={10} value={formData.floor_count_detail} onChange={(e: any) => updateField("floor_count_detail", e.target.value)} placeholder="مثال: 3" />
          </FieldGroup>
        </div>

        {formData.total_building_area && formData.land_area && parseFloat(formData.land_area) > 0 && (
          <div className="bg-muted/50 rounded-lg p-3 flex items-center justify-between">
            <span className="text-sm text-muted-foreground">📊 نسبة البناء إلى الأرض</span>
            <span className={`text-lg font-bold ${parseFloat(formData.total_building_area) / parseFloat(formData.land_area) > 3 ? "text-destructive" : "text-primary"}`}>
              {((parseFloat(formData.total_building_area) / parseFloat(formData.land_area)) * 100).toFixed(1)}%
            </span>
          </div>
        )}

        {formData.floor_count_detail && parseInt(formData.floor_count_detail) > 0 && (
          <>
            <Separator />
            <p className="text-xs font-bold text-muted-foreground">📐 مساحة كل دور (م²)</p>
            <div className="space-y-2">
              {Array.from({ length: Math.min(parseInt(formData.floor_count_detail), 10) }).map((_, i) => (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground w-28 shrink-0">{floorLabels(i)}</span>
                  <Input
                    type="number"
                    value={floorAreas[i] || ""}
                    onChange={(e: any) => updateFloorArea(i, e.target.value)}
                    placeholder="م²"
                    className="flex-1"
                  />
                </div>
              ))}
            </div>
            {floorAreas.filter((a: string) => a && parseFloat(a) > 0).length > 0 && (
              <div className="bg-muted/50 rounded-lg p-3 text-center">
                <p className="text-xs text-muted-foreground">إجمالي مساحات الأدوار</p>
                <p className="text-lg font-bold text-primary">
                  {floorAreas.reduce((sum: number, a: string) => sum + (parseFloat(a) || 0), 0).toLocaleString("ar-SA")} م²
                </p>
                {formData.total_building_area && Math.abs(floorAreas.reduce((sum: number, a: string) => sum + (parseFloat(a) || 0), 0) - parseFloat(formData.total_building_area)) > 1 && (
                  <p className="text-xs text-destructive mt-1">⚠️ يختلف عن المساحة الكلية المدخلة ({parseFloat(formData.total_building_area).toLocaleString("ar-SA")} م²)</p>
                )}
              </div>
            )}
          </>
        )}

        <Separator />

        <p className="text-xs font-bold text-muted-foreground">🌿 المساحات الإضافية (م²)</p>
        <div className="grid grid-cols-3 gap-3">
          <FieldGroup label="🌳 الحديقة / الفناء">
            <Input type="number" value={formData.garden_area} onChange={(e: any) => updateField("garden_area", e.target.value)} placeholder="م²" />
          </FieldGroup>
          <FieldGroup label="🚗 المواقف">
            <Input type="number" value={formData.parking_area} onChange={(e: any) => updateField("parking_area", e.target.value)} placeholder="م²" />
          </FieldGroup>
          <FieldGroup label="🏠 الملاحق">
            <Input type="number" value={formData.annex_area} onChange={(e: any) => updateField("annex_area", e.target.value)} placeholder="م²" />
          </FieldGroup>
        </div>

        <Separator />

        <FieldGroup label="تطابق المساحة مع الرخصة" required>
          <RadioGroup value={formData.area_matches_license} onValueChange={(v: string) => updateField("area_matches_license", v)} className="grid grid-cols-2 gap-2">
            {[
              { value: "yes", label: "✅ نعم", color: "border-green-500 bg-green-50 dark:bg-green-900/20" },
              { value: "no", label: "❌ لا", color: "border-red-500 bg-red-50 dark:bg-red-900/20" },
            ].map(opt => (
              <label key={opt.value} className={`flex items-center justify-center gap-2 border rounded-lg p-3 cursor-pointer text-sm transition-colors ${formData.area_matches_license === opt.value ? opt.color + " font-bold" : "border-border"}`}>
                <RadioGroupItem value={opt.value} className="sr-only" />{opt.label}
              </label>
            ))}
          </RadioGroup>
        </FieldGroup>
        {formData.area_matches_license === "no" && (
          <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-3 text-sm text-destructive flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            عدم تطابق المساحة مع الرخصة يستوجب التوثيق بالتفصيل وإبلاغ المقيّم
          </div>
        )}

        <FieldGroup label="ملاحظات المخطط">
          <Textarea value={formData.layout_notes} onChange={(e: any) => updateField("layout_notes", e.target.value)} placeholder="ملاحظات عن توزيع المساحات، الملاحق، السطح..." rows={2} />
        </FieldGroup>
      </CardContent>
    </Card>
  );
}


