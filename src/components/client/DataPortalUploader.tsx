/**
 * بوابة البيانات الذكية — Data Portal
 * تتكيف مع نوع المعاينة (ميداني / مكتبي بصور / مكتبي بدون صور)
 */
import { useState, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import {
  Upload, Camera, FileText, Image as ImageIcon, Loader2,
  CheckCircle2, AlertTriangle, X, FileSpreadsheet, File,
  ShieldAlert, Info,
} from "lucide-react";
import type { InspectionType } from "@/lib/sow-engine";
import { applyClientWatermark } from "@/lib/image-watermark";

interface DataPortalUploaderProps {
  requestId: string;
  inspectionType: InspectionType;
  status: string;
  onUploadComplete?: () => void;
}

interface PortalFile {
  file: File;
  name: string;
  size: number;
  category: "photo" | "document" | "record";
  status: "pending" | "uploading" | "uploaded" | "error";
  storagePath?: string;
}

const CATEGORY_LABELS: Record<string, string> = {
  photo: "صور",
  document: "مستندات",
  record: "سجلات وفواتير",
};

/** Required document types per inspection mode */
const REQUIRED_DOCS: Record<InspectionType, { category: string; label: string; mandatory: boolean }[]> = {
  field: [
    { category: "document", label: "صك الملكية / عقد", mandatory: false },
  ],
  desktop_with_photos: [
    { category: "photo", label: "صور الأصل (إلزامي)", mandatory: true },
    { category: "document", label: "صك الملكية / عقد", mandatory: true },
  ],
  desktop_without_photos: [
    { category: "record", label: "جدول صيانة / فواتير شراء (إلزامي)", mandatory: true },
    { category: "document", label: "صك الملكية / عقد (إلزامي)", mandatory: true },
    { category: "record", label: "كروكي أو مخطط (إلزامي)", mandatory: true },
  ],
};

const INSPECTION_GUIDANCE: Record<InspectionType, { title: string; desc: string; color: string }> = {
  field: {
    title: "معاينة ميدانية",
    desc: "سيتم إرسال أمر عمل للمعاين الميداني. يمكنك رفع مستندات إضافية لتسريع العملية.",
    color: "text-primary",
  },
  desktop_with_photos: {
    title: "تقييم مكتبي — مع صور",
    desc: "يجب رفع صور حديثة وواضحة للأصل. ستوضع علامة مائية آلية (صورة مقدمة من العميل) على كل صورة.",
    color: "text-amber-600 dark:text-amber-400",
  },
  desktop_without_photos: {
    title: "تقييم مكتبي — بدون صور",
    desc: "يجب رفع جميع السجلات والوثائق المطلوبة (فواتير، جداول صيانة، كروكي). هذه الحقول إلزامية لإتمام الطلب.",
    color: "text-destructive",
  },
};

export default function DataPortalUploader({ requestId, inspectionType, status, onUploadComplete }: DataPortalUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<PortalFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [activeCategory, setActiveCategory] = useState<"photo" | "document" | "record">(
    inspectionType === "desktop_with_photos" ? "photo" : inspectionType === "desktop_without_photos" ? "record" : "document"
  );

  const guidance = INSPECTION_GUIDANCE[inspectionType];
  const requiredDocs = REQUIRED_DOCS[inspectionType];

  const getIcon = (name: string) => {
    const ext = name.split(".").pop()?.toLowerCase();
    if (["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "heic"].includes(ext || "")) return ImageIcon;
    if (["xls", "xlsx", "csv"].includes(ext || "")) return FileSpreadsheet;
    return File;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / 1048576).toFixed(1)} MB`;
  };

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList) return;
    const newFiles: PortalFile[] = Array.from(fileList).map(f => {
      const ext = f.name.split(".").pop()?.toLowerCase() || "";
      const isImage = ["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff", "heic"].includes(ext);
      return {
        file: f,
        name: f.name,
        size: f.size,
        category: isImage ? "photo" : activeCategory === "record" ? "record" : "document",
        status: "pending",
      };
    });
    setFiles(prev => [...prev, ...newFiles]);
  }, [activeCategory]);

  const removeFile = (idx: number) => setFiles(prev => prev.filter((_, i) => i !== idx));

  const canSubmit = () => {
    if (files.length === 0) return false;
    if (inspectionType === "desktop_with_photos") {
      return files.some(f => f.category === "photo");
    }
    if (inspectionType === "desktop_without_photos") {
      const hasRecords = files.some(f => f.category === "record");
      const hasDocs = files.some(f => f.category === "document");
      return hasRecords && hasDocs;
    }
    return true;
  };

  const uploadFiles = async () => {
    if (!canSubmit()) {
      toast.error("يرجى رفع جميع المستندات الإلزامية");
      return;
    }
    setUploading(true);

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("يرجى تسجيل الدخول"); setUploading(false); return; }

    let uploadedCount = 0;

    for (let i = 0; i < files.length; i++) {
      if (files[i].status === "uploaded") continue;
      setFiles(prev => prev.map((p, idx) => idx === i ? { ...p, status: "uploading" } : p));

      const f = files[i];
      const path = `client-data/${requestId}/${f.category}/${crypto.randomUUID()}_${f.name}`;

      // Apply watermark to client photos in desktop_with_photos mode
      let fileToUpload: File | Blob = f.file;
      if (f.category === "photo" && inspectionType === "desktop_with_photos") {
        fileToUpload = await applyClientWatermark(f.file);
      }

      const { error } = await supabase.storage
        .from("client-uploads")
        .upload(path, fileToUpload, { upsert: true });

      if (error) {
        setFiles(prev => prev.map((p, idx) => idx === i ? { ...p, status: "error" } : p));
      } else {
        setFiles(prev => prev.map((p, idx) => idx === i ? { ...p, status: "uploaded", storagePath: path } : p));
        uploadedCount++;

        // Save document record
        await supabase.from("request_documents" as any).insert({
          request_id: requestId,
          uploaded_by: user.id,
          file_name: f.name,
          file_path: path,
          document_type: f.category,
          file_size: f.size,
        });
      }
    }

    if (uploadedCount > 0) {
      // Log system message
      const isPhotos = files.some(f => f.category === "photo" && f.status === "uploaded");
      const label = isPhotos && inspectionType === "desktop_with_photos"
        ? `📸 تم رفع ${uploadedCount} ملف (صور مقدمة من العميل — سيتم وضع علامة مائية آلية)`
        : `📎 تم رفع ${uploadedCount} مستند من قبل العميل`;

      await supabase.from("request_messages" as any).insert({
        request_id: requestId,
        sender_type: "system" as any,
        content: label,
      });

      toast.success(`تم رفع ${uploadedCount} ملف بنجاح`);
      onUploadComplete?.();
    }

    setUploading(false);
  };

  // Only show in relevant statuses
  const showPortal = ["sow_approved", "awaiting_payment", "payment_uploaded", "partially_paid", "fully_paid", "in_production"].includes(status);
  if (!showPortal) return null;

  return (
    <Card className="shadow-card border-primary/20">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          بوابة البيانات
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Guidance Banner */}
        <div className="p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-start gap-2">
            <Info className={`w-4 h-4 shrink-0 mt-0.5 ${guidance.color}`} />
            <div>
              <p className={`text-xs font-bold ${guidance.color}`}>{guidance.title}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5 leading-4">{guidance.desc}</p>
            </div>
          </div>
        </div>

        {/* Required Documents Checklist */}
        <div className="space-y-1">
          {requiredDocs.map((req, i) => {
            const hasFile = files.some(f => f.category === req.category && f.status !== "error");
            return (
              <div key={i} className="flex items-center gap-2 text-xs">
                {hasFile ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-green-600 shrink-0" />
                ) : req.mandatory ? (
                  <ShieldAlert className="w-3.5 h-3.5 text-destructive shrink-0" />
                ) : (
                  <div className="w-3.5 h-3.5 rounded-full border border-muted-foreground/30 shrink-0" />
                )}
                <span className={`${req.mandatory && !hasFile ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                  {req.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Category Tabs */}
        <div className="flex gap-1">
          {(["photo", "document", "record"] as const).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 text-[10px] py-1.5 rounded-md transition-colors ${
                activeCategory === cat
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              }`}
            >
              {CATEGORY_LABELS[cat]}
            </button>
          ))}
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors
            ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}
        >
          {activeCategory === "photo" ? (
            <Camera className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
          ) : (
            <Upload className="w-5 h-5 mx-auto mb-1.5 text-muted-foreground" />
          )}
          <p className="text-[11px] text-muted-foreground">
            {activeCategory === "photo" ? "اسحب الصور أو اضغط للاختيار" : "اسحب الملفات أو اضغط للاختيار"}
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => handleFiles(e.target.files)}
            accept={activeCategory === "photo"
              ? "image/*"
              : ".pdf,.xlsx,.xls,.csv,.doc,.docx,.jpg,.jpeg,.png,.webp,.tif,.tiff"}
          />
        </div>

        {/* File List */}
        {files.length > 0 && (
          <div className="space-y-1 max-h-32 overflow-y-auto">
            {files.map((f, i) => {
              const Icon = getIcon(f.name);
              return (
                <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-md bg-muted/40 text-xs">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                  <span className="flex-1 truncate text-foreground">{f.name}</span>
                  <Badge variant="outline" className="text-[9px] px-1">{CATEGORY_LABELS[f.category]}</Badge>
                  <span className="text-muted-foreground text-[10px]">{formatSize(f.size)}</span>
                  {f.status === "uploaded" && <CheckCircle2 className="w-3.5 h-3.5 text-green-600" />}
                  {f.status === "uploading" && <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />}
                  {f.status === "error" && <AlertTriangle className="w-3.5 h-3.5 text-destructive" />}
                  {f.status === "pending" && (
                    <button onClick={(e) => { e.stopPropagation(); removeFile(i); }} className="text-muted-foreground hover:text-destructive">
                      <X className="w-3 h-3" />
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Watermark Notice for desktop_with_photos */}
        {inspectionType === "desktop_with_photos" && files.some(f => f.category === "photo") && (
          <div className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-900/20 rounded-md border border-amber-200 dark:border-amber-800">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-[10px] text-amber-700 dark:text-amber-300 leading-4">
              سيتم وضع علامة مائية "صورة مقدمة من العميل" على جميع الصور تلقائياً لحماية المقيّم
            </p>
          </div>
        )}

        {/* Upload Button */}
        {files.some(f => f.status === "pending") && (
          <Button
            className="w-full text-xs h-9"
            onClick={uploadFiles}
            disabled={uploading || !canSubmit()}
          >
            {uploading ? (
              <><Loader2 className="w-3.5 h-3.5 animate-spin ml-1" />جاري الرفع...</>
            ) : (
              <><Upload className="w-3.5 h-3.5 ml-1" />رفع المستندات ({files.filter(f => f.status === "pending").length})</>
            )}
          </Button>
        )}

        {/* Validation Warning */}
        {!canSubmit() && files.length > 0 && (
          <p className="text-[10px] text-destructive text-center">
            {inspectionType === "desktop_with_photos" && "يجب رفع صورة واحدة على الأقل"}
            {inspectionType === "desktop_without_photos" && "يجب رفع السجلات والمستندات الإلزامية"}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
