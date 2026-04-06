import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  FileSpreadsheet, ArrowRight, CheckCircle, AlertTriangle,
  XCircle, Sparkles, Eye, Loader2, ArrowLeft,
} from "lucide-react";
import {
  type ParsedSheet,
  type ColumnMapping,
  type ValidationIssue,
  ASSET_FIELDS,
  autoMapColumns,
  applyMapping,
  validateMappedAssets,
} from "@/lib/excel-parser";

interface ExcelColumnMapperProps {
  sheet: ParsedSheet;
  fileName: string;
  onConfirm: (assets: Record<string, any>[]) => void;
  onBack: () => void;
}

type ViewMode = "mapping" | "preview";

export default function ExcelColumnMapper({
  sheet,
  fileName,
  onConfirm,
  onBack,
}: ExcelColumnMapperProps) {
  const [mappings, setMappings] = useState<ColumnMapping[]>(() =>
    autoMapColumns(sheet.headers),
  );
  const [view, setView] = useState<ViewMode>("mapping");

  const mappedAssets = useMemo(
    () => applyMapping(sheet.rows, mappings),
    [sheet.rows, mappings],
  );

  const issues = useMemo(
    () => validateMappedAssets(mappedAssets, mappings),
    [mappedAssets, mappings],
  );

  const errors = issues.filter((i) => i.severity === "error");
  const warnings = issues.filter((i) => i.severity === "warning");
  const mappedCount = mappings.filter((m) => m.targetField).length;
  const autoMappedCount = mappings.filter((m) => m.autoMapped).length;

  const updateMapping = (index: number, targetField: string | null) => {
    setMappings((prev) =>
      prev.map((m, i) =>
        i === index
          ? { ...m, targetField: targetField === "_skip" ? null : targetField, autoMapped: false }
          : m,
      ),
    );
  };

  // Fields already assigned
  const usedFields = new Set(mappings.filter((m) => m.targetField).map((m) => m.targetField));

  const handleConfirm = () => {
    if (errors.length > 0) return;
    onConfirm(mappedAssets);
  };

  // ── Preview table ──
  const previewFields = ASSET_FIELDS.filter((f) => usedFields.has(f.key));
  const previewRows = mappedAssets.slice(0, 20);

  if (view === "preview") {
    return (
      <Card className="border-border">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Eye className="w-4 h-4" />
              معاينة البيانات — {mappedAssets.length} أصل
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => setView("mapping")}>
              <ArrowRight className="w-4 h-4 ml-1" />
              العودة للربط
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto max-h-[400px] overflow-y-auto rounded-lg border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-center w-12">#</TableHead>
                  {previewFields.map((f) => (
                    <TableHead key={f.key} className="text-right whitespace-nowrap">
                      {f.labelAr}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewRows.map((row, i) => (
                  <TableRow key={i}>
                    <TableCell className="text-center text-xs text-muted-foreground">{i + 1}</TableCell>
                    {previewFields.map((f) => (
                      <TableCell key={f.key} className="text-xs max-w-[200px] truncate">
                        {row[f.key] != null ? String(row[f.key]) : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          {mappedAssets.length > 20 && (
            <p className="text-xs text-muted-foreground mt-2 text-center">
              يتم عرض أول 20 صف من {mappedAssets.length}
            </p>
          )}
          <div className="flex gap-3 mt-4">
            <Button variant="outline" onClick={() => setView("mapping")} className="flex-1">
              <ArrowRight className="w-4 h-4 ml-1" />
              تعديل الربط
            </Button>
            <Button onClick={handleConfirm} disabled={errors.length > 0} className="flex-1">
              <CheckCircle className="w-4 h-4 ml-1" />
              تأكيد واستيراد {mappedAssets.length} أصل
            </Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  // ── Mapping view ──
  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <CardTitle className="text-base flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-primary" />
            ربط الأعمدة — {fileName}
          </CardTitle>
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs">
              {sheet.totalRows} صف
            </Badge>
            <Badge variant="secondary" className="text-xs">
              {sheet.headers.length} عمود
            </Badge>
          </div>
        </div>
        {autoMappedCount > 0 && (
          <div className="flex items-center gap-1.5 text-xs text-primary mt-1">
            <Sparkles className="w-3.5 h-3.5" />
            تم ربط {autoMappedCount} عمود تلقائياً
          </div>
        )}
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Validation alerts */}
        {errors.length > 0 && (
          <Alert variant="destructive">
            <XCircle className="w-4 h-4" />
            <AlertTitle>أخطاء يجب إصلاحها</AlertTitle>
            <AlertDescription>
              <ul className="list-disc list-inside text-xs mt-1 space-y-0.5">
                {errors.map((e, i) => (
                  <li key={i}>{e.message}</li>
                ))}
              </ul>
            </AlertDescription>
          </Alert>
        )}

        {warnings.length > 0 && errors.length === 0 && (
          <Alert>
            <AlertTriangle className="w-4 h-4" />
            <AlertTitle>تنبيهات</AlertTitle>
            <AlertDescription className="text-xs">
              {warnings.length} تنبيه — بعض الصفوف تحتوي على حقول فارغة
            </AlertDescription>
          </Alert>
        )}

        {/* Mapping progress */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-muted-foreground">تقدم الربط</span>
            <span className="font-medium">{mappedCount}/{sheet.headers.length} عمود</span>
          </div>
          <Progress value={(mappedCount / sheet.headers.length) * 100} className="h-1.5" />
        </div>

        {/* Column mapping table */}
        <div className="overflow-x-auto rounded-lg border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">عمود الملف</TableHead>
                <TableHead className="w-8 text-center" />
                <TableHead className="text-right">حقل الأصل</TableHead>
                <TableHead className="text-right w-20">عينة</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mappings.map((mapping, idx) => {
                const sampleValues = sheet.rows
                  .slice(0, 3)
                  .map((r) => r[mapping.sourceColumn])
                  .filter((v) => v != null && v !== "")
                  .map(String);

                return (
                  <TableRow key={idx}>
                    <TableCell className="font-medium text-sm">
                      <div className="flex items-center gap-1.5">
                        {mapping.sourceColumn}
                        {mapping.autoMapped && (
                          <Sparkles className="w-3 h-3 text-primary shrink-0" />
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <ArrowLeft className="w-4 h-4 text-muted-foreground mx-auto" />
                    </TableCell>
                    <TableCell>
                      <Select
                        value={mapping.targetField ?? "_skip"}
                        onValueChange={(val) => updateMapping(idx, val)}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="_skip">
                            <span className="text-muted-foreground">— تخطي —</span>
                          </SelectItem>
                          {ASSET_FIELDS.map((field) => (
                            <SelectItem
                              key={field.key}
                              value={field.key}
                              disabled={
                                usedFields.has(field.key) &&
                                mapping.targetField !== field.key
                              }
                            >
                              <span className="flex items-center gap-1">
                                {field.labelAr}
                                {field.required && (
                                  <span className="text-destructive">*</span>
                                )}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                      {sampleValues.length > 0 ? sampleValues.join("، ") : "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>

        {/* Actions */}
        <div className="flex gap-3">
          <Button variant="outline" onClick={onBack} className="flex-1">
            <ArrowRight className="w-4 h-4 ml-1" />
            رجوع
          </Button>
          <Button
            variant="outline"
            onClick={() => setView("preview")}
            disabled={mappedCount === 0}
            className="flex-1"
          >
            <Eye className="w-4 h-4 ml-1" />
            معاينة
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={errors.length > 0 || mappedCount === 0}
            className="flex-1"
          >
            <CheckCircle className="w-4 h-4 ml-1" />
            تأكيد ({mappedAssets.length} أصل)
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}