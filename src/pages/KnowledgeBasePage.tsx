import { useState, useEffect, useCallback } from "react";
import {
  BookOpen, Upload, Loader2, Sparkles,
  ShieldCheck, ShieldAlert, Trash2, CheckCircle2, AlertTriangle, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
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

const UPLOAD_CATEGORIES = [
  { value: "ivs", label: "IVS" },
  { value: "rics", label: "RICS" },
  { value: "taqeem", label: "تقييم" },
  { value: "internal", label: "داخلي" },
];

const CATEGORY_LABELS: Record<string, string> = {
  ivs: "IVS", rics: "RICS", taqeem: "تقييم", internal: "داخلي",
  professional_standards: "معايير مهنية", regulatory: "تنظيمي",
  valuation: "تقييم", compliance: "امتثال", reporting: "تقارير",
  methodology: "منهجيات", data_quality: "جودة البيانات",
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
  const [loading, setLoading] = useState(true);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadCategory, setUploadCategory] = useState("ivs");

  /* ── Fetch ── */
  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [docsRes, rulesRes] = await Promise.all([
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
    ]);
    setDocs((docsRes.data as KnowledgeDoc[]) || []);
    setRules((rulesRes.data as RuleRow[]) || []);
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

      // Extract text
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

    // Auto-ingest rules from uploaded docs
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

  /* ── Toggle Rule Active/Inactive ── */
  const toggleRule = async (ruleId: string, active: boolean) => {
    await supabase.from("raqeem_rules").update({ is_active: !active }).eq("id", ruleId);
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, is_active: !active } : r));
  };

  /* ── Toggle Rule Severity (warning ↔ blocking) ── */
  const toggleSeverity = async (ruleId: string, currentSeverity: string) => {
    const newSeverity = currentSeverity === "blocking" ? "warning" : "blocking";
    await supabase.from("raqeem_rules").update({ severity: newSeverity }).eq("id", ruleId);
    setRules((prev) => prev.map((r) => r.id === ruleId ? { ...r, severity: newSeverity } : r));
    toast.success(newSeverity === "blocking" ? "تم تحويل القاعدة إلى حرجة (تمنع المتابعة)" : "تم تحويل القاعدة إلى تحذيرية");
  };

  /* ── Delete Doc ── */
  const deleteDoc = async (docId: string) => {
    await supabase.from("raqeem_knowledge").delete().eq("id", docId);
    setDocs((prev) => prev.filter((d) => d.id !== docId));
    toast.success("تم حذف المستند");
  };

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
          المعرفة المهنية
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          ارفع معايير التقييم المهنية — سيقوم الذكاء الاصطناعي باتباعها تلقائياً في كل مراحل العمل
        </p>
      </div>

      {/* Bulk Rebuild */}
      <KnowledgeRebuildPanel />

      {/* Quick Stats */}
      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5 text-muted-foreground">
          <FileText className="w-3.5 h-3.5" />
          {docs.length} مستند
        </span>
        <span className="flex items-center gap-1.5 text-success">
          <ShieldCheck className="w-3.5 h-3.5" />
          {rules.filter(r => r.is_active).length} قاعدة فعّالة
        </span>
        <span className="flex items-center gap-1.5 text-destructive">
          <AlertTriangle className="w-3.5 h-3.5" />
          {rules.filter(r => r.severity === "blocking").length} حرجة
        </span>
      </div>

      {/* Upload Area */}
      <div className="bg-card rounded-xl border border-border p-4">
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
            سيتم استخراج القواعد تلقائياً بعد الرفع
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

      {/* Documents */}
      {docs.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <h3 className="text-sm font-semibold text-foreground">المستندات المرفوعة</h3>
          </div>
          <div className="divide-y divide-border max-h-[300px] overflow-y-auto">
            {docs.map((doc) => (
              <div key={doc.id} className="flex items-center gap-3 px-4 py-2 hover:bg-muted/30 transition-colors">
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
                  إعادة استخراج
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

      {/* Active Rules */}
      {rules.length > 0 && (
        <div className="bg-card rounded-xl border border-border overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">
              القواعد المستخرجة ({rules.length})
            </h3>
            <span className="text-[10px] text-muted-foreground">
              يتم تطبيقها تلقائياً عبر الذكاء الاصطناعي
            </span>
          </div>
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className={`px-4 py-2.5 transition-colors
                  ${!rule.is_active ? "opacity-40" : "hover:bg-muted/30"}`}
              >
                <div className="flex items-center gap-3">
                  {rule.severity === "blocking" ? (
                    <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0" />
                  ) : (
                    <ShieldCheck className="w-3.5 h-3.5 text-success shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-foreground truncate">{rule.rule_title_ar}</p>
                    <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                      <span className="text-[10px] text-muted-foreground">
                        {CATEGORY_LABELS[rule.category] || rule.category}
                      </span>
                      <span className="text-[10px] text-muted-foreground/40">•</span>
                      <span className="text-[10px] text-muted-foreground">
                        {ASSET_TYPE_LABELS[rule.applicable_asset_type] || "الكل"}
                      </span>
                      {rule.enforcement_stage?.length > 0 && (
                        <>
                          <span className="text-[10px] text-muted-foreground/40">•</span>
                          <span className="text-[10px] text-muted-foreground">
                            {rule.enforcement_stage.map((s) => STAGE_LABELS[s] || s).join("، ")}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  {/* Impact badge */}
                  <Badge
                    variant="outline"
                    className={`text-[9px] shrink-0 ${
                      IMPACT_LABELS[rule.impact_type]?.cls || "border-muted text-muted-foreground"
                    }`}
                  >
                    {IMPACT_LABELS[rule.impact_type]?.ar || rule.impact_type}
                  </Badge>
                  {/* Severity toggle */}
                  <button
                    onClick={() => toggleSeverity(rule.id, rule.severity)}
                    title="اضغط لتغيير المستوى"
                  >
                    <Badge
                      variant="outline"
                      className={`text-[9px] shrink-0 cursor-pointer hover:opacity-80 transition-opacity ${
                        rule.severity === "blocking"
                          ? "border-destructive text-destructive"
                          : "border-warning text-warning"
                      }`}
                    >
                      {rule.severity === "blocking" ? "حرج" : "تحذير"}
                    </Badge>
                  </button>
                  <button
                    onClick={() => toggleRule(rule.id, rule.is_active)}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {rule.is_active ? (
                      <ToggleRight className="w-4.5 h-4.5 text-success" />
                    ) : (
                      <ToggleLeft className="w-4.5 h-4.5" />
                    )}
                  </button>
                </div>
                {/* Condition & Requirement (structured details) */}
                {(rule.condition_text || rule.requirement_text) && rule.is_active && (
                  <div className="mr-7 mt-1.5 space-y-1 text-[10px]">
                    {rule.condition_text && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground/70">متى: </span>
                        {rule.condition_text}
                      </p>
                    )}
                    {rule.requirement_text && (
                      <p className="text-muted-foreground">
                        <span className="font-medium text-foreground/70">المتطلب: </span>
                        {rule.requirement_text}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {docs.length === 0 && rules.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لم يتم رفع أي معايير مهنية بعد</p>
          <p className="text-xs mt-1">ارفع مستندات IVS أو RICS أو تقييم لتفعيل الذكاء الاصطناعي المهني</p>
        </div>
      )}
    </div>
  );
}
