import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import {
  getRecoveryDebugInfo,
  hasRecoveryParams,
  readRecoveryParamsFromLocation,
  RESET_PASSWORD_PATH,
} from "@/lib/auth-recovery";

type CallbackStatus = "verifying" | "invalid";

const RECOVERY_TIMEOUT_MS = 10000;

export default function RecoveryCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>("verifying");
  const recoveryParams = useMemo(() => readRecoveryParamsFromLocation(), []);
  const recoverySignalsDetected = useMemo(() => hasRecoveryParams(recoveryParams), [recoveryParams]);
  const recoveryEventSeenRef = useRef(false);

  useEffect(() => {
    let isActive = true;

    const timeoutId = window.setTimeout(() => {
      if (!isActive) return;
      console.error("[RecoveryCallback] Recovery verification timed out", {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        ...getRecoveryDebugInfo(recoveryParams),
      });
      setStatus("invalid");
    }, RECOVERY_TIMEOUT_MS);

    const fail = (reason: string, error?: unknown) => {
      if (!isActive) return;
      window.clearTimeout(timeoutId);
      console.error("[RecoveryCallback] Recovery verification failed", {
        reason,
        error,
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        ...getRecoveryDebugInfo(recoveryParams),
      });
      setStatus("invalid");
    };

    const complete = (source: string) => {
      if (!isActive) return;
      window.clearTimeout(timeoutId);
      console.info("[RecoveryCallback] Recovery verified", {
        source,
        href: window.location.href,
      });
      navigate(RESET_PASSWORD_PATH, { replace: true, state: { recoveryVerified: true } });
    };

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.info("[RecoveryCallback] Auth state changed", {
        event,
        hasSession: Boolean(session),
        hasUser: Boolean(session?.user),
        userId: session?.user?.id ?? null,
      });

      if (event === "PASSWORD_RECOVERY") {
        recoveryEventSeenRef.current = true;
      }

      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session?.user) {
        complete(`auth-event:${event}`);
      }
    });

    const run = async () => {
      console.info("[RecoveryCallback] Starting recovery callback flow", {
        href: window.location.href,
        pathname: window.location.pathname,
        search: window.location.search,
        hash: window.location.hash,
        recoveryMode: recoveryParams.type ?? null,
        hasCode: Boolean(recoveryParams.code),
        ...getRecoveryDebugInfo(recoveryParams),
      });

      try {
        const initResult = await supabase.auth.initialize();
        console.info("[RecoveryCallback] initialize result", {
          error: initResult.error?.message ?? null,
        });

        const { data: initialSession, error: initialSessionError } = await supabase.auth.getSession();
        console.info("[RecoveryCallback] Session before explicit exchange", {
          hasSession: Boolean(initialSession.session),
          hasUser: Boolean(initialSession.session?.user),
          userId: initialSession.session?.user?.id ?? null,
          error: initialSessionError?.message ?? null,
        });

        if (initialSessionError) {
          throw initialSessionError;
        }

        if (initialSession.session?.user && (recoverySignalsDetected || recoveryEventSeenRef.current)) {
          complete("existing-session");
          return;
        }

        if (recoveryParams.code) {
          const { data, error } = await supabase.auth.exchangeCodeForSession(recoveryParams.code);
          console.info("[RecoveryCallback] exchangeCodeForSession result", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });
          if (error) throw error;
        } else if (recoveryParams.accessToken && recoveryParams.refreshToken) {
          const { data, error } = await supabase.auth.setSession({
            access_token: recoveryParams.accessToken,
            refresh_token: recoveryParams.refreshToken,
          });
          console.info("[RecoveryCallback] setSession result", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.session?.user),
            error: error?.message ?? null,
          });
          if (error) throw error;
        } else if (recoveryParams.tokenHash) {
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: recoveryParams.tokenHash,
            type: "recovery",
          });
          console.info("[RecoveryCallback] verifyOtp(token_hash) result", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });
          if (error) throw error;
        } else if (recoveryParams.token && recoveryParams.email) {
          const { data, error } = await supabase.auth.verifyOtp({
            email: recoveryParams.email,
            token: recoveryParams.token,
            type: "recovery",
          });
          console.info("[RecoveryCallback] verifyOtp(token) result", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });
          if (error) throw error;
        } else if (!recoverySignalsDetected) {
          throw new Error("No supported recovery parameters detected");
        }

        const { data: finalSession, error: finalSessionError } = await supabase.auth.getSession();
        console.info("[RecoveryCallback] Session after exchange", {
          hasSession: Boolean(finalSession.session),
          hasUser: Boolean(finalSession.session?.user),
          userId: finalSession.session?.user?.id ?? null,
          error: finalSessionError?.message ?? null,
        });

        if (finalSessionError) {
          throw finalSessionError;
        }

        if (!finalSession.session?.user) {
          throw new Error(
            recoveryParams.errorDescription || recoveryParams.error || "No recovery session was created",
          );
        }

        complete("session-established");
      } catch (error) {
        fail("supabase-recovery-error", error);
      }
    };

    void run();

    return () => {
      isActive = false;
      window.clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [navigate, recoveryParams, recoverySignalsDetected]);

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