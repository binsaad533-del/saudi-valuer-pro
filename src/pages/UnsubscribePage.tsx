import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle, Loader2, MailX } from "lucide-react";

type Status = "loading" | "valid" | "already" | "invalid" | "success" | "error";

export default function UnsubscribePage() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<Status>("loading");
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      return;
    }

    const validate = async () => {
      try {
        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
        const anonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
        const res = await fetch(
          `${supabaseUrl}/functions/v1/handle-email-unsubscribe?token=${token}`,
          { headers: { apikey: anonKey } }
        );
        const data = await res.json();
        if (!res.ok) {
          setStatus("invalid");
        } else if (data.valid === false && data.reason === "already_unsubscribed") {
          setStatus("already");
        } else if (data.valid) {
          setStatus("valid");
        } else {
          setStatus("invalid");
        }
      } catch {
        setStatus("invalid");
      }
    };
    validate();
  }, [token]);

  const handleUnsubscribe = async () => {
    if (!token) return;
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("handle-email-unsubscribe", {
        body: { token },
      });
      if (error) {
        setStatus("error");
      } else if (data?.success) {
        setStatus("success");
      } else if (data?.reason === "already_unsubscribed") {
        setStatus("already");
      } else {
        setStatus("error");
      }
    } catch {
      setStatus("error");
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4" dir="rtl">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-4">
          {status === "loading" && (
            <>
              <Loader2 className="w-12 h-12 mx-auto text-primary animate-spin" />
              <p className="text-muted-foreground">جاري التحقق...</p>
            </>
          )}

          {status === "valid" && (
            <>
              <MailX className="w-12 h-12 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-bold text-foreground">إلغاء الاشتراك</h2>
              <p className="text-muted-foreground">
                هل تريد إلغاء اشتراكك في رسائل البريد الإلكتروني من جساس للتقييم؟
              </p>
              <Button onClick={handleUnsubscribe} disabled={processing} variant="destructive">
                {processing ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                تأكيد إلغاء الاشتراك
              </Button>
            </>
          )}

          {status === "success" && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto text-green-500" />
              <h2 className="text-xl font-bold text-foreground">تم إلغاء الاشتراك</h2>
              <p className="text-muted-foreground">
                تم إلغاء اشتراكك بنجاح. لن تتلقى رسائل بريد إلكتروني منا بعد الآن.
              </p>
            </>
          )}

          {status === "already" && (
            <>
              <CheckCircle className="w-12 h-12 mx-auto text-muted-foreground" />
              <h2 className="text-xl font-bold text-foreground">تم الإلغاء مسبقاً</h2>
              <p className="text-muted-foreground">
                تم إلغاء اشتراكك بالفعل سابقاً.
              </p>
            </>
          )}

          {status === "invalid" && (
            <>
              <XCircle className="w-12 h-12 mx-auto text-destructive" />
              <h2 className="text-xl font-bold text-foreground">رابط غير صالح</h2>
              <p className="text-muted-foreground">
                هذا الرابط غير صالح أو منتهي الصلاحية.
              </p>
            </>
          )}

          {status === "error" && (
            <>
              <XCircle className="w-12 h-12 mx-auto text-destructive" />
              <h2 className="text-xl font-bold text-foreground">حدث خطأ</h2>
              <p className="text-muted-foreground">
                حدث خطأ أثناء معالجة طلبك. يرجى المحاولة مرة أخرى.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
