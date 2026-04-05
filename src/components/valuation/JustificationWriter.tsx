import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { FileText, RefreshCw, Copy, Check, Sparkles, Download } from "lucide-react";
import type { RiskContext } from "@/lib/risk-detection";

const SECTIONS = [
  { key: "method_selection", label: "مبرر المنهجية" },
  { key: "comparable_selection", label: "مبرر المقارنات" },
  { key: "data_assessment", label: "تقييم البيانات" },
  { key: "adjustments", label: "شرح التعديلات" },
  { key: "final_value", label: "مبرر القيمة النهائية" },
  { key: "reconciliation", label: "مبرر المصالحة" },
  { key: "risk_commentary", label: "تعليق المخاطر" },
  { key: "assumptions", label: "شرح الافتراضات" },
] as const;

type SectionKey = (typeof SECTIONS)[number]["key"];

interface Props {
  context: RiskContext;
  asset: Record<string, unknown>;
  valuation: Record<string, unknown>;
  confidenceScore?: number;
  confidenceLevel?: string;
  compliancePassed: boolean;
  comparables?: Record<string, unknown>[];
  finalValue?: Record<string, unknown>;
}

export default function JustificationWriter({
  context,
  asset,
  valuation,
  confidenceScore,
  confidenceLevel,
  compliancePassed,
  comparables,
  finalValue,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionKey>("method_selection");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  const completedCount = SECTIONS.filter((s) => texts[s.key]).length;
  const progressPct = Math.round((completedCount / SECTIONS.length) * 100);

  const generate = useCallback(
    async (section: SectionKey) => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke(
          "generate-justification",
          {
            body: {
              asset,
              valuation,
              methods: context.methodsUsed ?? [],
              adjustments: [],
              confidence: { overall: confidenceScore, level: confidenceLevel },
              risks: [],
              compliance: { passed: compliancePassed },
              assumptions: context.hasAssumptions
                ? ["الافتراضات الأساسية محددة"]
                : [],
              comparables: comparables ?? [],
              finalValue: finalValue ?? {},
              section,
            },
          }
        );

        if (error) throw error;
        if (data?.error) {
          toast.error(data.error);
          return;
        }

        setTexts((prev) => ({ ...prev, [section]: data.text }));
        toast.success("تم إنشاء المبرر بنجاح");
      } catch (e: unknown) {
        const msg = e instanceof Error ? e.message : "فشل إنشاء المبرر";
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [asset, valuation, context, confidenceScore, confidenceLevel, compliancePassed, comparables, finalValue]
  );

  const generateAll = useCallback(async () => {
    for (const s of SECTIONS) {
      if (texts[s.key]) continue;
      await generate(s.key);
    }
  }, [generate, texts]);

  const copyText = useCallback(() => {
    const text = texts[activeSection];
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [texts, activeSection]);

  const exportAll = useCallback(() => {
    const allText = SECTIONS.map((s) => {
      const text = texts[s.key];
      if (!text) return "";
      return `═══ ${s.label} ═══\n\n${text}`;
    })
      .filter(Boolean)
      .join("\n\n\n");
    if (!allText) {
      toast.error("لا توجد مبررات للتصدير");
      return;
    }
    navigator.clipboard.writeText(allText);
    toast.success("تم نسخ جميع المبررات");
  }, [texts]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <FileText className="w-4 h-4 text-primary" />
            محرك المبررات المهنية
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs">
              {completedCount}/{SECTIONS.length}
            </Badge>
            {completedCount > 0 && (
              <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={exportAll}>
                <Download className="w-3 h-3" /> تصدير الكل
              </Button>
            )}
          </div>
        </div>
        {completedCount > 0 && (
          <Progress value={progressPct} className="h-1.5 mt-2" />
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Section tabs */}
        <div className="flex flex-wrap gap-1.5">
          {SECTIONS.map((s) => (
            <Badge
              key={s.key}
              variant={activeSection === s.key ? "default" : "outline"}
              className="cursor-pointer text-xs"
              onClick={() => setActiveSection(s.key)}
            >
              {s.label}
              {texts[s.key] && (
                <Check className="w-3 h-3 mr-1 inline-block" />
              )}
            </Badge>
          ))}
        </div>

        {/* Text area */}
        <Textarea
          dir="rtl"
          className="min-h-[200px] text-sm leading-relaxed resize-y"
          placeholder="اضغط 'إنشاء' لتوليد المبرر المهني..."
          value={texts[activeSection] ?? ""}
          onChange={(e) =>
            setTexts((prev) => ({ ...prev, [activeSection]: e.target.value }))
          }
        />

        {/* Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            onClick={() => generate(activeSection)}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} />
            {texts[activeSection] ? "إعادة إنشاء" : "إنشاء"}
          </Button>
          {completedCount < SECTIONS.length && (
            <Button
              size="sm"
              variant="secondary"
              onClick={generateAll}
              disabled={loading}
            >
              <Sparkles className="w-4 h-4 ml-1" />
              إنشاء الكل
            </Button>
          )}
          {texts[activeSection] && (
            <Button size="sm" variant="outline" onClick={copyText}>
              {copied ? (
                <Check className="w-4 h-4 ml-1" />
              ) : (
                <Copy className="w-4 h-4 ml-1" />
              )}
              {copied ? "تم النسخ" : "نسخ"}
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
