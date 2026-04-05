import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Upload, Loader2, Sparkles,
  ShieldCheck, ShieldAlert, Trash2, CheckCircle2, AlertTriangle, Info,
  Database, Link2, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ingestKnowledgeDocument } from "@/lib/compliance-engine";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import KnowledgeRebuildPanel from "@/components/compliance/KnowledgeRebuildPanel";

/* ── Types ── */
interface KnowledgeDoc {
  id: string;
  title_ar: string;
  category: string;
  is_active: boolean;
  created_at: string;
  file_name: string | null;
  file_size: number | null;
}

interface RuleRow {
  id: string;
  rule_title_ar: string;
  category: string;
  severity: string;
  enforcement_stage: string[];
  is_active: boolean;
  applicable_asset_type: string;
  condition_text: string | null;
  requirement_text: string | null;
  impact_type: string;
}

interface SourceLink {
  id: string;
  source_id: string;
  source_name_ar: string;
  source_type: string;
  valuation_method: string;
  asset_type: string;
  is_active: boolean;
  auto_linked: boolean;
}

const UPLOAD_CATEGORIES = [
  { value: "ivs", label: "IVS" },
  { value: "rics", label: "RICS" },
  { value: "taqeem", label: "تقييم" },
  { value: "internal", label: "داخلي" },
];

const CATEGORY_LABELS: Record<string, string> = {
  ivs: "IVS", rics: "RICS", taqeem: "تقييم", internal: "داخلي",
  professional_standards: "معايير مهنية", regulatory: "تنظيمي",
};

const SOURCE_TYPE_LABELS: Record<string, string> = {
  government: "حكومي",
  market: "سوقي",
  auction: "مزادات",
  cost_database: "قواعد تكاليف",
  professional_standard: "معيار مهني",
};

const METHOD_LABELS: Record<string, string> = {
  comparison: "أسلوب المقارنة",
  income: "أسلوب الدخل",
  cost: "أسلوب التكلفة",
  all: "جميع الأساليب",
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  real_estate: "عقارات",
  machinery: "آلات ومعدات",
  all: "الكل",
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [sourceLinks, setSourceLinks] = useState<SourceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("ivs");
  const [activeTab, setActiveTab] = useState("standards");

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [docsRes, rulesRes, linksRes] = await Promise.all([
      supabase
        .from("raqeem_knowledge")
        .select("id, title_ar, category, is_active, created_at, file_name, file_size")
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("raqeem_rules")
        .select("id, rule_title_ar, category, severity, enforcement_stage, is_active, applicable_asset_type, condition_text, requirement_text, impact_type")
        .order("created_at", { ascending: false })
        .limit(200),
      supabase
        .from("intelligence_source_links")
        .select("*")
        .order("created_at", { ascending: true }),
    ]);
    setDocs((docsRes.data as KnowledgeDoc[]) || []);
    setRules((rulesRes.data as RuleRow[]) || []);
    setSourceLinks((linksRes.data as SourceLink[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  /* ── Upload + Auto-Ingest ── */
  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);
    const uploadedIds: string[] = [];

    for (const file of Array.from(files)) {
      const path = `knowledge/${crypto.randomUUID()}/${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("archived-reports")
        .upload(path, file);

      if (uploadErr) { toast.error(`فشل رفع ${file.name}`); continue; }

      let content = "";
      try {
        const { data } = await supabase.functions.invoke("extract-pdf-text", {
          body: { file_path: path, bucket: "archived-reports" },
        });
        content = data?.text || "";
      } catch {
        content = `[ملف: ${file.name}]`;
      }

      const { data: inserted } = await supabase.from("raqeem_knowledge").insert({
        title_ar: file.name.replace(/\.[^.]+$/, ""),
        content: content || `[محتوى: ${file.name}]`,
        category: uploadCategory,
        source_type: "uploaded_document",
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        priority: 5,
        uploaded_by: user.id,
      }).select("id").single();

      if (inserted) uploadedIds.push(inserted.id);
    }

    toast.success(`تم رفع ${files.length} مستند — جاري استخراج القواعد تلقائياً...`);
    setUploading(false);
    fetchAll();

    for (const docId of uploadedIds) {
      setIngesting(docId);
      try {
        const result = await ingestKnowledgeDocument(docId);
        toast.success(`تم استخراج ${result.rules_inserted} قاعدة من المستند`);
      } catch (err: any) {
        toast.error(`فشل استخراج القواعد: ${err.message}`);
      }
    }
    setIngesting(null);
    fetchAll();
  };

  /* ── Manual Ingest ── */
  const ingestDoc = async (docId: string) => {
    setIngesting(docId);
    try {
      const result = await ingestKnowledgeDocument(docId);
      toast.success(`تم استخراج ${result.rules_inserted} قاعدة`);
      fetchAll();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIngesting(null);
    }
  };

  /* ── Delete Doc ── */
  const deleteDoc = async (docId: string) => {
    await supabase.from("raqeem_knowledge").delete().eq("id", docId);
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    toast.success("تم حذف المستند");
  };

  /* ── Derived stats ── */
  const activeRules = rules.filter((r) => r.is_active);
  const blockingCount = activeRules.filter((r) => r.severity === "blocking").length;
  const warningCount = activeRules.filter((r) => r.severity === "warning").length;
  const hasRules = activeRules.length > 0;
  const activeSourceLinks = sourceLinks.filter((s) => s.is_active);

  /* ── Observations ── */
  const observations: { icon: React.ReactNode; text: string; type: "ok" | "warn" | "critical" }[] = [];

  if (hasRules) {
    observations.push({
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      text: `${activeRules.length} معيار مهني مفعّل ويُطبّق تلقائياً على كل عمليات التقييم`,
      type: "ok",
    });
  }
  if (activeSourceLinks.length > 0) {
    observations.push({
      icon: <Link2 className="w-4 h-4 text-primary" />,
      text: `${activeSourceLinks.length} مصدر سوقي مربوط بأساليب التقييم تلقائياً`,
      type: "ok",
    });
  }
  if (blockingCount > 0) {
    observations.push({
      icon: <ShieldAlert className="w-4 h-4 text-destructive" />,
      text: `${blockingCount} متطلب إلزامي يجب تحقيقه قبل إصدار التقرير`,
      type: "critical",
    });
  }
  if (warningCount > 0) {
    observations.push({
      icon: <AlertTriangle className="w-4 h-4 text-amber-500" />,
      text: `${warningCount} ملاحظة تحسينية سيتم عرضها أثناء العمل`,
      type: "warn",
    });
  }
  if (docs.length === 0) {
    observations.push({
      icon: <Info className="w-4 h-4 text-muted-foreground" />,
      text: "لم يتم رفع أي معايير بعد — ارفع مستندات IVS أو RICS لتفعيل النظام",
      type: "warn",
    });
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          محرك الذكاء المهني
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          المعايير المهنية والمصادر السوقية مدمجة في نظام واحد يغذي محرك التقييم
        </p>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-4 gap-3">
        <StatusCard
          icon={<BookOpen className="w-5 h-5 text-primary" />}
          value={docs.length}
          label="مستند مرفوع"
        />
        <StatusCard
          icon={<ShieldCheck className="w-5 h-5 text-emerald-500" />}
          value={activeRules.length}
          label="معيار مُطبّق"
        />
        <StatusCard
          icon={<ShieldAlert className="w-5 h-5 text-destructive" />}
          value={blockingCount}
          label="متطلب إلزامي"
        />
        <StatusCard
          icon={<Globe className="w-5 h-5 text-primary" />}
          value={activeSourceLinks.length}
          label="مصدر مربوط"
        />
      </div>

      {/* System Status Indicator */}
      <div className={`rounded-xl border p-4 ${
        hasRules && activeSourceLinks.length > 0
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}>
        <div className="flex items-center gap-2.5 mb-2">
          {hasRules && activeSourceLinks.length > 0 ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {hasRules && activeSourceLinks.length > 0
              ? "محرك الذكاء المهني مفعّل — المعايير + المصادر"
              : "بانتظار اكتمال ربط المعايير والمصادر"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mr-7">
          القواعد المهنية = القيود | المصادر السوقية = الأدلة → القواعد + الأدلة = قرار التقييم
        </p>
      </div>

      {/* Observations */}
      {observations.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">ملاحظات النظام</h3>
          </div>
          <div className="divide-y divide-border">
            {observations.map((obs, i) => (
              <div key={i} className="flex items-center gap-3 px-4 py-3">
                {obs.icon}
                <p className="text-xs text-foreground">{obs.text}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tabs: Standards + Market Sources */}
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="standards" className="gap-1.5 text-xs">
            <ShieldCheck className="w-3.5 h-3.5" />
            المعايير المهنية
          </TabsTrigger>
          <TabsTrigger value="sources" className="gap-1.5 text-xs">
            <Database className="w-3.5 h-3.5" />
            المصادر السوقية
          </TabsTrigger>
        </TabsList>

        {/* ── Standards Tab ── */}
        <TabsContent value="standards" className="space-y-4 mt-4">
          {/* Bulk Rebuild */}
          <KnowledgeRebuildPanel />

          {/* Upload Area */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">رفع معايير جديدة</h3>
            <div className="flex items-center gap-3 mb-3">
              <span className="text-xs text-muted-foreground">التصنيف:</span>
              <div className="flex gap-1.5">
                {UPLOAD_CATEGORIES.map((c) => (
                  <button
                    key={c.value}
                    onClick={() => setUploadCategory(c.value)}
                    className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors
                      ${uploadCategory === c.value
                        ? "bg-primary text-primary-foreground border-primary"
                        : "bg-background text-muted-foreground border-border hover:border-primary/40"}`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>
            </div>

            <label className={`block border-2 border-dashed rounded-lg p-5 text-center cursor-pointer transition-colors
              ${uploading ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/40"}`}>
              {uploading ? (
                <Loader2 className="w-5 h-5 mx-auto mb-1.5 text-primary animate-spin" />
              ) : (
                <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground">
                {uploading ? "جاري الرفع والمعالجة..." : "ارفع ملفات المعايير المهنية (PDF, DOCX)"}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                سيتم استخراج القواعد وتطبيقها تلقائياً
              </p>
              <input
                type="file"
                multiple
                className="hidden"
                accept=".pdf,.docx,.doc"
                onChange={(e) => handleUpload(e.target.files)}
                disabled={uploading}
              />
            </label>
          </div>

          {/* Documents List */}
          {docs.length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <div className="px-4 py-2.5 border-b border-border">
                <h3 className="text-sm font-semibold text-foreground">المستندات المرفوعة</h3>
              </div>
              <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <BookOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{doc.title_ar}</p>
                      <span className="text-[10px] text-muted-foreground">
                        {CATEGORY_LABELS[doc.category] || doc.category}
                        {doc.file_size ? ` • ${formatBytes(doc.file_size)}` : ""}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => ingestDoc(doc.id)}
                      disabled={ingesting === doc.id}
                      className="gap-1 text-[10px] h-7 px-2"
                    >
                      {ingesting === doc.id ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <Sparkles className="w-3 h-3" />
                      )}
                      إعادة تحليل
                    </Button>
                    <button
                      onClick={() => deleteDoc(doc.id)}
                      className="p-1 text-muted-foreground hover:text-destructive transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {docs.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
              <p className="text-sm">لم يتم رفع أي معايير مهنية بعد</p>
              <p className="text-xs mt-1">ارفع مستندات IVS أو RICS أو تقييم لتفعيل النظام الذكي</p>
            </div>
          )}
        </TabsContent>

        {/* ── Market Sources Tab ── */}
        <TabsContent value="sources" className="space-y-4 mt-4">
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-2 mb-1">
              <Link2 className="w-4 h-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">ربط المصادر بأساليب التقييم</h3>
            </div>
            <p className="text-xs text-muted-foreground mb-4">
              يتم ربط المصادر السوقية المعتمدة تلقائياً بأساليب التقييم المناسبة. المقارنات → أسلوب المقارنة، قواعد التكاليف → أسلوب التكلفة، بيانات الإيجار → أسلوب الدخل
            </p>

            {activeSourceLinks.length > 0 ? (
              <div className="divide-y divide-border rounded-lg border border-border overflow-hidden">
                {activeSourceLinks.map((link) => (
                  <div key={link.id} className="flex items-center gap-3 px-4 py-3 hover:bg-muted/30 transition-colors">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Globe className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground">{link.source_name_ar}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <Badge variant="outline" className="text-[10px] h-5">
                          {SOURCE_TYPE_LABELS[link.source_type] || link.source_type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {METHOD_LABELS[link.valuation_method] || link.valuation_method}
                        </Badge>
                        <Badge variant="outline" className="text-[10px] h-5 border-primary/30 text-primary">
                          {ASSET_TYPE_LABELS[link.asset_type] || link.asset_type}
                        </Badge>
                      </div>
                    </div>
                    {link.auto_linked && (
                      <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">تلقائي</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Database className="w-8 h-8 mx-auto mb-3 opacity-30" />
                <p className="text-sm">لا توجد مصادر مربوطة</p>
              </div>
            )}
          </div>

          {/* Method-Source Summary */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {(["comparison", "income", "cost"] as const).map((method) => {
              const linked = activeSourceLinks.filter((s) => s.valuation_method === method || s.valuation_method === "all");
              return (
                <div key={method} className="bg-card rounded-xl border border-border p-4">
                  <h4 className="text-xs font-semibold text-foreground mb-2">{METHOD_LABELS[method]}</h4>
                  {linked.length > 0 ? (
                    <div className="space-y-1.5">
                      {linked.map((s) => (
                        <div key={s.id} className="flex items-center gap-2">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500 shrink-0" />
                          <span className="text-[11px] text-foreground truncate">{s.source_name_ar}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground">لا توجد مصادر مربوطة</p>
                  )}
                </div>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

/* ── Small stat card ── */
function StatusCard({ icon, value, label }: { icon: React.ReactNode; value: number; label: string }) {
  return (
    <div className="bg-card rounded-xl border border-border p-3 flex items-center gap-3">
      {icon}
      <div>
        <p className="text-xl font-bold text-foreground leading-none">{value}</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">{label}</p>
      </div>
    </div>
  );
}
