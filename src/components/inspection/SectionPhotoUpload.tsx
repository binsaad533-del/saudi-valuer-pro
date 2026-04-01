import { Camera, Trash2, Image } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface SectionPhoto {
  file_name: string;
  preview: string;
  section: string;
}

interface SectionPhotoUploadProps {
  section: string;
  label?: string;
  photos: SectionPhoto[];
  onAdd: (photo: SectionPhoto) => void;
  onRemove: (photo: SectionPhoto) => void;
}

export default function SectionPhotoUpload({ section, label = "إرفاق صور", photos, onAdd, onRemove }: SectionPhotoUploadProps) {
  const sectionPhotos = photos.filter(p => p.section === section);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;
    for (const file of Array.from(files)) {
      onAdd({ file_name: file.name, preview: URL.createObjectURL(file), section });
    }
    toast.success("تم إضافة الصور");
  };

  return (
    <div className="mt-3 border border-dashed border-muted-foreground/20 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Image className="w-4 h-4" />
          <span className="text-xs font-medium">{label}</span>
        </div>
        {sectionPhotos.length > 0 && (
          <Badge variant="secondary" className="text-[10px]">{sectionPhotos.length} صور</Badge>
        )}
      </div>

      {sectionPhotos.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {sectionPhotos.map((p, i) => (
            <div key={i} className="relative shrink-0 w-14 h-14 bg-muted rounded overflow-hidden group">
              <img src={p.preview} alt="" className="w-full h-full object-cover" />
              <button
                onClick={() => onRemove(p)}
                className="absolute top-0 left-0 bg-destructive/80 text-white p-0.5 rounded-br opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Trash2 className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      <label className="block cursor-pointer">
        <input type="file" accept="image/*" capture="environment" multiple className="hidden" onChange={e => handleFiles(e.target.files)} />
        <div className="flex items-center justify-center gap-2 h-9 border border-dashed rounded-md text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors">
          <Camera className="w-3.5 h-3.5" /> التقاط / رفع صورة
        </div>
      </label>
    </div>
  );
}

export type { SectionPhoto };
