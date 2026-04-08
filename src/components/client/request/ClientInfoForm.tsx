/**
 * Client Info Form — client data + valuation settings
 */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { User as UserIcon } from "lucide-react";

export const PURPOSE_OPTIONS: Record<string, string> = {
  sale_purchase: "بيع / شراء",
  mortgage: "رهن / تمويل",
  financial_reporting: "تقارير مالية",
  insurance: "تأمين",
  taxation: "زكاة / ضريبة",
  expropriation: "نزع ملكية",
  litigation: "نزاع / قضاء",
  investment: "استثمار",
  lease_renewal: "تجديد إيجار",
  internal_decision: "قرار داخلي",
  regulatory: "تنظيمي",
  other: "أخرى",
};

export const INTENDED_USERS_OPTIONS: Record<string, string> = {
  bank: "بنك / مؤسسة مالية",
  government: "جهة حكومية",
  court: "محكمة",
  internal_management: "إدارة داخلية",
  investor: "مستثمر",
  other: "أخرى",
};

export const VALUATION_MODE_OPTIONS: Record<string, string> = {
  field: "ميداني (معاينة ميدانية)",
  desktop: "مكتبي (بدون معاينة)",
};

interface ClientInfoFormProps {
  clientNameInput: string;
  setClientNameInput: (v: string) => void;
  clientIdNumber: string;
  setClientIdNumber: (v: string) => void;
  clientPhone: string;
  setClientPhone: (v: string) => void;
  clientEmail: string;
  setClientEmail: (v: string) => void;
  purpose: string;
  setPurpose: (v: string) => void;
  purposeOther: string;
  setPurposeOther: (v: string) => void;
  intendedUser: string;
  setIntendedUser: (v: string) => void;
  intendedUserOther: string;
  setIntendedUserOther: (v: string) => void;
  valuationMode: string;
  setValuationMode: (v: string) => void;
}

export default function ClientInfoForm(props: ClientInfoFormProps) {
  const {
    clientNameInput, setClientNameInput, clientIdNumber, setClientIdNumber,
    clientPhone, setClientPhone, clientEmail, setClientEmail,
    purpose, setPurpose, purposeOther, setPurposeOther,
    intendedUser, setIntendedUser, intendedUserOther, setIntendedUserOther,
    valuationMode, setValuationMode,
  } = props;

  return (
    <Card>
      <CardContent className="p-6 space-y-4">
        <p className="text-sm font-semibold text-foreground flex items-center gap-1.5">
          <UserIcon className="w-4 h-4 text-primary" />
          معلومات العميل والتقييم
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">اسم العميل <span className="text-destructive">*</span></Label>
            <Input value={clientNameInput} onChange={e => setClientNameInput(e.target.value)}
              placeholder="الاسم الكامل" className="text-sm" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">رقم الهوية / السجل التجاري <Badge variant="secondary" className="text-[9px] mr-1">اختياري</Badge></Label>
            <Input value={clientIdNumber} onChange={e => setClientIdNumber(e.target.value)}
              placeholder="رقم الهوية أو السجل" className="text-sm" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">الجوال <span className="text-destructive">*</span></Label>
            <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)}
              placeholder="05xxxxxxxx" className="text-sm" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">البريد الإلكتروني <Badge variant="secondary" className="text-[9px] mr-1">اختياري</Badge></Label>
            <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)}
              placeholder="email@example.com" className="text-sm" dir="ltr" />
          </div>
        </div>

        <div className="border-t border-border/50 pt-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">الغرض من التقييم <span className="text-destructive">*</span></Label>
            <Select value={purpose} onValueChange={(v) => { setPurpose(v); if (v !== "other") setPurposeOther(""); }}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="اختر الغرض" /></SelectTrigger>
              <SelectContent>
                {Object.entries(PURPOSE_OPTIONS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {purpose === "other" && (
              <Input value={purposeOther} onChange={e => setPurposeOther(e.target.value)}
                placeholder="حدد الغرض..." className="text-sm mt-1.5" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">المستخدم المستهدف <span className="text-destructive">*</span></Label>
            <Select value={intendedUser} onValueChange={(v) => { setIntendedUser(v); if (v !== "other") setIntendedUserOther(""); }}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="اختر المستخدم" /></SelectTrigger>
              <SelectContent>
                {Object.entries(INTENDED_USERS_OPTIONS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {intendedUser === "other" && (
              <Input value={intendedUserOther} onChange={e => setIntendedUserOther(e.target.value)}
                placeholder="حدد المستخدم..." className="text-sm mt-1.5" />
            )}
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">نوع التقييم <span className="text-destructive">*</span></Label>
            <Select value={valuationMode} onValueChange={setValuationMode}>
              <SelectTrigger className="text-sm"><SelectValue placeholder="اختر النوع" /></SelectTrigger>
              <SelectContent>
                {Object.entries(VALUATION_MODE_OPTIONS).map(([key, label]) => (
                  <SelectItem key={key} value={key}>{label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
