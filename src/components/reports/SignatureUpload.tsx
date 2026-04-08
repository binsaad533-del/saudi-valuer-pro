import { useState, useRef, useCallback } from "react";
import { Upload, Pen, Trash2, Check, Image, PenTool } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import SignaturePad from "./SignaturePad";

interface SignatureUploadProps {
  currentUrl: string | null;
  onSignatureChange: (url: string | null) => void;
  disabled?: boolean;
  /** Show compact mode (no card wrapper) */
  compact?: boolean;
}

export default function SignatureUpload({ currentUrl, onSignatureChange, disabled, compact }: SignatureUploadProps) {
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<string>("draw");
  const fileRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  const uploadDataUrl = async (dataUrl: string) => {
    setUploading(true);
    try {
      const res = await fetch(dataUrl);
      const blob = await res.blob();
      const path = `signatures/${Date.now()}.png`;

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(path, blob, { upsert: true, contentType: "image/png" });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("signatures").getPublicUrl(path);
      const url = urlData.publicUrl;

      setPreview(url);
      onSignatureChange(url);
      toast({ title: "تم حفظ التوقيع بنجاح ✓" });
    } catch (err: any) {
      toast({ title: "فشل حفظ التوقيع", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const processFile = useCallback(async (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast({ title: "يُقبل فقط صيغ PNG و JPG", variant: "destructive" });
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
      toast({ title: "تم رفع التوقيع بنجاح ✓" });
    } catch (err: any) {
      toast({ title: "فشل رفع التوقيع", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  }, [onSignatureChange, toast]);

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!disabled && !uploading) setIsDragging(true);
  }, [disabled, uploading]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (disabled || uploading) return;

    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  }, [disabled, uploading, processFile]);

  const handleRemove = () => {
    setPreview(null);
    onSignatureChange(null);
  };

  const handleDrawSign = (dataUrl: string) => {
    uploadDataUrl(dataUrl);
  };

  const content = (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
          <PenTool className="w-4 h-4 text-primary" />
          التوقيع الإلكتروني
        </h3>
        {preview && !disabled && (
          <Button size="sm" variant="ghost" onClick={handleRemove} className="text-destructive gap-1">
            <Trash2 className="w-3.5 h-3.5" /> حذف
          </Button>
        )}
      </div>

      {preview ? (
        <div className="border rounded-xl p-4 bg-muted/20 flex flex-col items-center gap-3">
          <img src={preview} alt="التوقيع" className="max-h-24 object-contain rounded-lg" />
          <div className="flex items-center gap-1 text-xs text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> التوقيع معتمد — سيُدرج تلقائياً في التقارير
          </div>
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
          <TabsList className="w-full mb-3">
            <TabsTrigger value="draw" className="flex-1 gap-1.5 text-xs">
              <Pen className="w-3.5 h-3.5" /> رسم التوقيع
            </TabsTrigger>
            <TabsTrigger value="upload" className="flex-1 gap-1.5 text-xs">
              <Upload className="w-3.5 h-3.5" /> رفع صورة
            </TabsTrigger>
          </TabsList>

          <TabsContent value="draw">
            <SignaturePad
              onSign={handleDrawSign}
              width={360}
              height={140}
              disabled={disabled || uploading}
            />
            {uploading && (
              <p className="text-xs text-muted-foreground text-center mt-2 animate-pulse">
                جاري حفظ التوقيع...
              </p>
            )}
          </TabsContent>

          <TabsContent value="upload">
            <button
              onClick={() => fileRef.current?.click()}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              disabled={disabled || uploading}
              className={cn(
                "w-full border-2 border-dashed rounded-xl p-8 flex flex-col items-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed",
                isDragging
                  ? "border-primary bg-primary/10 scale-[1.02]"
                  : "border-border hover:border-primary/50 hover:bg-primary/5"
              )}
            >
              {isDragging ? (
                <>
                  <Image className="w-10 h-10 text-primary animate-bounce" />
                  <span className="text-sm font-medium text-primary">أفلت الصورة هنا</span>
                </>
              ) : (
                <>
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">
                    {uploading ? "جاري الرفع..." : "اسحب وأفلت صورة التوقيع أو اضغط للاختيار"}
                  </span>
                  <span className="text-xs text-muted-foreground">PNG أو JPG — خلفية شفافة مفضلة</span>
                </>
              )}
            </button>
          </TabsContent>
        </Tabs>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg"
        className="hidden"
        onChange={handleUpload}
      />
    </div>
  );

  if (compact) return content;

  return (
    <Card>
      <CardContent className="pt-6">{content}</CardContent>
    </Card>
  );
}
