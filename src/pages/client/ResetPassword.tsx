import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import { PasswordStrengthMessage } from "@/components/ui/password-strength-message";

type RecoveryStatus = "verifying" | "ready" | "invalid";

const RECOVERY_TIMEOUT_MS = 10000;

const readRecoveryParams = () => {
  const searchParams = new URLSearchParams(window.location.search);
  const hashValue = window.location.hash.startsWith("#") ? window.location.hash.slice(1) : window.location.hash;
  const hashParams = new URLSearchParams(hashValue.startsWith("?") ? hashValue.slice(1) : hashValue);

  const getParam = (key: string) => searchParams.get(key) ?? hashParams.get(key) ?? undefined;

  return {
    accessToken: getParam("access_token"),
    refreshToken: getParam("refresh_token"),
    token: getParam("token"),
    tokenHash: getParam("token_hash"),
    type: getParam("type"),
    code: getParam("code"),
    redirect: getParam("redirect") ?? getParam("redirect_to") ?? getParam("redirectTo"),
    email: getParam("email"),
    error: getParam("error"),
    errorCode: getParam("error_code"),
    errorDescription: getParam("error_description"),
  };
};

const clearRecoveryParamsFromUrl = () => {
  window.history.replaceState({}, document.title, window.location.pathname);
};

const hasRecoverySignals = (params: ReturnType<typeof readRecoveryParams>) => Boolean(
  params.type === "recovery" ||
  params.accessToken ||
  params.refreshToken ||
  params.token ||
  params.tokenHash ||
  params.code,
);

const getRecoveryDebugInfo = (params: ReturnType<typeof readRecoveryParams>) => ({
  hasAccessToken: Boolean(params.accessToken),
  hasRefreshToken: Boolean(params.refreshToken),
  hasToken: Boolean(params.token),
  hasTokenHash: Boolean(params.tokenHash),
  hasCode: Boolean(params.code),
  hasEmail: Boolean(params.email),
  type: params.type ?? null,
  hasRedirect: Boolean(params.redirect),
  error: params.error ?? null,
  errorCode: params.errorCode ?? null,
  errorDescription: params.errorDescription ?? null,
});

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [status, setStatus] = useState<RecoveryStatus>("verifying");
  const recoveryParams = useMemo(() => readRecoveryParams(), []);
  const recoveryEventSeenRef = useRef(false);
  const recoverySignalsDetected = useMemo(() => hasRecoverySignals(recoveryParams), [recoveryParams]);

  useEffect(() => {
    let isActive = true;
    const timeoutId = window.setTimeout(() => {
      if (!isActive) return;
      console.error("[ResetPassword] Recovery verification timed out", {
        ...getRecoveryDebugInfo(recoveryParams),
        href: window.location.href,
      });
      setStatus((current) => (current === "verifying" ? "invalid" : current));
    }, RECOVERY_TIMEOUT_MS);

    const finalizeStatus = (nextStatus: RecoveryStatus) => {
      if (!isActive) return;
      window.clearTimeout(timeoutId);
      setStatus(nextStatus);
    };

    const markReady = (source: string) => {
      console.info("[ResetPassword] Recovery verified", { source });
      clearRecoveryParamsFromUrl();
      finalizeStatus("ready");
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("[ResetPassword] Auth state changed", {
        event,
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
        userId: session?.user?.id ?? null,
      });

      if (event === "PASSWORD_RECOVERY") {
        recoveryEventSeenRef.current = true;
      }

      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session?.user) {
        if (recoveryEventSeenRef.current || recoverySignalsDetected || window.location.pathname === "/reset-password") {
          markReady(`auth-event:${event}`);
        }
      }
    });

    const initializeRecovery = async () => {
      const debugInfo = getRecoveryDebugInfo(recoveryParams);

      console.info("[ResetPassword] Initializing recovery flow", {
        ...debugInfo,
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
      });

      if (recoveryParams.error || recoveryParams.errorCode || recoveryParams.errorDescription) {
        console.error("[ResetPassword] Recovery URL contains auth error", debugInfo);
        finalizeStatus("invalid");
        return;
      }

      try {
        const initResult = await supabase.auth.initialize();

        console.info("[ResetPassword] Auth initialize result", {
          error: initResult.error?.message ?? null,
        });

        if (initResult.error) {
          console.error("[ResetPassword] Auth initialize returned error", initResult.error);
        }

        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();

        console.info("[ResetPassword] Session after initialize", {
          hasSession: Boolean(sessionData.session),
          hasUser: Boolean(sessionData.session?.user),
          userId: sessionData.session?.user?.id ?? null,
        });

        if (sessionError) {
          console.error("[ResetPassword] Failed to read current session", sessionError);
        }

        if (sessionData.session?.user && (window.location.pathname === "/reset-password" || recoverySignalsDetected || recoveryEventSeenRef.current)) {
          markReady("existing-session");
          return;
        }

        if (recoveryParams.accessToken && recoveryParams.refreshToken) {
          console.info("[ResetPassword] Attempting setSession from URL tokens");
          const { data, error } = await supabase.auth.setSession({
            access_token: recoveryParams.accessToken,
            refresh_token: recoveryParams.refreshToken,
          });

          console.info("[ResetPassword] setSession result", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.session?.user),
            error: error?.message ?? null,
          });

          if (error) throw error;

          markReady("set-session");
          return;
        }

        if (recoveryParams.code) {
          console.info("[ResetPassword] Attempting exchangeCodeForSession", { hasCode: true });
          const { data, error } = await supabase.auth.exchangeCodeForSession(recoveryParams.code);

          console.info("[ResetPassword] exchangeCodeForSession result", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });

          if (error) throw error;

          markReady("exchange-code");
          return;
        }

        if (recoveryParams.tokenHash && (recoveryParams.type === "recovery" || !recoveryParams.type)) {
          console.info("[ResetPassword] Attempting verifyOtp with token_hash", {
            type: recoveryParams.type ?? "recovery",
          });
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: recoveryParams.tokenHash,
            type: "recovery",
          });

          console.info("[ResetPassword] verifyOtp(token_hash) result", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });

          if (error) throw error;

          markReady("verify-token-hash");
          return;
        }

        if (recoveryParams.token && recoveryParams.email && (recoveryParams.type === "recovery" || !recoveryParams.type)) {
          console.info("[ResetPassword] Attempting verifyOtp with email token", {
            hasEmail: true,
            type: recoveryParams.type ?? "recovery",
          });
          const { data, error } = await supabase.auth.verifyOtp({
            email: recoveryParams.email,
            token: recoveryParams.token,
            type: "recovery",
          });

          console.info("[ResetPassword] verifyOtp(token) result", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });

          if (error) throw error;

          markReady("verify-token");
          return;
        }

        const { data: finalSessionData, error: finalSessionError } = await supabase.auth.getSession();

        console.info("[ResetPassword] Final session result", {
          hasSession: Boolean(finalSessionData.session),
          hasUser: Boolean(finalSessionData.session?.user),
          userId: finalSessionData.session?.user?.id ?? null,
        });

        if (finalSessionError) {
          console.error("[ResetPassword] Failed to read final session", finalSessionError);
        }

        if (finalSessionData.session?.user && window.location.pathname === "/reset-password") {
          markReady("final-session-check");
          return;
        }

        if (recoveryParams.token && !recoveryParams.email) {
          console.error("[ResetPassword] Token detected without email parameter", debugInfo);
        }

        console.error("[ResetPassword] Missing or unsupported recovery parameters", debugInfo);
        finalizeStatus("invalid");
      } catch (error) {
        console.error("[ResetPassword] Recovery link verification failed", {
          ...debugInfo,
          error,
        });
        finalizeStatus("invalid");
      }
    };

    void initializeRecovery();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [recoveryParams, recoverySignalsDetected]);

  useEffect(() => {
    if (!done) return;

    const redirectTimer = window.setTimeout(() => {
      navigate("/login", { replace: true });
    }, 1500);

    return () => window.clearTimeout(redirectTimer);
  }, [done, navigate]);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({ title: "كلمات المرور غير متطابقة", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      console.error("[ResetPassword] Password update failed", err);
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم تغيير كلمة المرور</h2>
            <p className="text-muted-foreground text-sm mb-6">تم تحديث كلمة المرور بنجاح، وسيتم تحويلك الآن.</p>
            <Button onClick={() => navigate("/login")} className="w-full">
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (status === "verifying") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">جاري التحقق من الرابط...</p>
          </div>
        </div>
      </div>
    );
  }

  if (status === "invalid") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <AlertCircle className="w-16 h-16 text-destructive mx-auto mb-4" />
            <h1 className="text-xl font-bold text-foreground mb-3">تعذر التحقق من رابط الاستعادة</h1>
            <p className="text-muted-foreground text-sm leading-7 mb-6">
              الرابط غير صالح أو منتهي الصلاحية، يرجى طلب رابط جديد
            </p>
            <div className="space-y-3">
              <Button className="w-full" onClick={() => navigate("/client/forgot-password", { replace: true })}>
                طلب رابط جديد
              </Button>
              <Button variant="ghost" className="w-full" onClick={() => navigate("/login", { replace: true })}>
                العودة لتسجيل الدخول
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="جساس" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">إعادة تعيين كلمة المرور</h1>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="new-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" required dir="ltr" minLength={6} />
              </div>
              <PasswordStrengthMessage password={password} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">تأكيد كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="confirm-new-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pr-10" required dir="ltr" minLength={6} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              تغيير كلمة المرور
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
