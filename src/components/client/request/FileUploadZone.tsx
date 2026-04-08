/**
 * File Upload Zone — drag & drop + file list
 */
import { useRef } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileText, Image, File, X, Loader2, Table2,
} from "lucide-react";

interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  path: string;
  rawFile?: File;
}

interface FileUploadZoneProps {
  files: UploadedFile[];
  uploading: boolean;
  dragOver: boolean;
  onDragOver: (e: React.DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: (files: FileList) => void;
  onRemove: (id: string) => void;
}

function getFileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-primary" />;
  if (type.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
  if (type.includes("sheet") || type.includes("excel") || type.includes("csv")) return <Table2 className="w-4 h-4 text-emerald-600" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
}

function formatSize(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(1)} MB`;
}

export type { UploadedFile };

export default function FileUploadZone({
  files, uploading, dragOver,
  onDragOver, onDragLeave, onDrop, onFileSelect, onRemove,
}: FileUploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold text-foreground">المستندات <span className="text-destructive">*</span></p>
          {files.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{files.length} ملف</Badge>
          )}
        </div>
        <div
          className={`border-2 border-dashed rounded-xl p-10 text-center cursor-pointer transition-all ${
            dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/40 hover:bg-muted/30"
          }`}
          onClick={() => fileInputRef.current?.click()}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
        >
          <Upload className={`w-12 h-12 mx-auto mb-3 ${dragOver ? "text-primary" : "text-muted-foreground/30"}`} />
          <p className="text-sm font-medium text-foreground mb-1">
            {dragOver ? "أفلت الملفات هنا" : "اسحب الملفات أو اضغط للاختيار"}
          </p>
          <p className="text-xs text-muted-foreground mb-3">Excel • PDF • صور • مستندات Word — حتى 20 ميجا للملف</p>
          <div className="flex flex-wrap justify-center gap-2">
            <Badge variant="outline" className="text-[10px] gap-1"><Table2 className="w-3 h-3" />جداول الأصول</Badge>
            <Badge variant="outline" className="text-[10px] gap-1"><FileText className="w-3 h-3" />صكوك وعقود</Badge>
            <Badge variant="outline" className="text-[10px] gap-1"><Image className="w-3 h-3" />صور</Badge>
          </div>
          {uploading && (
            <div className="mt-4 flex items-center justify-center gap-2 text-primary">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-xs">جارٍ الرفع...</span>
            </div>
          )}
        </div>
        <input ref={fileInputRef} type="file" multiple className="hidden"
          onChange={e => e.target.files && onFileSelect(e.target.files)}
          accept=".pdf,.jpg,.jpeg,.png,.xls,.xlsx,.csv,.doc,.docx,.webp,.tif,.tiff"
        />
        {files.length > 0 && (
          <div className="max-h-[280px] overflow-y-auto space-y-1.5 rounded-lg border border-border/50 p-2">
            {files.map(file => (
              <div key={file.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/50 hover:bg-muted/80 transition-colors">
                {getFileIcon(file.type)}
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground truncate">{file.name}</p>
                  <p className="text-[10px] text-muted-foreground">{formatSize(file.size)}</p>
                </div>
                <button onClick={() => onRemove(file.id)} className="text-muted-foreground hover:text-destructive p-1 rounded-md hover:bg-destructive/10 transition-colors">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
