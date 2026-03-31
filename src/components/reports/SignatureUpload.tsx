import { useState, useRef } from "react";
import { Upload, Pen, Trash2, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface SignatureUploadProps {
  currentUrl: string | null;
  onSignatureChange: (url: string | null) => void;
  disabled?: boolean;
}

export default function SignatureUpload({ currentUrl, onSignatureChange, disabled }: SignatureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast({ title: "يرجى اختيار صورة", variant: "destructive" });
      return;
    }

    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "حجم الملف كبير جداً (الحد الأقصى 2 ميجابايت)", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `signatures/${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(path);
      const url = urlData.publicUrl;

      setPreview(url);
      onSignatureChange(url);
      toast({ title: "تم رفع التوقيع بنجاح" });
    } catch (err: any) {
      toast({ title: "فشل رفع التوقيع", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = () => {
    setPreview(null);
    onSignatureChange(null);
  };

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <Pen className="w-4 h-4 text-primary" />
            التوقيع الرقمي
          </h3>
          {preview && !disabled && (
            <Button size="sm" variant="ghost" onClick={handleRemove} className="text-destructive gap-1">
              <Trash2 className="w-3.5 h-3.5" /> حذف
            </Button>
          )}
        </div>

        {preview ? (
          <div className="border rounded-lg p-4 bg-muted/30 flex flex-col items-center gap-3">
            <img src={preview} alt="التوقيع" className="max-h-24 object-contain" />
            <div className="flex items-center gap-1 text-xs text-green-600">
              <Check className="w-3.5 h-3.5" /> تم تحميل التوقيع
            </div>
          </div>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            disabled={disabled || uploading}
            className="w-full border-2 border-dashed border-border rounded-lg p-8 flex flex-col items-center gap-3 hover:border-primary/50 hover:bg-primary/5 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Upload className="w-8 h-8 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">
              {uploading ? "جاري الرفع..." : "اضغط لرفع صورة التوقيع"}
            </span>
            <span className="text-xs text-muted-foreground">PNG أو JPG — حد أقصى 2 ميجابايت</span>
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={handleUpload}
        />
      </CardContent>
    </Card>
  );
}
