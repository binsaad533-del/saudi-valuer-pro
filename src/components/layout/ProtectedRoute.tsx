import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

const AUTH_TIMEOUT_MS = 5000;

export default function ProtectedRoute({ children, allowedRoles, redirectTo }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [timedOut, setTimedOut] = useState(false);
  const [fallbackUser, setFallbackUser] = useState<boolean | null>(null);

  // Timeout: if loading takes too long, check session directly
  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setFallbackUser(!!session?.user);
      setTimedOut(true);
    }, AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (loading && !timedOut) return;

    // If timed out but user has active session, allow through
    if (timedOut && fallbackUser) return;

    if (!user) {
      navigate(redirectTo || "/login", { replace: true });
      return;
    }
    if (role && !allowedRoles.includes(role)) {
      if (role === "client") navigate("/client", { replace: true });
      else if (role === "inspector") navigate("/inspector", { replace: true });
      else navigate("/login", { replace: true });
    }
  }, [user, role, loading, timedOut, fallbackUser, allowedRoles, navigate, redirectTo]);

  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Timed out but session exists → allow access
  if (timedOut && fallbackUser) {
    return <>{children}</>;
  }

  if (!user || !role || !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
