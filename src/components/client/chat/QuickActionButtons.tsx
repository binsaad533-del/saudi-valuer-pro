import { Button } from "@/components/ui/button";
import {
  FileText, Upload, HelpCircle, Clock, CreditCard,
  MessageSquare, ClipboardCheck, BarChart3,
} from "lucide-react";

interface QuickAction {
  label: string;
  icon: React.ReactNode;
  message: string;
}

const STATUS_ACTIONS: Record<string, QuickAction[]> = {
  submitted: [
    { label: "حالة الطلب", icon: <Clock className="w-3.5 h-3.5" />, message: "ما هي حالة طلبي الحالية؟" },
    { label: "المدة المتوقعة", icon: <BarChart3 className="w-3.5 h-3.5" />, message: "كم المدة المتوقعة لإنجاز التقييم؟" },
    { label: "المستندات المطلوبة", icon: <FileText className="w-3.5 h-3.5" />, message: "ما هي المستندات المطلوبة مني؟" },
  ],
  scope_generated: [
    { label: "شرح النطاق", icon: <ClipboardCheck className="w-3.5 h-3.5" />, message: "اشرح لي نطاق العمل بالتفصيل" },
    { label: "تفاصيل السعر", icon: <CreditCard className="w-3.5 h-3.5" />, message: "ما تفاصيل عرض السعر والدفعات؟" },
    { label: "استفسار", icon: <HelpCircle className="w-3.5 h-3.5" />, message: "لدي استفسار حول نطاق العمل" },
  ],
  scope_approved: [
    { label: "طريقة الدفع", icon: <CreditCard className="w-3.5 h-3.5" />, message: "كيف أدفع الدفعة الأولى؟" },
    { label: "حالة الطلب", icon: <Clock className="w-3.5 h-3.5" />, message: "ما هي حالة طلبي الحالية؟" },
  ],
  first_payment_confirmed: [
    { label: "الخطوة التالية", icon: <BarChart3 className="w-3.5 h-3.5" />, message: "ما هي الخطوة التالية بعد الدفع؟" },
    { label: "المدة المتوقعة", icon: <Clock className="w-3.5 h-3.5" />, message: "كم المدة المتبقية لإنجاز التقييم؟" },
  ],
  data_collection_open: [
    { label: "رفع مستندات", icon: <Upload className="w-3.5 h-3.5" />, message: "أريد رفع مستندات إضافية" },
    { label: "المستندات المطلوبة", icon: <FileText className="w-3.5 h-3.5" />, message: "ما هي المستندات المتبقية المطلوبة؟" },
    { label: "استفسار", icon: <HelpCircle className="w-3.5 h-3.5" />, message: "لدي سؤال حول البيانات المطلوبة" },
  ],
  inspection_pending: [
    { label: "موعد المعاينة", icon: <Clock className="w-3.5 h-3.5" />, message: "متى موعد المعاينة؟" },
    { label: "تحضيرات المعاينة", icon: <ClipboardCheck className="w-3.5 h-3.5" />, message: "ماذا أحتاج أن أحضر للمعاينة؟" },
  ],
  inspection_completed: [
    { label: "نتائج المعاينة", icon: <BarChart3 className="w-3.5 h-3.5" />, message: "ما نتائج المعاينة الميدانية؟" },
    { label: "المدة المتبقية", icon: <Clock className="w-3.5 h-3.5" />, message: "كم المدة المتبقية لإصدار التقرير؟" },
  ],
  draft_report_ready: [
    { label: "ملخص التقرير", icon: <FileText className="w-3.5 h-3.5" />, message: "أعطني ملخص المسودة" },
    { label: "إرسال ملاحظات", icon: <MessageSquare className="w-3.5 h-3.5" />, message: "لدي ملاحظات على المسودة" },
  ],
  client_review: [
    { label: "إرسال ملاحظات", icon: <MessageSquare className="w-3.5 h-3.5" />, message: "لدي ملاحظات على المسودة" },
    { label: "اعتماد المسودة", icon: <ClipboardCheck className="w-3.5 h-3.5" />, message: "أريد اعتماد المسودة والموافقة عليها" },
  ],
  draft_approved: [
    { label: "طريقة الدفع", icon: <CreditCard className="w-3.5 h-3.5" />, message: "كيف أدفع الدفعة النهائية؟" },
    { label: "الخطوة التالية", icon: <BarChart3 className="w-3.5 h-3.5" />, message: "ما الخطوة التالية بعد اعتماد المسودة؟" },
  ],
  issued: [
    { label: "تحميل التقرير", icon: <FileText className="w-3.5 h-3.5" />, message: "أريد تحميل التقرير النهائي" },
    { label: "التحقق من التقرير", icon: <ClipboardCheck className="w-3.5 h-3.5" />, message: "كيف يمكنني التحقق من صحة التقرير؟" },
    { label: "طلب جديد", icon: <HelpCircle className="w-3.5 h-3.5" />, message: "أريد تقديم طلب تقييم جديد" },
  ],
};

// Default actions for any status not explicitly mapped
const DEFAULT_ACTIONS: QuickAction[] = [
  { label: "حالة الطلب", icon: <Clock className="w-3.5 h-3.5" />, message: "ما هي حالة طلبي الحالية؟" },
  { label: "استفسار", icon: <HelpCircle className="w-3.5 h-3.5" />, message: "لدي استفسار عام" },
];

interface QuickActionButtonsProps {
  status: string;
  onAction: (message: string) => void;
  disabled?: boolean;
}

export default function QuickActionButtons({ status, onAction, disabled }: QuickActionButtonsProps) {
  const actions = STATUS_ACTIONS[status] || DEFAULT_ACTIONS;

  return (
    <div className="flex flex-wrap gap-1.5 px-1">
      {actions.map((action, i) => (
        <Button
          key={i}
          variant="outline"
          size="sm"
          className="text-[11px] h-7 px-2.5 gap-1.5 rounded-full border-primary/20 text-primary hover:bg-primary/5 hover:border-primary/40 transition-all"
          onClick={() => onAction(action.message)}
          disabled={disabled}
        >
          {action.icon}
          {action.label}
        </Button>
      ))}
    </div>
  );
}
