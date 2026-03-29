import { useState, useEffect } from "react";
import {
  BookOpen, Plus, Trash2, CheckCircle, XCircle,
  FileText, Upload, Eye,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface KnowledgeDoc {
  id: string;
  title_ar: string;
  category: string;
  content: string;
  source_type: string;
  priority: number;
  is_active: boolean;
  file_name: string | null;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
}

const CATEGORIES: Record<string, string> = {
  ivs_standards: "معايير IVS",
  taqeem_standards: "معايير تقييم",
  internal_policies: "سياسات داخلية",
  past_reports: "تقارير سابقة",
  regulations: "أنظمة ولوائح",
  general: "عام",
};

export default function KnowledgeBaseModule() {
  const [docs, setDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDoc, setViewDoc] = useState<KnowledgeDoc | null>(null);
  const [uploadMode, setUploadMode] = useState<"text" | "file">("text");
  const [form, setForm] = useState({
    title_ar: "",
    category: "ivs_standards",
    content: "",
    source_type: "document",
    priority: 7,
  });
  const [file, setFile] = useState<File | null>(null);

  const fetchDocs = async () => {
    const { data } = await supabase
      .from("raqeem_knowledge")
      .select("*")
      .order("priority", { ascending: false })
      .order("created_at", { ascending: false });
    setDocs((data as any[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchDocs(); }, []);

  const addDoc = async () => {
    if (!form.title_ar) { toast.error("العنوان مطلوب"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("يجب تسجيل الدخول"); return; }

    let content = form.content;
    let fileName: string | null = null;
    let fileSize: number | null = null;
    let mimeType: string | null = null;
    let filePath: string | null = null;

    if (uploadMode === "file" && file) {
      // Upload file to storage
      const path = `raqeem-knowledge/${Date.now()}_${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, file);
      if (uploadError) { toast.error("فشل رفع الملف"); return; }
      filePath = path;
      fileName = file.name;
      fileSize = file.size;
      mimeType = file.type;
      content = content || `[ملف مرفق: ${file.name}]`;
    } else if (!content) {
      toast.error("المحتوى مطلوب"); return;
    }

    const { error } = await supabase.from("raqeem_knowledge").insert({
      ...form,
      content,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      file_path: filePath,
      uploaded_by: user.id,
    } as any);
    if (error) { toast.error("حدث خطأ"); console.error(error); return; }

    toast.success("تم إضافة المعرفة بنجاح");
    setDialogOpen(false);
    setForm({ title_ar: "", category: "ivs_standards", content: "", source_type: "document", priority: 7 });
    setFile(null);
    setUploadMode("text");
    fetchDocs();
  };

  const toggleActive = async (doc: KnowledgeDoc) => {
    await supabase.from("raqeem_knowledge").update({ is_active: !doc.is_active } as any).eq("id", doc.id);
    toast.success(doc.is_active ? "تم التعطيل" : "تم التفعيل");
    fetchDocs();
  };

  const deleteDoc = async (id: string) => {
    await supabase.from("raqeem_knowledge").delete().eq("id", id);
    fetchDocs();
    toast.success("تم الحذف");
  };

  const formatSize = (bytes: number | null) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-base font-bold text-foreground">قاعدة المعرفة</h3>
          <p className="text-xs text-muted-foreground">المستندات والمعايير التي يعتمد عليها رقيم كمراجع أساسية</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm"><Plus className="w-4 h-4 ml-1" /> إضافة معرفة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle>إضافة معرفة جديدة</DialogTitle>
            </DialogHeader>
            <div className="space-y-3">
              <Input
                placeholder="العنوان بالعربية *"
                value={form.title_ar}
                onChange={(e) => setForm({ ...form, title_ar: e.target.value })}
              />
              <div className="grid grid-cols-2 gap-3">
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={String(form.priority)} onValueChange={(v) => setForm({ ...form, priority: parseInt(v) })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">أولوية قصوى</SelectItem>
                    <SelectItem value="7">عالية</SelectItem>
                    <SelectItem value="5">متوسطة</SelectItem>
                    <SelectItem value="3">منخفضة</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Upload mode toggle */}
              <div className="flex gap-2">
                <Button
                  variant={uploadMode === "text" ? "default" : "outline"} size="sm"
                  onClick={() => setUploadMode("text")}
                >
                  <FileText className="w-3.5 h-3.5 ml-1" /> نص
                </Button>
                <Button
                  variant={uploadMode === "file" ? "default" : "outline"} size="sm"
                  onClick={() => setUploadMode("file")}
                >
                  <Upload className="w-3.5 h-3.5 ml-1" /> ملف
                </Button>
              </div>

              {uploadMode === "text" ? (
                <Textarea
                  placeholder="المحتوى — الصق نص المعيار أو السياسة أو القرار هنا..."
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  rows={8}
                />
              ) : (
                <div className="border-2 border-dashed border-border rounded-lg p-6 text-center">
                  <input
                    type="file"
                    id="knowledge-file"
                    className="hidden"
                    accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                  />
                  <label htmlFor="knowledge-file" className="cursor-pointer">
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
                    {file ? (
                      <p className="text-sm text-foreground font-medium">{file.name}</p>
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        PDF, Excel, Word, أو نص عادي
                      </p>
                    )}
                  </label>
                  {file && (
                    <Textarea
                      placeholder="وصف أو ملاحظات إضافية (اختياري)"
                      value={form.content}
                      onChange={(e) => setForm({ ...form, content: e.target.value })}
                      rows={3}
                      className="mt-3"
                    />
                  )}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button onClick={addDoc}>حفظ</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "إجمالي المستندات", value: docs.length, color: "text-primary" },
          { label: "فعّالة", value: docs.filter((d) => d.is_active).length, color: "text-green-600" },
          { label: "معطّلة", value: docs.filter((d) => !d.is_active).length, color: "text-muted-foreground" },
        ].map((s) => (
          <div key={s.label} className="rounded-lg border border-border bg-card p-3 text-center">
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-[11px] text-muted-foreground">{s.label}</div>
          </div>
        ))}
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground text-center py-8">جاري التحميل...</p>
      ) : docs.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">لم يتم إضافة أي مستندات بعد</p>
          <p className="text-xs mt-1">ابدأ بإضافة معايير IVS أو معايير تقييم</p>
        </div>
      ) : (
        <div className="space-y-2">
          {docs.map((doc) => (
            <div key={doc.id} className="flex items-start gap-3 p-3 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow">
              <FileText className="w-4 h-4 mt-1 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-medium text-foreground">{doc.title_ar}</span>
                  <Badge variant={doc.is_active ? "default" : "secondary"} className="text-[10px]">
                    {doc.is_active ? "فعّال" : "معطّل"}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {CATEGORIES[doc.category] || doc.category}
                  </Badge>
                  {doc.file_name && (
                    <Badge variant="outline" className="text-[10px] gap-1">
                      <Upload className="w-2.5 h-2.5" /> {formatSize(doc.file_size)}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{doc.content}</p>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setViewDoc(doc)}>
                  <Eye className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => toggleActive(doc)}>
                  {doc.is_active ? <XCircle className="w-3.5 h-3.5" /> : <CheckCircle className="w-3.5 h-3.5" />}
                </Button>
                <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteDoc(doc.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* View Dialog */}
      <Dialog open={!!viewDoc} onOpenChange={() => setViewDoc(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh]">
          <DialogHeader>
            <DialogTitle>{viewDoc?.title_ar}</DialogTitle>
          </DialogHeader>
          <div className="flex gap-2 flex-wrap">
            <Badge variant="outline">{CATEGORIES[viewDoc?.category || ""] || viewDoc?.category}</Badge>
            <Badge variant="outline">أولوية: {viewDoc?.priority}</Badge>
            {viewDoc?.file_name && <Badge variant="outline">{viewDoc.file_name}</Badge>}
          </div>
          <div className="bg-muted/30 rounded-lg p-4 max-h-[50vh] overflow-y-auto">
            <pre className="text-sm whitespace-pre-wrap text-foreground font-sans">{viewDoc?.content}</pre>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
