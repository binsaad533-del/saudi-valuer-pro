import { RefObject, useState } from "react";
import { Badge } from "@/components/ui/badge";
import {
  FolderUp, FileText, FileSpreadsheet, File, X, Loader2,
  Image as ImageIcon,
} from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";

interface UploadedFile {
  file: File;
  name: string;
  size: number;
  category?: string;
  categoryLabel?: string;
  relevance?: string;
  extractedInfo?: string;
  storagePath?: string;
}

interface ValuationDocUploadProps {
  uploadedFiles: UploadedFile[];
  fileInputRef: RefObject<HTMLInputElement>;
  onFilesSelected: (files: FileList | null) => void;
  onRemoveFile: (index: number) => void;
  onRunExtraction: () => void;
  extracting: boolean;
  extractionPhase: string;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getFileIcon(fileName: string) {
  const ext = fileName.split(".").pop()?.toLowerCase();
  if (["jpg", "jpeg", "png", "webp", "gif", "tif", "tiff"].includes(ext || "")) return ImageIcon;
  if (ext === "pdf") return FileText;
  if (["xls", "xlsx"].includes(ext || "")) return FileSpreadsheet;
  return File;
}

export default function ValuationDocUpload({
  uploadedFiles, fileInputRef, onFilesSelected, onRemoveFile,
  onRunExtraction, extracting, extractionPhase,
}: ValuationDocUploadProps) {
  const [dragOver, setDragOver] = useState(false);

  return (
    <div className="space-y-6">
      <div>
        <h3 className="font-semibold text-foreground mb-1">رفع الوثائق</h3>
        <p className="text-sm text-muted-foreground mb-5">ارفع جميع المستندات المتوفرة دفعة واحدة — سيتم تحليل المحتوى الفعلي للملفات</p>
      </div>

      <div
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => { e.preventDefault(); setDragOver(false); onFilesSelected(e.dataTransfer.files); }}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all
          ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
      >
        <input ref={fileInputRef} type="file" multiple className="hidden"
          accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.tif,.tiff,.webp"
          onChange={(e) => onFilesSelected(e.target.files)} />
        <FolderUp className={`w-12 h-12 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground"}`} />
        <p className="text-sm font-medium text-foreground mb-1">اسحب الملفات هنا أو اضغط للاختيار</p>
        <p className="text-xs text-muted-foreground">PDF, صور, Word, Excel — يتم تحليل محتوى الملفات بالذكاء الاصطناعي</p>
      </div>

      {uploadedFiles.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-foreground">{uploadedFiles.length} ملف مرفوع</span>
            <button onClick={() => fileInputRef.current?.click()} className="text-xs text-primary hover:underline">+ إضافة المزيد</button>
          </div>
          <div className="space-y-1.5 max-h-60 overflow-y-auto">
            {uploadedFiles.map((f, i) => {
              const Icon = getFileIcon(f.name);
              return (
                <div key={i} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                  <div className="flex items-center gap-3 min-w-0">
                    <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{f.name}</p>
                      <p className="text-[10px] text-muted-foreground">{formatFileSize(f.size)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.category && <Badge variant="secondary" className="text-[10px]">{f.categoryLabel || f.category}</Badge>}
                    <button onClick={() => onRemoveFile(i)} className="p-1 rounded hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {uploadedFiles.length > 0 && (
        <button
          onClick={onRunExtraction}
          disabled={extracting}
          className="w-full flex items-center justify-center gap-2 px-6 py-3 rounded-lg text-sm font-medium gradient-primary text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50"
        >
          {extracting ? (
            <><Loader2 className="w-4 h-4 animate-spin" />{extractionPhase || "جارٍ تحليل الوثائق بالذكاء الاصطناعي..."}</>
          ) : (
            <><RaqeemIcon size={16} />تحليل المحتوى بالذكاء الاصطناعي</>
          )}
        </button>
      )}
    </div>
  );
}
