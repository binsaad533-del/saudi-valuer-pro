import { useState, useCallback } from "react";
import { Upload, Loader2, BookOpen, Sparkles, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { ingestKnowledgeDocument } from "@/lib/compliance-engine";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

interface KnowledgeDoc {
  id: string;
  title_ar: string;
  category: string;
  source_type: string;
  is_active: boolean;
  created_at: string;
  file_name: string | null;
}

export default function KnowledgeIngestionPanel() {
  const { user } = useAuth();
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(false);
  const [ingesting, setIngesting] = useState<string | null>(null);
  const [uploaded, setUploaded] = useState(false);

  const fetchDocs = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("raqeem_knowledge")
      .select("id, title_ar, category, source_type, is_active, created_at, file_name")
      .order("created_at", { ascending: false })
      .limit(50);
    setDocs((data as KnowledgeDoc[]) || []);
    setLoading(false);
  }, []);

  useState(() => { fetchDocs(); });

  const handleUpload = async (files: FileList | null) => {
    if (!files || !user) return;
    setUploaded(false);

    for (const file of Array.from(files)) {
      const path = `knowledge/${crypto.randomUUID()}/${file.name}`;
      const { error: uploadErr } = await supabase.storage
        .from("archived-reports")
        .upload(path, file);

      if (uploadErr) {
        toast.error(`فشل رفع ${file.name}`);
        continue;
      }

      // Extract text via edge function
      let content = "";
      try {
        const { data } = await supabase.functions.invoke("extract-pdf-text", {
          body: { file_path: path, bucket: "archived-reports" },
        });
        content = data?.text || "";
      } catch {
        content = `[ملف: ${file.name}]`;
      }

      const { error: insertErr } = await supabase.from("raqeem_knowledge").insert({
        title_ar: file.name.replace(/\.[^.]+$/, ""),
        content: content || `[محتوى: ${file.name}]`,
        category: "professional_standards",
        source_type: "uploaded_document",
        file_name: file.name,
        file_path: path,
        file_size: file.size,
        mime_type: file.type,
        priority: 5,
        uploaded_by: user.id,
      });

      if (insertErr) {
        toast.error(`خطأ في حفظ ${file.name}`);
      }
    }

    toast.success(`تم رفع ${files.length} مستند`);
    setUploaded(true);
    fetchDocs();
  };

  const ingestDoc = async (docId: string) => {
    setIngesting(docId);
    try {
      const result = await ingestKnowledgeDocument(docId);
      toast.success(`تم استخراج ${result.rules_inserted} قاعدة من المستند`);
    } catch (err: any) {
      toast.error(err.message);
    } finally {
      setIngesting(null);
    }
  };

  const categoryLabels: Record<string, string> = {
    professional_standards: "معايير مهنية",
    ivs: "IVS",
    rics: "RICS",
    taqeem: "تقييم",
    internal: "داخلي",
    regulatory: "تنظيمي",
  };

  return (
    <div className="space-y-4">
      {/* Upload Area */}
      <div className="bg-card rounded-xl border border-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <BookOpen className="w-4 h-4" />
          قاعدة المعرفة المهنية
        </h3>

        <label className="block border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/40 transition-colors">
          <Upload className="w-6 h-6 mx-auto mb-2 text-muted-foreground" />
          <p className="text-xs text-muted-foreground">
            ارفع مستندات المعايير المهنية (IVS, RICS, تقييم)
          </p>
          <p className="text-[10px] text-muted-foreground/60 mt-1">
            PDF, DOCX — حتى 50 مستند
          </p>
          <input
            type="file"
            multiple
            className="hidden"
            accept=".pdf,.docx,.doc"
            onChange={(e) => handleUpload(e.target.files)}
          />
        </label>

        {uploaded && (
          <p className="text-xs text-success mt-2 flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            تم رفع المستندات بنجاح — اضغط "استخراج القواعد" لتحليل كل مستند
          </p>
        )}
      </div>

      {/* Documents List */}
      <div className="bg-card rounded-xl border border-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">
            المستندات المرفوعة ({docs.length})
          </h3>
        </div>

        {loading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-5 h-5 animate-spin mx-auto text-muted-foreground" />
          </div>
        ) : docs.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-xs">
            لا توجد مستندات — ارفع معايير IVS أو RICS أو تقييم
          </div>
        ) : (
          <div className="divide-y divide-border max-h-80 overflow-y-auto">
            {docs.map((doc) => (
              <div
                key={doc.id}
                className="flex items-center gap-3 px-4 py-2.5"
              >
                <BookOpen className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">
                    {doc.title_ar}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {categoryLabels[doc.category] || doc.category}
                  </p>
                </div>
                <Badge variant="outline" className="text-[9px] shrink-0">
                  {doc.source_type === "uploaded_document" ? "مرفوع" : "يدوي"}
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
                  استخراج القواعد
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
