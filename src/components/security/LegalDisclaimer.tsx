/**
 * Legal Disclaimer Dialog
 * Shows before viewing/downloading sensitive content.
 */
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Shield } from "lucide-react";

interface LegalDisclaimerProps {
  open: boolean;
  onAccept: () => void;
  onCancel: () => void;
  actionType: "view" | "download";
}

export default function LegalDisclaimer({ open, onAccept, onCancel, actionType }: LegalDisclaimerProps) {
  return (
    <AlertDialog open={open} onOpenChange={(o) => !o && onCancel()}>
      <AlertDialogContent dir="rtl" className="max-w-lg">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2 text-destructive">
            <Shield className="w-5 h-5" />
            تحذير قانوني — محتوى سري ومحمي
          </AlertDialogTitle>
          <AlertDialogDescription className="text-right space-y-3 text-sm leading-relaxed">
            <p>
              هذا المحتوى سري وخاضع لحقوق الملكية الفكرية لشركة جساس للتقييم.
              أي نسخ أو توزيع أو مشاركة غير مصرح بها يعرّض المخالف للمساءلة القانونية.
            </p>
            <p className="font-medium">
              {actionType === "download"
                ? "بالضغط على \"موافق\" فإنك تقر بأنك المستلم المخول الوحيد لهذا الملف، وأن أي تسريب سيتم تتبعه."
                : "بالضغط على \"موافق\" فإنك تقر بالتزامك بعدم نسخ أو تصوير أو مشاركة المحتوى المعروض."}
            </p>
            <p className="text-xs text-muted-foreground">
              جميع العمليات مسجلة ومراقبة — All actions are logged and monitored
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-row-reverse gap-2">
          <AlertDialogAction onClick={onAccept}>
            موافق — أتعهد بالالتزام
          </AlertDialogAction>
          <AlertDialogCancel onClick={onCancel}>
            إلغاء
          </AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
