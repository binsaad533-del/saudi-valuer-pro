import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { FileText, RefreshCw, Copy, Check } from "lucide-react";
import type { RiskContext } from "@/lib/risk-detection";

const SECTIONS = [
  { key: "method_selection", label: "مبرر المنهجية" },
  { key: "data_assessment", label: "تقييم البيانات" },
  { key: "adjustments", label: "شرح التعديلات" },
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
}

export default function JustificationWriter({
  context,
  asset,
  valuation,
  confidenceScore,
  confidenceLevel,
  compliancePassed,
}: Props) {
  const [activeSection, setActiveSection] = useState<SectionKey>("method_selection");
  const [texts, setTexts] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState(false);

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
    [asset, valuation, context, confidenceScore, confidenceLevel, compliancePassed]
  );

  const copyText = useCallback(() => {
    const text = texts[activeSection];
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [texts, activeSection]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" />
          كاتب المبررات المهنية
        </CardTitle>
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
          className="min-h-[180px] text-sm leading-relaxed resize-y"
          placeholder="اضغط 'إنشاء' لتوليد المبرر المهني..."
          value={texts[activeSection] ?? ""}
          onChange={(e) =>
            setTexts((prev) => ({ ...prev, [activeSection]: e.target.value }))
          }
        />

        {/* Actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => generate(activeSection)}
            disabled={loading}
          >
            <RefreshCw className={`w-4 h-4 ml-1 ${loading ? "animate-spin" : ""}`} />
            {texts[activeSection] ? "إعادة إنشاء" : "إنشاء"}
          </Button>
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
