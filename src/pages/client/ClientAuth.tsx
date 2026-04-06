import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Phone, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";
import AppFooter from "@/components/layout/AppFooter";

export default function ClientAuth() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading, getRedirectPath } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);
  const [phone, setPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(getRedirectPath(role), { replace: true });
    }
  }, [authLoading, user, role, navigate, getRedirectPath]);

  const handleLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const raw = phone.trim().replace(/^0+/, "").replace(/\D/g, "");
      if (raw.length < 8) {
        toast({ title: "أدخل رقم جوال صحيح", variant: "destructive" });
        return;
      }
      setLoading(true);
      try {
        // 1. Call edge function to ensure user exists & get credentials
        const { data, error } = await supabase.functions.invoke("demo-auth", {
          body: { phone: raw, client_name: clientName.trim() || undefined },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.valid && data?.email && data?.password) {
          setRedirecting(true);

          // 2. Sign in directly with password — no OTP, no magic link
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });
          if (signInError) throw signInError;

          const msg = data.is_new_account
            ? "تم إنشاء حسابك بنجاح"
            : "تم تسجيل الدخول";
          toast({ title: msg });
          navigate("/client/dashboard", { replace: true });
        }
      } catch (err: unknown) {
        setRedirecting(false);
        const message =
          err instanceof Error ? err.message : "حدث خطأ، حاول مرة أخرى";
        toast({
          title: "تعذر الدخول",
          description: message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    },
    [phone, clientName, toast, navigate],
  );

  if (redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-foreground font-medium">جاري تسجيل الدخول...</p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="min-h-screen bg-background flex flex-col items-center justify-center p-4"
      dir="rtl"
    >
      <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
        {/* Logo */}
        <div className="text-center mb-8">
          <img
            src={logo}
            alt="جساس"
            className="w-28 h-auto mx-auto mb-4 object-contain"
          />
          <h1 className="text-xl font-extralight text-foreground">
            جساس للتقييم .. نصنع للأصل قيمة
          </h1>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="text-center mb-2">
              <h2 className="text-lg font-semibold text-foreground">
                الدخول أو التسجيل
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                أدخل رقم جوالك وسيتم تسجيل دخولك فوراً
              </p>
            </div>

            {/* Phone input — fixed +966 */}
            <div className="space-y-2">
              <Label htmlFor="phone">رقم الجوال</Label>
              <div className="relative flex items-center gap-2">
                <span
                  className="shrink-0 text-sm text-muted-foreground font-medium min-w-[3.5rem] text-center"
                  dir="ltr"
                >
                  +966
                </span>
                <div className="relative flex-1">
                  <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    type="tel"
                    placeholder="5XXXXXXXX"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pr-10"
                    required
                    dir="ltr"
                    autoFocus
                  />
                </div>
              </div>
            </div>

            {/* Optional name */}
            <div className="space-y-2">
              <Label htmlFor="client-name">
                الاسم{" "}
                <span className="text-muted-foreground text-xs">(اختياري)</span>
              </Label>
              <Input
                id="client-name"
                placeholder="اسمك الكامل"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
              />
            </div>

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : null}
              دخول
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} جساس للتقييم - جميع الحقوق محفوظة
        </p>
      </div>
      <AppFooter />
    </div>
  );
}
