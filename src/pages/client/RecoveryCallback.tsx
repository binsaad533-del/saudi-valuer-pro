import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertCircle, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { RESET_PASSWORD_PATH } from "@/lib/auth-recovery";

type CallbackStatus = "verifying" | "invalid";

/**
 * /auth/recovery — Supabase password-recovery callback.
 *
 * When the user clicks the reset link in the email, Supabase's server
 * verifies the token and redirects here with either:
 *   • hash tokens:  #access_token=…&refresh_token=…&type=recovery
 *   • PKCE code:    ?code=…
 *
 * The Supabase JS client automatically detects these URL fragments
 * during the global AuthProvider's first `getSession()` call —
 * BEFORE this component even mounts.  By the time we render, the
 * tokens may already be consumed and the hash cleared.
 *
 * Strategy:
 *   1. Capture the raw URL immediately for logging (before anything runs).
 *   2. Listen for PASSWORD_RECOVERY / SIGNED_IN auth events (fastest path).
 *   3. Poll getSession() a few times to catch the session that the
 *      AuthProvider's auto-detection may have already created.
 *   4. If we still find params in the URL that weren't auto-consumed,
 *      attempt explicit exchange (exchangeCodeForSession / setSession / verifyOtp).
 *   5. Only show an error after ALL strategies have been exhausted.
 */

// Snapshot the URL immediately at module evaluation time,
// before React or Supabase can strip hash fragments.
const INITIAL_HREF = window.location.href;
const INITIAL_SEARCH = window.location.search;
const INITIAL_HASH = window.location.hash;

function extractParams(search: string, hash: string) {
  const searchParams = new URLSearchParams(search);
  const rawHash = hash.startsWith("#") ? hash.slice(1) : hash;
  const hashParams = new URLSearchParams(
    rawHash.startsWith("?") ? rawHash.slice(1) : rawHash,
  );
  const get = (key: string) => searchParams.get(key) ?? hashParams.get(key) ?? undefined;
  return {
    accessToken: get("access_token"),
    refreshToken: get("refresh_token"),
    tokenHash: get("token_hash"),
    token: get("token"),
    code: get("code"),
    type: get("type"),
    email: get("email"),
    error: get("error"),
    errorDescription: get("error_description"),
    searchRaw: search,
    hashRaw: hash,
  };
}

const PARAMS = extractParams(INITIAL_SEARCH, INITIAL_HASH);

const SESSION_POLL_INTERVAL = 500;
const SESSION_POLL_MAX_ATTEMPTS = 16; // 8 seconds total
const HARD_TIMEOUT_MS = 12000;

export default function RecoveryCallback() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<CallbackStatus>("verifying");
  const completedRef = useRef(false);

  useEffect(() => {
    // ─── 0. Immediate logging ───────────────────────────────
    console.log("=== [RecoveryCallback] PAGE LOADED ===");
    console.log("[RecoveryCallback] FULL URL:", INITIAL_HREF);
    console.log("[RecoveryCallback] SEARCH:", INITIAL_SEARCH);
    console.log("[RecoveryCallback] HASH:", INITIAL_HASH);
    console.log("[RecoveryCallback] Extracted params:", {
      hasCode: Boolean(PARAMS.code),
      hasAccessToken: Boolean(PARAMS.accessToken),
      hasRefreshToken: Boolean(PARAMS.refreshToken),
      hasTokenHash: Boolean(PARAMS.tokenHash),
      hasToken: Boolean(PARAMS.token),
      hasEmail: Boolean(PARAMS.email),
      type: PARAMS.type ?? null,
      error: PARAMS.error ?? null,
      errorDescription: PARAMS.errorDescription ?? null,
    });
    console.log("[RecoveryCallback] Current URL (may differ if hash was consumed):", window.location.href);

    let isActive = true;

    const done = (source: string) => {
      if (!isActive || completedRef.current) return;
      completedRef.current = true;
      console.info("[RecoveryCallback] ✅ Recovery verified →", source);
      navigate(RESET_PASSWORD_PATH, { replace: true, state: { recoveryVerified: true } });
    };

    const fail = (reason: string, error?: unknown) => {
      if (!isActive || completedRef.current) return;
      completedRef.current = true;
      console.error("[RecoveryCallback] ❌ Recovery failed →", reason, error);
      setStatus("invalid");
    };

    // ─── 1. Auth state listener (catches auto-detected tokens) ──
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log("[RecoveryCallback] onAuthStateChange →", event, {
        hasSession: Boolean(session),
        userId: session?.user?.id ?? null,
      });
      if ((event === "PASSWORD_RECOVERY" || event === "SIGNED_IN") && session?.user) {
        done(`auth-event:${event}`);
      }
    });

    // ─── 2. Hard timeout ────────────────────────────────────
    const hardTimeout = window.setTimeout(() => {
      fail("hard-timeout (12s)");
    }, HARD_TIMEOUT_MS);

    // ─── 3. Main verification flow ──────────────────────────
    const run = async () => {
      // If the URL had an explicit error from Supabase, fail immediately
      if (PARAMS.error) {
        fail("url-contains-error", PARAMS.errorDescription ?? PARAMS.error);
        return;
      }

      // STRATEGY A: Check if session already exists (auto-detected by AuthProvider)
      const { data: s1 } = await supabase.auth.getSession();
      console.log("[RecoveryCallback] Strategy A — existing session:", {
        hasSession: Boolean(s1.session),
        userId: s1.session?.user?.id ?? null,
      });
      if (s1.session?.user) {
        done("existing-session");
        return;
      }

      // STRATEGY B: Explicit token exchange using captured params
      let exchangeAttempted = false;

      try {
        if (PARAMS.code) {
          exchangeAttempted = true;
          console.log("[RecoveryCallback] Strategy B — exchangeCodeForSession");
          const { data, error } = await supabase.auth.exchangeCodeForSession(PARAMS.code);
          console.log("[RecoveryCallback] exchangeCodeForSession result:", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });
          if (!error && data.session?.user) {
            done("exchangeCodeForSession");
            return;
          }
          if (error) console.warn("[RecoveryCallback] exchangeCodeForSession error:", error.message);
        }

        if (PARAMS.accessToken && PARAMS.refreshToken) {
          exchangeAttempted = true;
          console.log("[RecoveryCallback] Strategy B — setSession");
          const { data, error } = await supabase.auth.setSession({
            access_token: PARAMS.accessToken,
            refresh_token: PARAMS.refreshToken,
          });
          console.log("[RecoveryCallback] setSession result:", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.session?.user),
            error: error?.message ?? null,
          });
          if (!error && data.session?.user) {
            done("setSession");
            return;
          }
          if (error) console.warn("[RecoveryCallback] setSession error:", error.message);
        }

        if (PARAMS.tokenHash) {
          exchangeAttempted = true;
          console.log("[RecoveryCallback] Strategy B — verifyOtp(token_hash)");
          const { data, error } = await supabase.auth.verifyOtp({
            token_hash: PARAMS.tokenHash,
            type: "recovery",
          });
          console.log("[RecoveryCallback] verifyOtp(token_hash) result:", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });
          if (!error && data.session) {
            done("verifyOtp-token_hash");
            return;
          }
          if (error) console.warn("[RecoveryCallback] verifyOtp(token_hash) error:", error.message);
        }

        if (PARAMS.token && PARAMS.email) {
          exchangeAttempted = true;
          console.log("[RecoveryCallback] Strategy B — verifyOtp(token+email)");
          const { data, error } = await supabase.auth.verifyOtp({
            email: PARAMS.email,
            token: PARAMS.token,
            type: "recovery",
          });
          console.log("[RecoveryCallback] verifyOtp(token+email) result:", {
            hasSession: Boolean(data.session),
            hasUser: Boolean(data.user),
            error: error?.message ?? null,
          });
          if (!error && data.session) {
            done("verifyOtp-token");
            return;
          }
          if (error) console.warn("[RecoveryCallback] verifyOtp(token+email) error:", error.message);
        }
      } catch (err) {
        console.error("[RecoveryCallback] Strategy B exception:", err);
      }

      // STRATEGY C: Poll for session (AuthProvider may still be processing)
      console.log("[RecoveryCallback] Strategy C — polling for session",
        { exchangeAttempted, pollMax: SESSION_POLL_MAX_ATTEMPTS });

      for (let attempt = 1; attempt <= SESSION_POLL_MAX_ATTEMPTS; attempt++) {
        if (completedRef.current) return;
        await new Promise((r) => setTimeout(r, SESSION_POLL_INTERVAL));
        const { data: s } = await supabase.auth.getSession();
        console.log(`[RecoveryCallback] Poll #${attempt}:`, {
          hasSession: Boolean(s.session),
          userId: s.session?.user?.id ?? null,
        });
        if (s.session?.user) {
          done(`poll-attempt-${attempt}`);
          return;
        }
      }

      // All strategies exhausted
      fail("all-strategies-exhausted");
    };

    void run();

    return () => {
      isActive = false;
      window.clearTimeout(hardTimeout);
      subscription.unsubscribe();
    };
  }, [navigate]);

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