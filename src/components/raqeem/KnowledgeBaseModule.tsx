import { useState, useEffect, useRef } from "react";
import {
  BookOpen, Plus, Trash2, CheckCircle, XCircle,
  FileText, Upload, Eye, FolderUp, Loader2,
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
import { Progress } from "@/components/ui/progress";

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
  const [bulkDialogOpen, setBulkDialogOpen] = useState(false);
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

  // Bulk upload state
  const [bulkFiles, setBulkFiles] = useState<File[]>([]);
  const [bulkCategory, setBulkCategory] = useState("ivs_standards");
  const [bulkPriority, setBulkPriority] = useState(7);
  const [bulkUploading, setBulkUploading] = useState(false);
  const [bulkProgress, setBulkProgress] = useState(0);
  const [bulkTotal, setBulkTotal] = useState(0);
  const bulkInputRef = useRef<HTMLInputElement>(null);

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

  const extractPdfText = async (knowledgeId: string, filePath: string) => {
    try {
      const { data, error } = await supabase.functions.invoke("extract-pdf-text", {
        body: { knowledge_id: knowledgeId, file_path: filePath },
      });
      if (error) {
        console.error("Extract error:", error);
        return false;
      }
      if (data?.success) {
        console.log(`Extracted ${data.content_length} chars for ${knowledgeId}`);
        return true;
      }
      return false;
    } catch (e) {
      console.error("Extract exception:", e);
      return false;
    }
  };

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
      const ext = file.name.split('.').pop() || 'bin';
      const safeName = `${crypto.randomUUID()}.${ext}`;
      const path = `raqeem-knowledge/${safeName}`;
      const { error: uploadError } = await supabase.storage
        .from("attachments")
        .upload(path, file, { contentType: file.type || 'application/octet-stream' });
      if (uploadError) { toast.error(`فشل رفع الملف: ${uploadError.message}`); console.error("Upload error:", uploadError); return; }
      filePath = path;
      fileName = file.name;
      fileSize = file.size;
      mimeType = file.type;
      content = content || `[جاري استخراج المحتوى...]`;
    } else if (!content) {
      toast.error("المحتوى مطلوب"); return;
    }

    const { data: insertData, error } = await supabase.from("raqeem_knowledge").insert({
      ...form,
      content,
      file_name: fileName,
      file_size: fileSize,
      mime_type: mimeType,
      file_path: filePath,
      uploaded_by: user.id,
    } as any).select("id").single();
    if (error) { toast.error("حدث خطأ"); console.error(error); return; }

    toast.success("تم إضافة المعرفة بنجاح");
    setDialogOpen(false);
    setForm({ title_ar: "", category: "ivs_standards", content: "", source_type: "document", priority: 7 });
    setFile(null);
    setUploadMode("text");
    fetchDocs();

    // Auto-extract text from file in background
    if (filePath && insertData?.id) {
      toast.info("جاري استخراج محتوى الملف تلقائياً...");
      const success = await extractPdfText(insertData.id, filePath);
      if (success) {
        toast.success("تم استخراج محتوى الملف بنجاح ✅");
        fetchDocs();
      } else {
        toast.warning("تعذر استخراج المحتوى تلقائياً — يمكنك إضافته يدوياً");
      }
    }
  };

  const handleBulkFiles = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    setBulkFiles(files);
  };

  const removeBulkFile = (index: number) => {
    setBulkFiles(prev => prev.filter((_, i) => i !== index));
  };

  const getFileTitle = (fileName: string) => {
    // Remove extension and clean up the name as a title
    return fileName.replace(/\.[^/.]+$/, "").replace(/[_-]/g, " ");
  };

  const uploadBulk = async () => {
    if (bulkFiles.length === 0) { toast.error("اختر ملفات أولاً"); return; }
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("يجب تسجيل الدخول"); return; }

    setBulkUploading(true);
    setBulkProgress(0);
    setBulkTotal(bulkFiles.length);
    let successCount = 0;
    let failCount = 0;
    const uploadedItems: { id: string; path: string }[] = [];

    for (let i = 0; i < bulkFiles.length; i++) {
      const f = bulkFiles[i];
      try {
        const ext = f.name.split('.').pop() || 'bin';
        const safeName = `${crypto.randomUUID()}.${ext}`;
        const path = `raqeem-knowledge/${safeName}`;
        const { error: uploadError } = await supabase.storage
          .from("attachments")
          .upload(path, f, { contentType: f.type || 'application/octet-stream' });
        if (uploadError) { console.error("Bulk upload error:", uploadError); failCount++; setBulkProgress(i + 1); continue; }

        const { data: insertData, error } = await supabase.from("raqeem_knowledge").insert({
          title_ar: getFileTitle(f.name),
          category: bulkCategory,
          content: `[جاري استخراج المحتوى...]`,
          source_type: "document",
          priority: bulkPriority,
          file_name: f.name,
          file_size: f.size,
          mime_type: f.type,
          file_path: path,
          uploaded_by: user.id,
        } as any).select("id").single();

        if (error) { failCount++; } else {
          successCount++;
          if (insertData?.id) uploadedItems.push({ id: insertData.id, path });
        }
      } catch {
        failCount++;
      }
      setBulkProgress(i + 1);
    }

    setBulkUploading(false);
    if (successCount > 0) toast.success(`تم رفع ${successCount} مرجع بنجاح`);
    if (failCount > 0) toast.error(`فشل رفع ${failCount} ملف`);
    if (successCount > 0) {
      setBulkDialogOpen(false);
      setBulkFiles([]);
      if (bulkInputRef.current) bulkInputRef.current.value = "";
      fetchDocs();
    }

    // Auto-extract text from all uploaded files in background
    if (uploadedItems.length > 0) {
      toast.info(`جاري استخراج محتوى ${uploadedItems.length} ملف تلقائياً...`);
      let extractSuccess = 0;
      for (const item of uploadedItems) {
        const ok = await extractPdfText(item.id, item.path);
        if (ok) extractSuccess++;
      }
      if (extractSuccess > 0) {
        toast.success(`تم استخراج محتوى ${extractSuccess} ملف بنجاح ✅`);
        fetchDocs();
      }
      if (extractSuccess < uploadedItems.length) {
        toast.warning(`تعذر استخراج محتوى ${uploadedItems.length - extractSuccess} ملف`);
      }
    }
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
        <div className="flex gap-2">
          {/* Bulk Upload Button */}
          <Dialog open={bulkDialogOpen} onOpenChange={setBulkDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline">
                <FolderUp className="w-4 h-4 ml-1" /> رفع جماعي
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>رفع ملفات جماعي</DialogTitle>
              </DialogHeader>
              <p className="text-xs text-muted-foreground">
                اختر عدة ملفات دفعة واحدة — كل ملف يُسجَّل كمرجع مستقل باسمه تلقائياً
              </p>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <Select value={bulkCategory} onValueChange={setBulkCategory}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(CATEGORIES).map(([k, v]) => (
                        <SelectItem key={k} value={k}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select value={String(bulkPriority)} onValueChange={(v) => setBulkPriority(parseInt(v))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="10">أولوية قصوى</SelectItem>
                      <SelectItem value="7">عالية</SelectItem>
                      <SelectItem value="5">متوسطة</SelectItem>
                      <SelectItem value="3">منخفضة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div
                  className="border-2 border-dashed border-border rounded-lg p-6 text-center cursor-pointer hover:border-primary/50 transition-colors"
                  onClick={() => bulkInputRef.current?.click()}
                >
                  <input
                    ref={bulkInputRef}
                    type="file"
                    className="hidden"
                    multiple
                    accept=".pdf,.xlsx,.xls,.csv,.txt,.doc,.docx"
                    onChange={handleBulkFiles}
                  />
                  <FolderUp className="w-10 h-10 mx-auto mb-2 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground">
                    اضغط لاختيار عدة ملفات
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    PDF, Excel, Word, أو نص عادي
                  </p>
                </div>

                {bulkFiles.length > 0 && (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    <p className="text-xs font-medium text-foreground">
                      {bulkFiles.length} ملف مختار:
                    </p>
                    {bulkFiles.map((f, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs bg-muted/50 rounded px-2 py-1.5">
                        <FileText className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="flex-1 truncate text-foreground">{f.name}</span>
                        <span className="text-muted-foreground shrink-0">{formatSize(f.size)}</span>
                        <Button
                          variant="ghost" size="icon"
                          className="h-5 w-5 shrink-0 text-destructive"
                          onClick={(e) => { e.stopPropagation(); removeBulkFile(i); }}
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                {bulkUploading && (
                  <div className="space-y-2">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>جاري الرفع...</span>
                      <span>{bulkProgress} / {bulkTotal}</span>
                    </div>
                    <Progress value={(bulkProgress / bulkTotal) * 100} />
                  </div>
                )}
              </div>
              <DialogFooter>
                <Button onClick={uploadBulk} disabled={bulkFiles.length === 0 || bulkUploading}>
                  {bulkUploading ? (
                    <><Loader2 className="w-4 h-4 ml-1 animate-spin" /> جاري الرفع...</>
                  ) : (
                    <><Upload className="w-4 h-4 ml-1" /> رفع {bulkFiles.length > 0 ? `(${bulkFiles.length})` : ""}</>
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Single add button */}
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
