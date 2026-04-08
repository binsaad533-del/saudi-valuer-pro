import { RefObject } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload, FileText, Image, File, X, Loader2, ArrowRight, Send, Table2,
} from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  rawFile?: File;
}

interface JourneyUploadStepProps {
  uploadedFiles: UploadedFile[];
  uploading: boolean;
  dragOver: boolean;
  setDragOver: (v: boolean) => void;
  fileInputRef: RefObject<HTMLInputElement>;
  onFileUpload: (files: FileList) => void;
  onRemoveFile: (id: string) => void;
  onBack: () => void;
  onUploadDone: () => void;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-info" />;
  if (type.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return <Table2 className="w-4 h-4 text-success" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function JourneyUploadStep({
  uploadedFiles, uploading, dragOver, setDragOver, fileInputRef,
  onFileUpload, onRemoveFile, onBack, onUploadDone,
}: JourneyUploadStepProps) {
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files.length > 0) onFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4 mt-4">
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="w-5 h-5 text-primary" />
            ارفع المستندات
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            ارفع الصكوك، المخططات، جداول البيانات، أو أي وثائق متعلقة بالتقييم
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div
            className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${
              dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/30"
            }`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={e => { e.preventDefault(); setDragOver(true); }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <Upload className={`w-10 h-10 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
            <p className="text-sm font-medium text-foreground mb-1">
              {dragOver ? "أفلت الملفات هنا" : "اسحب الملفات أو اضغط للاختيار"}
            </p>
            <p className="text-xs text-muted-foreground">PDF • صور • Excel (XLSX, CSV) • Word</p>
            <p className="text-[11px] text-primary/70 mt-1">رفع Excel يسرّع إدخال الأصول تلقائياً</p>
            {uploading && (
              <div className="mt-3 flex items-center justify-center gap-2 text-primary">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">جارٍ الرفع...</span>
              </div>
            )}
          </div>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={e => e.target.files && onFileUpload(e.target.files)}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt,.tif,.tiff,.zip,.webp"
          />

          {uploadedFiles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">الملفات ({uploadedFiles.length})</p>
              <div className="max-h-[220px] overflow-y-auto space-y-1">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{file.name}</p>
                      <p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p>
                    </div>
                    <button onClick={() => onRemoveFile(file.id)} className="text-muted-foreground hover:text-destructive p-1">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button variant="outline" onClick={onBack} className="gap-1.5">
          <ArrowRight className="w-4 h-4" />
          رجوع
        </Button>
        <Button
          onClick={onUploadDone}
          className="flex-1 gap-2"
          size="lg"
          disabled={uploadedFiles.length === 0 || uploading}
        >
          <Send className="w-4 h-4" />
          تحليل ومعالجة ({uploadedFiles.length} ملف)
        </Button>
      </div>
    </div>
  );
}
