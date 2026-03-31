import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles: string[];
  redirectTo?: string;
}

export default function ProtectedRoute({ children, allowedRoles, redirectTo }: ProtectedRouteProps) {
  const { user, role, loading } = useAuth();

  // Still loading — show spinner, never redirect
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  // Definitely not authenticated
  if (!user) {
    return <Navigate to={redirectTo || "/login"} replace />;
  }

  // Authenticated but wrong role
  if (role && !allowedRoles.includes(role)) {
    if (role === "client") return <Navigate to="/client" replace />;
    if (role === "inspector") return <Navigate to="/inspector" replace />;
    return <Navigate to={redirectTo || "/login"} replace />;
  }

  return <>{children}</>;
}
