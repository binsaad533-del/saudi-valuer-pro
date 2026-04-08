/**
 * Upload step for NewRequest — client info form + document upload zone
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Upload, FileText, Image, File, X, Loader2, Sparkles, User as UserIcon,
} from "lucide-react";
import AssetLocationPicker, { type AssetLocation } from "@/components/client/AssetLocationPicker";

interface UploadedFile {
  id: string; name: string; size: number; type: string; path: string;
}

interface ClientInfo {
  contactName: string; contactPhone: string; contactEmail: string; idNumber: string;
  clientType: string; additionalNotes: string; purpose: string; purposeOther: string;
  intendedUsers: string; intendedUsersOther: string;
}

const PURPOSE_LABELS: Record<string, string> = {
  financing: "تمويل", sale: "بيع", purchase: "شراء", financial_reporting: "تقارير مالية",
  zakat_tax: "زكاة / ضريبة", dispute_court: "نزاع / قضاء", expropriation: "نزع ملكية", other: "أخرى",
};

const INTENDED_USERS_OPTIONS: Record<string, string> = {
  bank: "بنك / مؤسسة مالية", government: "جهة حكومية", court: "محكمة",
  internal_management: "إدارة داخلية", investor: "مستثمر", other: "أخرى",
};

const getFileIcon = (type: string) => {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-info" />;
  if (type.includes("pdf")) return <FileText className="w-4 h-4 text-destructive" />;
  return <File className="w-4 h-4 text-muted-foreground" />;
};

const formatFileSize = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

interface Props {
  clientInfo: ClientInfo;
  onClientInfoChange: (info: ClientInfo) => void;
  uploadedFiles: UploadedFile[];
  uploading: boolean;
  dragOver: boolean;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent) => void;
  onFileSelect: () => void;
  onRemoveFile: (id: string) => void;
  fileInputRef: React.RefObject<HTMLInputElement>;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  assetLocations: AssetLocation[];
  onLocationsChange: (locations: AssetLocation[]) => void;
  onStartProcessing: () => void;
}

export default function NewRequestUploadStep({
  clientInfo, onClientInfoChange, uploadedFiles, uploading, dragOver,
  onDragOver, onDragLeave, onDrop, onFileSelect, onRemoveFile,
  fileInputRef, onInputChange, assetLocations, onLocationsChange, onStartProcessing,
}: Props) {
  const setField = (key: keyof ClientInfo, value: string) => onClientInfoChange({ ...clientInfo, [key]: value });

  return (
    <div className="space-y-4">
      {/* Client Info */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><UserIcon className="w-5 h-5 text-primary" /> بيانات عميل التقرير</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">أدخل بيانات الشخص أو الجهة التي سيُعد التقرير لصالحها.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-sm">الغرض من التقييم <span className="text-destructive">*</span></Label>
              <Select value={clientInfo.purpose} onValueChange={(val) => onClientInfoChange({ ...clientInfo, purpose: val, purposeOther: val !== "other" ? "" : clientInfo.purposeOther })}>
                <SelectTrigger><SelectValue placeholder="اختر الغرض" /></SelectTrigger>
                <SelectContent>{Object.entries(PURPOSE_LABELS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
              {clientInfo.purpose === "other" && <Input value={clientInfo.purposeOther} onChange={(e) => setField("purposeOther", e.target.value)} placeholder="حدد الغرض من التقييم" className="mt-2" />}
            </div>
            <div className="space-y-1.5">
              <Label className="text-sm">نوع العميل <span className="text-destructive">*</span></Label>
              <Select value={clientInfo.clientType} onValueChange={(val) => setField("clientType", val)}>
                <SelectTrigger><SelectValue placeholder="فرد أو جهة" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="individual">فرد</SelectItem>
                  <SelectItem value="company">شركة / مؤسسة</SelectItem>
                  <SelectItem value="government">جهة حكومية</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-sm">اسم عميل التقرير <span className="text-destructive">*</span></Label><Input value={clientInfo.contactName} onChange={(e) => setField("contactName", e.target.value)} placeholder="اسم الشخص أو الجهة" /></div>
            <div className="space-y-1.5"><Label className="text-sm">رقم الهوية / السجل التجاري</Label><Input value={clientInfo.idNumber} onChange={(e) => setField("idNumber", e.target.value)} placeholder="رقم الهوية أو السجل" dir="ltr" /></div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5"><Label className="text-sm">رقم الجوال <span className="text-destructive">*</span></Label><Input value={clientInfo.contactPhone} onChange={(e) => setField("contactPhone", e.target.value)} placeholder="05XXXXXXXX" dir="ltr" /></div>
            <div className="space-y-1.5"><Label className="text-sm">البريد الإلكتروني</Label><Input value={clientInfo.contactEmail} onChange={(e) => setField("contactEmail", e.target.value)} placeholder="example@email.com" dir="ltr" /></div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">مستخدمو التقرير <span className="text-destructive">*</span></Label>
            <Select value={clientInfo.intendedUsers} onValueChange={(val) => onClientInfoChange({ ...clientInfo, intendedUsers: val, intendedUsersOther: val !== "other" ? "" : clientInfo.intendedUsersOther })}>
              <SelectTrigger><SelectValue placeholder="اختر مستخدم التقرير" /></SelectTrigger>
              <SelectContent>{Object.entries(INTENDED_USERS_OPTIONS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
            {clientInfo.intendedUsers === "other" && <Input value={clientInfo.intendedUsersOther} onChange={(e) => setField("intendedUsersOther", e.target.value)} placeholder="حدد مستخدم التقرير" className="mt-2" />}
          </div>
        </CardContent>
      </Card>

      {/* Upload Zone */}
      <Card className="shadow-card">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-lg"><Upload className="w-5 h-5 text-primary" /> الوثائق المتعلقة بالتقييم</CardTitle>
          <p className="text-sm text-muted-foreground mt-1">ارفع صكوك الملكية، المخططات، التقارير، الصور، جداول البيانات، أو أي مستندات ذات صلة.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className={`border-2 border-dashed rounded-xl p-5 text-center cursor-pointer transition-all ${dragOver ? "border-primary bg-primary/5 scale-[1.01]" : "border-border hover:border-primary/40 hover:bg-muted/30"}`}
            onClick={onFileSelect}
            onDragOver={(e) => { e.preventDefault(); onDragOver(); }}
            onDragLeave={onDragLeave}
            onDrop={onDrop}>
            <Upload className={`w-8 h-8 mx-auto mb-2 ${dragOver ? "text-primary" : "text-muted-foreground/40"}`} />
            <p className="text-sm font-medium text-foreground mb-1">{dragOver ? "أفلت الملفات هنا" : "اسحب الملفات هنا أو اضغط للاختيار"}</p>
            <p className="text-xs text-muted-foreground">PDF • صور • Word • Excel (XLSX, CSV) • ZIP — بأي عدد وحجم</p>
            {uploading && <div className="mt-2 flex items-center justify-center gap-2 text-primary"><Loader2 className="w-4 h-4 animate-spin" /><span className="text-sm">جارٍ الرفع...</span></div>}
          </div>
          <input ref={fileInputRef} type="file" multiple className="hidden" onChange={onInputChange}
            accept=".pdf,.jpg,.jpeg,.png,.doc,.docx,.xls,.xlsx,.csv,.txt,.tif,.tiff,.zip,.rar,.7z,.gz,.webp,.heic,.ppt,.pptx,.xml,.json" />
          {uploadedFiles.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-muted-foreground">الملفات المرفوعة ({uploadedFiles.length})</p>
              <div className="max-h-[200px] overflow-y-auto space-y-1">
                {uploadedFiles.map(file => (
                  <div key={file.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                    {getFileIcon(file.type)}
                    <div className="flex-1 min-w-0"><p className="text-sm text-foreground truncate">{file.name}</p><p className="text-[11px] text-muted-foreground">{formatFileSize(file.size)}</p></div>
                    <button onClick={() => onRemoveFile(file.id)} className="text-muted-foreground hover:text-destructive p-1"><X className="w-4 h-4" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <AssetLocationPicker locations={assetLocations} onChange={onLocationsChange} />

      <Button onClick={onStartProcessing} className="w-full gap-2" size="lg"
        disabled={uploadedFiles.length === 0 || uploading || !clientInfo.contactName.trim() || !clientInfo.purpose || !clientInfo.clientType || !clientInfo.contactPhone.trim() || !clientInfo.intendedUsers.trim()}>
        <Sparkles className="w-4 h-4" /> تحليل الوثائق واستخراج البيانات ({uploadedFiles.length} ملف)
      </Button>
    </div>
  );
}

export { PURPOSE_LABELS, INTENDED_USERS_OPTIONS };
export type { UploadedFile, ClientInfo };
