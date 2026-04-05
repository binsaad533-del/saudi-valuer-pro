import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Upload, Loader2, Sparkles, CheckCircle2,
  ShieldCheck, ShieldAlert, ToggleLeft, ToggleRight,
  Trash2, Filter, ChevronDown, FileText, AlertTriangle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { ingestKnowledgeDocument } from "@/lib/compliance-engine";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/* ── Types ── */
interface KnowledgeDoc {
  id: string;
  title_ar: string;
  category: string;
  source_type: string;
  is_active: boolean;
  created_at: string;
  file_name: string | null;
  file_size: number | null;
}

interface RuleRow {
  id: string;
  title_ar: string;
  category: string;
  severity: string;
  enforcement_stage: string | null;
  is_active: boolean;
  created_at: string;
}

const CATEGORIES = [
  { value: "all", label: "الكل" },
  { value: "ivs", label: "IVS" },
  { value: "rics", label: "RICS" },
  { value: "taqeem", label: "تقييم" },
  { value: "internal", label: "داخلي" },
  { value: "professional_standards", label: "معايير مهنية" },
  { value: "regulatory", label: "تنظيمي" },
];

const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  CATEGORIES.filter((c) => c.value !== "all").map((c) => [c.value, c.label])
);

const STAGE_LABELS: Record<string, string> = {
  asset_extraction: "استخراج الأصول",
  asset_review: "مراجعة الأصول",
  valuation_calculation: "حسابات التقييم",
  reconciliation: "المصالحة",
  report_generation: "إعداد التقرير",
  report_issuance: "إصدار التقرير",
};

const SEVERITY_LABELS: Record<string, { label: string; color: string }> = {
  blocking: { label: "حرج", color: "text-destructive border-destructive" },
  warning: { label: "تحذير", color: "text-warning border-warning" },
};

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function KnowledgeBasePage() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [rules, setRules] = useState<RuleRow[]>([]);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [loadingRules, setLoadingRules] = useState(true);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [ruleFilter, setRuleFilter] = useState<"all" | "active" | "inactive">("all");
  const [uploadCategory, setUploadCategory] = useState("professional_standards");

  /* ── Fetch ── */
  const fetchDocs = useCallback(async () => {
    setLoadingDocs(true);
    const q = supabase
      .from("raqeem_knowledge")
      .select("id, title_ar, category, source_type, is_active, created_at, file_name, file_size")
      .order("created_at", { ascending: false });

    if (selectedCategory !== "all") q.eq("category", selectedCategory);

    const { data } = await q.limit(200);
    setDocs((data as KnowledgeDoc[]) || []);
    setLoadingDocs(false);
  }, [selectedCategory]);

  const fetchRules = useCallback(async () => {
    setLoadingRules(true);
    const q = supabase
      .from("raqeem_rules")
      .select("id, title_ar, category, severity, enforcement_stage, is_active, created_at")
      .order("created_at", { ascending: false });

    if (ruleFilter === "active") q.eq("is_active", true);
    if (ruleFilter === "inactive") q.eq("is_active", false);

    const { data } = await q.limit(500);
    setRules((data as RuleRow[]) || []);
    setLoadingRules(false);
  }, [ruleFilter]);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);
  useEffect(() => { fetchRules(); }, [fetchRules]);

  /* ── Upload ── */
  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploading(true);

    for (const file of Array.from(files)) {
      const path = `knowledge/${crypto.randomUUID()}/${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("archived-reports")
        .upload(path, file);

      if (uploadErr) {
        toast.error(`فشل رفع ${file.name}`);
        continue;
      }

      let content = "";
      try {
        const { data } = await supabase.functions.invoke("extract-pdf-text", {
          body: { file_path: path, bucket: "archived-reports" },
        });
        content = data?.text || "";
      } catch {
        content = `[ملف: ${file.name}]`;
      }

      await supabase.from("raqeem_knowledge").insert({
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
      });
    }

    toast.success(`تم رفع ${files.length} مستند بنجاح`);
    setUploading(false);
    fetchDocs();
  };

  /* ── Ingest Rules from Doc ── */
  const ingestDoc = async (docId: string) => {
    setIngesting(docId);
    try {
      const result = await ingestKnowledgeDocument(docId);
      toast.success(`تم استخراج ${result.rules_inserted} قاعدة`);
      fetchRules();
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIngesting(null);
    }
  };

  /* ── Toggle Rule ── */
  const toggleRule = async (ruleId: string, currentActive: boolean) => {
    await supabase
      .from("raqeem_rules")
      .update({ is_active: !currentActive })
      .eq("id", ruleId);
    setRules((prev) =>
      prev.map((r) => (r.id === ruleId ? { ...r, is_active: !currentActive } : r))
    );
    toast.success(!currentActive ? "تم تفعيل القاعدة" : "تم تعطيل القاعدة");
  };

  /* ── Delete Doc ── */
  const deleteDoc = async (docId: string) => {
    await supabase.from("raqeem_knowledge").delete().eq("id", docId);
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    toast.success("تم حذف المستند");
  };

  const statsActive = rules.filter((r) => r.is_active).length;
  const statsBlocking = rules.filter((r) => r.severity === "blocking" && r.is_active).length;
  const statsWarning = rules.filter((r) => r.severity === "warning" && r.is_active).length;

  return (
    <div className="p-4 md:p-6 space-y-5 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          المعرفة المهنية
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          رفع وإدارة المعايير المهنية وتحويلها إلى قواعد تحكم سير التقييم
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "المستندات", value: docs.length, icon: FileText, color: "text-primary" },
          { label: "القواعد الفعّالة", value: statsActive, icon: ShieldCheck, color: "text-success" },
          { label: "قواعد حرجة", value: statsBlocking, icon: ShieldAlert, color: "text-destructive" },
          { label: "تحذيرات", value: statsWarning, icon: AlertTriangle, color: "text-warning" },
        ].map((s) => (
          <div key={s.label} className="bg-card rounded-xl border border-border px-4 py-3">
            <div className="flex items-center gap-2 mb-1">
              <s.icon className={`w-4 h-4 ${s.color}`} />
              <span className="text-[11px] text-muted-foreground">{s.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="documents" className="w-full">
        <TabsList className="w-full grid grid-cols-2 h-9">
          <TabsTrigger value="documents" className="text-xs gap-1.5">
            <FileText className="w-3.5 h-3.5" />
            المستندات
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            القواعد المستخرجة
          </TabsTrigger>
        </TabsList>

        {/* ── Documents Tab ── */}
        <TabsContent value="documents" className="space-y-4 mt-4">
          {/* Upload Area */}
          <div className="bg-card rounded-xl border border-border p-4">
            <div className="flex items-center gap-3 mb-3">
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                className="text-xs bg-background border border-border rounded-lg px-3 py-1.5 text-foreground"
              >
                {CATEGORIES.filter((c) => c.value !== "all").map((c) => (
                  <option key={c.value} value={c.value}>{c.label}</option>
                ))}
              </select>
            </div>

            <label className={`block border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors
              ${uploading ? "border-primary/30 bg-primary/5" : "border-border hover:border-primary/40"}`}>
              {uploading ? (
                <Loader2 className="w-6 h-6 mx-auto mb-2 text-primary animate-spin" />
              ) : (
                <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
              )}
              <p className="text-xs text-muted-foreground">
                {uploading ? "جاري الرفع والمعالجة..." : "ارفع مستندات المعايير المهنية"}
              </p>
              <p className="text-[10px] text-muted-foreground/60 mt-1">
                PDF, DOCX — حتى 50 مستند دفعة واحدة
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

          {/* Category Filter */}
          <div className="flex items-center gap-2 flex-wrap">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {CATEGORIES.map((c) => (
              <button
                key={c.value}
                onClick={() => setSelectedCategory(c.value)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors
                  ${selectedCategory === c.value
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Documents List */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border">
              <h3 className="text-sm font-semibold text-foreground">
                المستندات ({docs.length})
              </h3>
            </div>

            {loadingDocs ? (
              <div className="p-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : docs.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                لا توجد مستندات — ارفع معايير IVS أو RICS أو تقييم
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[400px] overflow-y-auto">
                {docs.map((doc) => (
                  <div key={doc.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted/30 transition-colors">
                    <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{doc.title_ar}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          {CATEGORY_LABELS[doc.category] || doc.category}
                        </span>
                        <span className="text-[10px] text-muted-foreground/50">•</span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatBytes(doc.file_size)}
                        </span>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[9px] shrink-0">
                      {doc.is_active ? "فعّال" : "معطّل"}
                    </Badge>
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
                      استخراج
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => deleteDoc(doc.id)}
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── Rules Tab ── */}
        <TabsContent value="rules" className="space-y-4 mt-4">
          {/* Rule Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {(["all", "active", "inactive"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setRuleFilter(f)}
                className={`text-[11px] px-2.5 py-1 rounded-full border transition-colors
                  ${ruleFilter === f
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-card text-muted-foreground border-border hover:border-primary/40"}`}
              >
                {f === "all" ? "الكل" : f === "active" ? "فعّالة" : "معطّلة"}
              </button>
            ))}
            <span className="text-[11px] text-muted-foreground mr-auto">
              {rules.length} قاعدة
            </span>
          </div>

          {/* Rules List */}
          <div className="bg-card rounded-xl border border-border overflow-hidden">
            {loadingRules ? (
              <div className="p-8 text-center">
                <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
              </div>
            ) : rules.length === 0 ? (
              <div className="p-8 text-center text-muted-foreground text-xs">
                لا توجد قواعد — استخرج القواعد من المستندات أولاً
              </div>
            ) : (
              <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
                {rules.map((rule) => {
                  const sev = SEVERITY_LABELS[rule.severity] || { label: rule.severity, color: "" };
                  return (
                    <div
                      key={rule.id}
                      className={`flex items-center gap-3 px-4 py-2.5 transition-colors
                        ${!rule.is_active ? "opacity-50" : "hover:bg-muted/30"}`}
                    >
                      {rule.is_active ? (
                        <ShieldCheck className="w-4 h-4 text-success shrink-0" />
                      ) : (
                        <ShieldAlert className="w-4 h-4 text-muted-foreground shrink-0" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-foreground truncate">
                          {rule.title_ar}
                        </p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-[10px] text-muted-foreground">
                            {CATEGORY_LABELS[rule.category] || rule.category}
                          </span>
                          {rule.enforcement_stage && (
                            <>
                              <span className="text-[10px] text-muted-foreground/50">•</span>
                              <span className="text-[10px] text-muted-foreground">
                                {STAGE_LABELS[rule.enforcement_stage] || rule.enforcement_stage}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[9px] shrink-0 ${sev.color}`}
                      >
                        {sev.label}
                      </Badge>
                      <button
                        onClick={() => toggleRule(rule.id, rule.is_active)}
                        className="text-muted-foreground hover:text-foreground transition-colors"
                        title={rule.is_active ? "تعطيل" : "تفعيل"}
                      >
                        {rule.is_active ? (
                          <ToggleRight className="w-5 h-5 text-success" />
                        ) : (
                          <ToggleLeft className="w-5 h-5" />
                        )}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
