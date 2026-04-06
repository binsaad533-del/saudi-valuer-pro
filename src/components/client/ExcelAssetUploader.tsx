import { useState, useCallback, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet, Upload, Loader2, CheckCircle, ArrowRight, Table2 } from "lucide-react";
import { toast } from "sonner";
import { parseExcelFile, type ParsedSheet, type ExcelParseResult } from "@/lib/excel-parser";
import ExcelColumnMapper from "./ExcelColumnMapper";

interface ExcelAssetUploaderProps {
  onAssetsReady: (assets: Record<string, any>[], fileName: string) => void;
  onCancel: () => void;
}

type UploaderStep = "select" | "sheet" | "mapping" | "done";

export default function ExcelAssetUploader({ onAssetsReady, onCancel }: ExcelAssetUploaderProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<UploaderStep>("select");
  const [parsing, setParsing] = useState(false);
  const [parseResult, setParseResult] = useState<ExcelParseResult | null>(null);
  const [selectedSheet, setSelectedSheet] = useState<ParsedSheet | null>(null);

  const handleFileSelect = useCallback(async (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (!["xlsx", "xls", "csv"].includes(ext || "")) {
      toast.error("يرجى اختيار ملف Excel أو CSV");
      return;
    }

    setParsing(true);
    try {
      const result = await parseExcelFile(file);
      if (result.sheets.length === 0) {
        toast.error("الملف لا يحتوي على بيانات");
        return;
      }
      setParseResult(result);

      if (result.sheets.length === 1) {
        setSelectedSheet(result.sheets[0]);
        setStep("mapping");
      } else {
        setStep("sheet");
      }
    } catch (err: any) {
      toast.error(err.message || "فشل في قراءة الملف");
    } finally {
      setParsing(false);
    }
  }, []);

  const handleConfirmAssets = useCallback(
    (assets: Record<string, any>[]) => {
      setStep("done");
      onAssetsReady(assets, parseResult?.fileName ?? "excel");
    },
    [onAssetsReady, parseResult],
  );

  // ── Step: Select file ──
  if (step === "select") {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            استيراد أصول من Excel
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div
            className="border-2 border-dashed border-border rounded-xl p-8 text-center cursor-pointer hover:border-primary/40 hover:bg-muted/30 transition-all"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleFileSelect(file);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            />
            {parsing ? (
              <>
                <Loader2 className="w-10 h-10 mx-auto mb-3 text-primary animate-spin" />
                <p className="text-sm text-muted-foreground">جاري تحليل الملف...</p>
              </>
            ) : (
              <>
                <Table2 className="w-10 h-10 mx-auto mb-3 text-muted-foreground/50" />
                <p className="text-sm font-medium text-foreground mb-1">
                  اختر ملف Excel أو CSV
                </p>
                <p className="text-xs text-muted-foreground">
                  XLSX • XLS • CSV — يتم اكتشاف الأعمدة تلقائياً
                </p>
              </>
            )}
          </div>
          <Button variant="outline" onClick={onCancel} className="w-full">
            إلغاء
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Step: Choose sheet ──
  if (step === "sheet" && parseResult) {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            اختر ورقة العمل — {parseResult.fileName}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {parseResult.sheets.map((sheet) => (
            <button
              key={sheet.name}
              className="w-full flex items-center justify-between p-3 bg-muted/30 rounded-lg border border-border hover:border-primary/40 hover:bg-muted/50 transition-all text-right"
              onClick={() => {
                setSelectedSheet(sheet);
                setStep("mapping");
              }}
            >
              <div>
                <p className="text-sm font-medium">{sheet.name}</p>
                <p className="text-xs text-muted-foreground">
                  {sheet.totalRows} صف • {sheet.headers.length} عمود
                </p>
              </div>
              <ArrowRight className="w-4 h-4 text-muted-foreground rotate-180" />
            </button>
          ))}
          <Button variant="outline" onClick={() => setStep("select")} className="w-full">
            اختيار ملف آخر
          </Button>
        </CardContent>
      </Card>
    );
  }

  // ── Step: Column mapping ──
  if (step === "mapping" && selectedSheet && parseResult) {
    return (
      <ExcelColumnMapper
        sheet={selectedSheet}
        fileName={parseResult.fileName}
        onConfirm={handleConfirmAssets}
        onBack={() =>
          parseResult.sheets.length > 1 ? setStep("sheet") : setStep("select")
        }
      />
    );
  }

  // ── Step: Done ──
  return (
    <Card className="border-border">
      <CardContent className="p-8 text-center">
        <CheckCircle className="w-12 h-12 text-primary mx-auto mb-3" />
        <p className="font-medium text-foreground">تم استيراد الأصول بنجاح</p>
      </CardContent>
    </Card>
  );
}