import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Pencil } from "lucide-react";
import { requestPostPaymentEdit } from "@/lib/workflow-engine";
import { toast } from "sonner";

interface ClientEditRequestButtonProps {
  assignmentId: string;
  currentStatus: string;
}

const EDITABLE_STATUSES = [
  "data_collection_open", "data_collection_complete",
  "inspection_pending", "inspection_completed",
  "data_validated", "analysis_complete", "professional_review",
];

export function ClientEditRequestButton({ assignmentId, currentStatus }: ClientEditRequestButtonProps) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [loading, setLoading] = useState(false);

  if (!EDITABLE_STATUSES.includes(currentStatus)) return null;

  const handleSubmit = async () => {
    setLoading(true);
    const result = await requestPostPaymentEdit(assignmentId, reason);
    if (result.success) {
      toast.success("تم إرسال طلب التعديل للمالك");
      setOpen(false);
      setReason("");
    } else {
      toast.error(result.error || "حدث خطأ");
    }
    setLoading(false);
  };

  return (
    <>
      <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={() => setOpen(true)}>
        <Pencil className="w-3.5 h-3.5" />
        طلب تعديل بيانات
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>طلب تعديل بيانات بعد الدفع</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            سيتم إرسال طلبك للمالك للمراجعة. يرجى توضيح البيانات المطلوب تعديلها بالتفصيل.
          </p>
          <Textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="مثال: أريد تعديل عنوان العقار أو تحديث المساحة..."
            rows={4}
            dir="rtl"
          />
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setOpen(false)}>إلغاء</Button>
            <Button onClick={handleSubmit} disabled={loading || reason.trim().length < 10}>
              {loading ? "جاري الإرسال..." : "إرسال الطلب"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
