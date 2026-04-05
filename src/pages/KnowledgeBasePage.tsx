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

  /* ── Observations: human-readable notes from rules ── */
  const observations: { icon: React.ReactNode; text: string; type: "ok" | "warn" | "critical" }[] = [];

  if (hasRules) {
    observations.push({
      icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />,
      text: `${activeRules.length} معيار مهني مفعّل ويُطبّق تلقائياً على كل عمليات التقييم`,
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
    <div className="p-4 md:p-6 space-y-5 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
          <BookOpen className="w-5 h-5 text-primary" />
          المعرفة المهنية
        </h1>
        <p className="text-xs text-muted-foreground mt-0.5">
          يتم تطبيق المعايير المرفوعة تلقائياً عبر كافة مراحل التقييم
        </p>
      </div>

      {/* System Status Cards */}
      <div className="grid grid-cols-3 gap-3">
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
      </div>

      {/* System Status Indicator */}
      <div className={`rounded-xl border p-4 ${
        hasRules
          ? "bg-emerald-500/5 border-emerald-500/20"
          : "bg-amber-500/5 border-amber-500/20"
      }`}>
        <div className="flex items-center gap-2.5 mb-2">
          {hasRules ? (
            <CheckCircle2 className="w-5 h-5 text-emerald-500" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-amber-500" />
          )}
          <span className="text-sm font-semibold text-foreground">
            {hasRules ? "المعايير المهنية مفعّلة" : "بانتظار رفع المعايير"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground mr-7">
          {hasRules
            ? "يقوم النظام بتطبيق المعايير تلقائياً على: استخراج البيانات، المراجعة، الحسابات، المقارنة، وإعداد التقارير"
            : "ارفع مستندات المعايير المهنية ليقوم النظام بتحليلها وتطبيقها تلقائياً"}
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

      {/* Empty state */}
      {docs.length === 0 && (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-8 h-8 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لم يتم رفع أي معايير مهنية بعد</p>
          <p className="text-xs mt-1">ارفع مستندات IVS أو RICS أو تقييم لتفعيل النظام الذكي</p>
        </div>
      )}
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
