import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

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

  useEffect(() => {
    if (!loading) return;
    const timer = setTimeout(() => setTimedOut(true), AUTH_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [loading]);

  useEffect(() => {
    if (loading && !timedOut) return;

    if (!user || timedOut) {
      navigate(redirectTo || "/login", { replace: true });
      return;
    }
    if (role && !allowedRoles.includes(role)) {
      if (role === "client") navigate("/client", { replace: true });
      else if (role === "inspector") navigate("/inspector", { replace: true });
      else navigate("/login", { replace: true });
    }
  }, [user, role, loading, timedOut, allowedRoles, navigate, redirectTo]);

  if (loading && !timedOut) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !role || !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
