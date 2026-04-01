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

export default function SectionValueFactors({ formData, updateField }: any) {
  const positiveFactors: Record<string, string> = (formData.positive_factors && typeof formData.positive_factors === 'object' && !Array.isArray(formData.positive_factors)) ? formData.positive_factors : {};
  const negativeFactors: Record<string, string> = (formData.negative_factors && typeof formData.negative_factors === 'object' && !Array.isArray(formData.negative_factors)) ? formData.negative_factors : {};
  return (
    <Card>
      <CardHeader className="pb-3">
        <SectionHeader num={10} title="العوامل المؤثرة على القيمة" icon={TrendingUp} subtitle="العوامل الإيجابية والسلبية" />
      </CardHeader>
      <CardContent className="space-y-4">
        <FieldGroup label="✅ عوامل إيجابية">
          <div className="space-y-2">
            {[
              { id: "view", label: "إطلالة مميزة (View)" },
              { id: "prime_location", label: "موقع مميز" },
              { id: "luxury_finish", label: "تشطيب راقي" },
              { id: "modern", label: "حديث البناء" },
            ].map((factor) => {
              const isSelected = factor.id in formData.positive_factors;
              return (
                <div key={factor.id} className="rounded-lg border border-border bg-background p-2.5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const current = { ...formData.positive_factors };
                        if (checked) { current[factor.id] = "medium"; } else { delete current[factor.id]; }
                        updateField("positive_factors", current);
                      }}
                    />
                    <span className="text-sm font-medium">{factor.label}</span>
                  </label>
                  {isSelected && (
                    <div className="flex gap-1.5 mr-6">
                      {[
                        { value: "weak", label: "ضعيف", style: "border-muted-foreground/30 text-muted-foreground" },
                        { value: "medium", label: "متوسط", style: "border-primary/50 text-primary" },
                        { value: "strong", label: "قوي", style: "border-primary text-primary font-bold" },
                      ].map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => updateField("positive_factors", { ...formData.positive_factors, [factor.id]: level.value })}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${formData.positive_factors[factor.id] === level.value ? "bg-primary text-primary-foreground border-primary" : level.style + " bg-background hover:bg-accent/50"}`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2">
            <Input value={formData.positive_factors_other} onChange={(e: any) => updateField("positive_factors_other", e.target.value)} placeholder="أخرى (حدد)..." className="text-sm" />
          </div>
        </FieldGroup>
        <FieldGroup label="⚠️ عوامل سلبية">
          <div className="space-y-2">
            {[
              { id: "noise", label: "قرب ضوضاء" },
              { id: "legal_issues", label: "إشكاليات قانونية" },
              { id: "harmful_neighbor", label: "مجاور ضار" },
            ].map((factor) => {
              const isSelected = factor.id in formData.negative_factors;
              return (
                <div key={factor.id} className="rounded-lg border border-border bg-background p-2.5 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={(checked) => {
                        const current = { ...formData.negative_factors };
                        if (checked) { current[factor.id] = "medium"; } else { delete current[factor.id]; }
                        updateField("negative_factors", current);
                      }}
                    />
                    <span className="text-sm font-medium">{factor.label}</span>
                  </label>
                  {isSelected && (
                    <div className="flex gap-1.5 mr-6">
                      {[
                        { value: "weak", label: "ضعيف", style: "border-muted-foreground/30 text-muted-foreground" },
                        { value: "medium", label: "متوسط", style: "border-destructive/50 text-destructive" },
                        { value: "strong", label: "قوي", style: "border-destructive text-destructive font-bold" },
                      ].map((level) => (
                        <button
                          key={level.value}
                          type="button"
                          onClick={() => updateField("negative_factors", { ...formData.negative_factors, [factor.id]: level.value })}
                          className={`px-3 py-1 rounded-full text-xs border transition-colors ${formData.negative_factors[factor.id] === level.value ? "bg-destructive text-destructive-foreground border-destructive" : level.style + " bg-background hover:bg-accent/50"}`}
                        >
                          {level.label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="mt-2">
            <Input value={formData.negative_factors_other} onChange={(e: any) => updateField("negative_factors_other", e.target.value)} placeholder="أخرى (حدد)..." className="text-sm" />
          </div>
        </FieldGroup>
        <FieldGroup label="عوامل بيئية">
          <Textarea value={formData.environmental_factors} onChange={(e: any) => updateField("environmental_factors", e.target.value)} placeholder="تلوث، مصادر إزعاج، مناطق فيضانية..." rows={2} />
        </FieldGroup>
        <FieldGroup label="عوامل تنظيمية أو نظامية">
          <Textarea value={formData.regulatory_factors} onChange={(e: any) => updateField("regulatory_factors", e.target.value)} placeholder="قيود بناء، نزع ملكية، تغيير استخدام..." rows={2} />
        </FieldGroup>
        <AiSuggestionBox
          sectionKey="value_factors"
          promptHint="تحليل العوامل المؤثرة على القيمة"
          context={{ positive_factors: Object.entries(formData.positive_factors).map(([k,v]) => `${k}:${v}`).join(', '), positive_factors_other: formData.positive_factors_other, negative_factors: Object.entries(formData.negative_factors).map(([k,v]) => `${k}:${v}`).join(', '), negative_factors_other: formData.negative_factors_other, environmental_factors: formData.environmental_factors, regulatory_factors: formData.regulatory_factors }}
        />
      </CardContent>
    </Card>
  );
}

