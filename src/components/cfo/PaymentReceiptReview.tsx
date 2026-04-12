import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { autoAdvanceAfterPayment } from "@/lib/workflow-engine";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import {
  CheckCircle2, XCircle, FileImage, Loader2, AlertTriangle,
  Clock, ExternalLink,
} from "lucide-react";
import { formatNumber } from "@/lib/utils";
import { SAR } from "@/components/ui/saudi-riyal";

interface PendingReceipt {
  id: string;
  amount: number;
  payment_type: string | null;
  status: string | null;
  created_at: string;
  file_path: string;
  file_name: string;
  request_id: string;
  reference_number: string | null;
  assignment_id: string | null;
  client_name: string | null;
}

const typeLabels: Record<string, string> = {
  first:  "الدفعة الأولى — 50%",
  final:  "الدفعة النهائية — 50%",
  second: "الدفعة النهائية — 50%",
};

function paymentStageFromType(type: string | null): "first" | "final" {
  return (type === "first") ? "first" : "final";
}

export default function PaymentReceiptReview() {
  const [receipts, setReceipts] = useState<PendingReceipt[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("payment_receipts" as any)
      .select(`
        id, amount, payment_type, status, created_at, file_path, file_name, request_id,
        valuation_requests(reference_number, assignment_id, client_id, clients(name_ar))
      `)
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (!error && data) {
      setReceipts((data as any[]).map(r => ({
        id:               r.id,
        amount:           r.amount,
        payment_type:     r.payment_type,
        status:           r.status,
        created_at:       r.created_at,
        file_path:        r.file_path,
        file_name:        r.file_name,
        request_id:       r.request_id,
        reference_number: r.valuation_requests?.reference_number || null,
        assignment_id:    r.valuation_requests?.assignment_id || null,
        client_name:      r.valuation_requests?.clients?.name_ar || null,
      })));
    }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const getReceiptUrl = (filePath: string) => {
    const { data } = supabase.storage.from("client-uploads").getPublicUrl(filePath);
    return data.publicUrl;
  };

  const handleApprove = async (receipt: PendingReceipt) => {
    setProcessing(prev => ({ ...prev, [receipt.id]: true }));
    try {
      const { error } = await supabase
        .from("payment_receipts" as any)
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", receipt.id);

      if (error) { toast.error("فشل تحديث حالة الإيصال"); return; }

      if (receipt.assignment_id) {
        const stage = paymentStageFromType(receipt.payment_type);
        const result = await autoAdvanceAfterPayment(receipt.assignment_id, stage);
        if (!result.success) {
          toast.warning(`تم تأكيد الإيصال لكن فشل تحريك الطلب: ${result.error || ""}`);
        } else {
          toast.success("تم تأكيد الإيصال وتحريك الطلب بنجاح");
        }
      } else {
        toast.success("تم تأكيد الإيصال — لا يوجد تكليف مرتبط للتحريك");
      }

      setReceipts(prev => prev.filter(r => r.id !== receipt.id));
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setProcessing(prev => ({ ...prev, [receipt.id]: false }));
    }
  };

  const handleReject = async (receipt: PendingReceipt) => {
    setProcessing(prev => ({ ...prev, [receipt.id]: true }));
    try {
      const { error } = await supabase
        .from("payment_receipts" as any)
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", receipt.id);

      if (error) { toast.error("فشل رفض الإيصال"); return; }
      toast.success("تم رفض الإيصال");
      setReceipts(prev => prev.filter(r => r.id !== receipt.id));
    } catch (err: any) {
      toast.error(err.message || "حدث خطأ");
    } finally {
      setProcessing(prev => ({ ...prev, [receipt.id]: false }));
    }
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Clock className="w-4 h-4 text-warning" />
          إيصالات الدفع بانتظار المراجعة
          {!loading && receipts.length > 0 && (
            <Badge className="bg-destructive/10 text-destructive border-0 mr-auto">
              {receipts.length} إيصال
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : receipts.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-10 text-center gap-2">
            <CheckCircle2 className="w-10 h-10 text-success/50" />
            <p className="text-sm text-muted-foreground">لا توجد إيصالات بانتظار المراجعة</p>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-50 border border-amber-200 dark:bg-amber-950/20 dark:border-amber-800 text-sm text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>تأكيد الإيصال يُحرّك الطلب تلقائياً للمرحلة التالية في دورة الحياة</span>
            </div>

            {receipts.map(receipt => (
              <div key={receipt.id}
                className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-lg border border-border bg-muted/20">
                {/* Info */}
                <div className="flex-1 space-y-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-sm font-medium">{receipt.reference_number || receipt.id.slice(0, 8)}</span>
                    <Badge variant="outline" className="text-[10px]">
                      {typeLabels[receipt.payment_type || ""] || (receipt.payment_type || "دفعة")}
                    </Badge>
                  </div>
                  {receipt.client_name && (
                    <p className="text-sm text-muted-foreground">{receipt.client_name}</p>
                  )}
                  <p className="text-lg font-bold text-foreground">
                    {formatNumber(receipt.amount)} <SAR />
                  </p>
                  <p className="text-xs text-muted-foreground">
                    رُفع: {receipt.created_at.slice(0, 10)}
                  </p>
                </div>

                {/* Receipt link */}
                <div className="shrink-0">
                  <a
                    href={getReceiptUrl(receipt.file_path)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 text-xs text-primary underline-offset-2 hover:underline"
                  >
                    <FileImage className="w-4 h-4" />
                    {receipt.file_name || "عرض الإيصال"}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>

                {/* Actions */}
                <div className="flex gap-2 shrink-0">
                  <Button
                    size="sm"
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5"
                    onClick={() => handleApprove(receipt)}
                    disabled={!!processing[receipt.id]}
                  >
                    {processing[receipt.id]
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <CheckCircle2 className="w-4 h-4" />
                    }
                    تأكيد
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="gap-1.5"
                    onClick={() => handleReject(receipt)}
                    disabled={!!processing[receipt.id]}
                  >
                    {processing[receipt.id]
                      ? <Loader2 className="w-4 h-4 animate-spin" />
                      : <XCircle className="w-4 h-4" />
                    }
                    رفض
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
