import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  ArrowLeft, User as UserIcon, CheckCircle, Eye, Monitor,
  Shield, Zap, BadgeCheck,
} from "lucide-react";

interface JourneyStartStepProps {
  clientName: string;
  setClientName: (v: string) => void;
  clientPhone: string;
  setClientPhone: (v: string) => void;
  clientEmail: string;
  setClientEmail: (v: string) => void;
  purpose: string;
  setPurpose: (v: string) => void;
  purposeOther: string;
  setPurposeOther: (v: string) => void;
  intendedUsers: string;
  setIntendedUsers: (v: string) => void;
  intendedUsersOther: string;
  setIntendedUsersOther: (v: string) => void;
  valuationMode: "field" | "desktop";
  setValuationMode: (v: "field" | "desktop") => void;
  desktopDisclaimer: boolean;
  setDesktopDisclaimer: (v: boolean) => void;
  purposeOptions: Record<string, string>;
  usersOptions: Record<string, string>;
  desktopBlockedPurposes: string[];
  onStart: () => void;
  toast: any;
}

export default function JourneyStartStep(props: JourneyStartStepProps) {
  const {
    clientName, setClientName, clientPhone, setClientPhone, clientEmail, setClientEmail,
    purpose, setPurpose, purposeOther, setPurposeOther,
    intendedUsers, setIntendedUsers, intendedUsersOther, setIntendedUsersOther,
    valuationMode, setValuationMode, desktopDisclaimer, setDesktopDisclaimer,
    purposeOptions, usersOptions, desktopBlockedPurposes, onStart, toast,
  } = props;

  return (
    <Card className="shadow-card mt-4">
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center gap-2">
          <UserIcon className="w-5 h-5 text-primary" />
          بيانات الطلب
        </CardTitle>
        <p className="text-sm text-muted-foreground">أدخل البيانات الأساسية لبدء التقييم</p>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <Label className="text-sm">اسم العميل <span className="text-destructive">*</span></Label>
          <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="الاسم الكامل أو اسم الجهة" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-sm">رقم الجوال <span className="text-destructive">*</span></Label>
            <Input value={clientPhone} onChange={e => setClientPhone(e.target.value)} placeholder="05XXXXXXXX" dir="ltr" />
          </div>
          <div className="space-y-1.5">
            <Label className="text-sm">البريد الإلكتروني</Label>
            <Input value={clientEmail} onChange={e => setClientEmail(e.target.value)} placeholder="example@email.com" dir="ltr" />
          </div>
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">الغرض من التقييم <span className="text-destructive">*</span></Label>
          <Select value={purpose} onValueChange={(val) => { setPurpose(val); if (val !== "other") setPurposeOther(""); if (desktopBlockedPurposes.includes(val) && valuationMode === "desktop") { setValuationMode("field"); setDesktopDisclaimer(false); } }}>
            <SelectTrigger><SelectValue placeholder="اختر الغرض" /></SelectTrigger>
            <SelectContent>
              {Object.entries(purposeOptions).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {purpose === "other" && (
            <Input value={purposeOther} onChange={e => setPurposeOther(e.target.value)} placeholder="حدد الغرض" className="mt-2" />
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-sm">مستخدمو التقرير <span className="text-destructive">*</span></Label>
          <Select value={intendedUsers} onValueChange={(val) => { setIntendedUsers(val); if (val !== "other") setIntendedUsersOther(""); }}>
            <SelectTrigger><SelectValue placeholder="اختر مستخدمي التقرير" /></SelectTrigger>
            <SelectContent>
              {Object.entries(usersOptions).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {intendedUsers === "other" && (
            <Input value={intendedUsersOther} onChange={e => setIntendedUsersOther(e.target.value)} placeholder="حدد المستخدمين" className="mt-2" />
          )}
        </div>

        {/* Valuation Mode */}
        <div className="space-y-3 pt-2">
          <Label className="text-sm font-semibold">نوع التقييم <span className="text-destructive">*</span></Label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => { setValuationMode("field"); setDesktopDisclaimer(false); }}
              className={`relative text-right border-2 rounded-xl p-4 transition-all ${
                valuationMode === "field" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${valuationMode === "field" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Eye className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-foreground">تقييم ميداني</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    يشمل معاينة فعلية للعقار أو الأصل من قبل مقيّم معتمد — مطلوب للتمويل والرهن العقاري
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <Badge variant="outline" className="text-[10px]">الأكثر شمولاً</Badge>
                  </div>
                </div>
              </div>
              {valuationMode === "field" && (
                <div className="absolute top-2 left-2"><CheckCircle className="w-5 h-5 text-primary" /></div>
              )}
            </button>

            <button
              type="button"
              onClick={() => {
                if (desktopBlockedPurposes.includes(purpose)) {
                  toast({ title: "التقييم المكتبي غير متاح لهذا الغرض", description: "التمويل ونزع الملكية يتطلبان تقييماً ميدانياً.", variant: "destructive" });
                  return;
                }
                setValuationMode("desktop");
              }}
              className={`relative text-right border-2 rounded-xl p-4 transition-all ${
                desktopBlockedPurposes.includes(purpose)
                  ? "border-border opacity-50 cursor-not-allowed"
                  : valuationMode === "desktop" ? "border-primary bg-primary/5 shadow-sm" : "border-border hover:border-primary/30"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${valuationMode === "desktop" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                  <Monitor className="w-5 h-5" />
                </div>
                <div className="flex-1">
                  <h4 className="font-bold text-sm text-foreground">تقييم مكتبي</h4>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    بدون معاينة ميدانية — أسرع وأقل تكلفة — معتمد وفق معايير IVS وتقييم
                  </p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <Badge variant="secondary" className="text-[10px] gap-1"><Zap className="w-3 h-3" /> أسرع</Badge>
                    <Badge variant="secondary" className="text-[10px] gap-1"><BadgeCheck className="w-3 h-3" /> معتمد</Badge>
                  </div>
                </div>
              </div>
              {valuationMode === "desktop" && (
                <div className="absolute top-2 left-2"><CheckCircle className="w-5 h-5 text-primary" /></div>
              )}
            </button>
          </div>

          {valuationMode === "desktop" && (
            <div className="bg-accent/50 border border-accent rounded-lg p-3 space-y-3">
              <div className="flex items-start gap-2">
                <Shield className="w-4 h-4 text-primary mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs font-semibold text-foreground">ما هو التقييم المكتبي؟</p>
                  <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                    تقييم احترافي معتمد يتم دون معاينة مادية للأصل، بالاعتماد على المستندات والصور المقدمة.
                    يتوافق مع معايير التقييم الدولية (IVS) ومتطلبات الهيئة السعودية للمقيّمين المعتمدين (تقييم).
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-2 border-t border-border pt-2">
                <input type="checkbox" id="desktop-disclaimer" checked={desktopDisclaimer} onChange={e => setDesktopDisclaimer(e.target.checked)} className="mt-0.5 accent-primary" />
                <label htmlFor="desktop-disclaimer" className="text-xs text-foreground leading-relaxed cursor-pointer">
                  أقر بأن التقييم سيتم <strong>بدون معاينة ميدانية</strong>، وأتحمل مسؤولية دقة المستندات والصور المقدمة، وأوافق على أن التقرير سيتضمن إفصاحاً بذلك.
                </label>
              </div>
            </div>
          )}
        </div>

        <Button onClick={onStart} className="w-full gap-2 mt-2" size="lg">
          <ArrowLeft className="w-4 h-4" />
          ابدأ التقييم
        </Button>
      </CardContent>
    </Card>
  );
}
