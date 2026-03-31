import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export default function ProtectedRoute({ children, allowedRoles, redirectTo }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const [verified, setVerified] = useState<"pending" | "authenticated" | "unauthenticated">("pending");

  // Once AuthProvider finishes loading, double-check with getSession to avoid race conditions
  useEffect(() => {
    if (loading) return;

    if (user) {
      setVerified("authenticated");
      return;
    }

    // AuthProvider says no user — confirm with a direct session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        // Session exists but AuthProvider hasn't caught up yet — wait for it
        setVerified("authenticated");
      } else {
        setVerified("unauthenticated");
      }
    });
  }, [user, loading]);

  // Handle redirects only when verification is complete
  useEffect(() => {
    if (verified === "unauthenticated") {
      navigate(redirectTo || "/login", { replace: true });
      return;
    }

    if (verified === "authenticated" && role && !allowedRoles.includes(role)) {
      if (role === "client") navigate("/client", { replace: true });
      else if (role === "inspector") navigate("/inspector", { replace: true });
      else navigate(redirectTo || "/login", { replace: true });
    }
  }, [verified, role, allowedRoles, navigate, redirectTo]);

  if (verified !== "authenticated") {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (role && !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
