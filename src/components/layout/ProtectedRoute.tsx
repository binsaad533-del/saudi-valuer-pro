import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export default function ProtectedRoute({ children, allowedRoles, redirectTo }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      navigate(redirectTo || "/login", { replace: true });
      return;
    }
    if (role && !allowedRoles.includes(role)) {
      // Redirect to their correct portal
      if (role === "client") navigate("/client", { replace: true });
      else if (role === "inspector") navigate("/inspector", { replace: true });
      else navigate("/login", { replace: true });
    }
  }, [user, role, loading, allowedRoles, navigate, redirectTo]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!user || !role || !allowedRoles.includes(role)) return null;

  return <>{children}</>;
}
