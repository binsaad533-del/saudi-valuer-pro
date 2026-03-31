import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  role: string | null;
  loading: boolean;
  accountStatus: string | null;
}

interface AuthContextType extends AuthState {
  getRedirectPath: (role: string | null) => string;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    accountStatus: null,
  });
  const mountedRef = useRef(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;

    const fetchRoleAndProfile = async (user: User) => {
      try {
        const [{ data: roleData }, { data: profile }] = await Promise.all([
          supabase.from("user_roles").select("role").eq("user_id", user.id).maybeSingle(),
          supabase.from("profiles").select("account_status").eq("user_id", user.id).maybeSingle(),
        ]);
        if (!mountedRef.current) return;
        setState({
          user,
          role: roleData?.role || "client",
          loading: false,
          accountStatus: profile?.account_status || "active",
        });
      } catch {
        if (!mountedRef.current) return;
        setState({ user, role: "client", loading: false, accountStatus: "active" });
      }
    };

    // 1. Hydrate from persisted session — this is the reliable initial check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mountedRef.current) return;
      initializedRef.current = true;
      if (session?.user) {
        fetchRoleAndProfile(session.user);
      } else {
        setState({ user: null, role: null, loading: false, accountStatus: null });
      }
    });

    // 2. Listen for FUTURE auth changes (sign-in, sign-out, token refresh)
    //    Ignore events until getSession has resolved (initializedRef)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!mountedRef.current) return;
      // Skip the initial event — getSession handles that
      if (!initializedRef.current) return;

      if (session?.user) {
        fetchRoleAndProfile(session.user);
      } else {
        setState({ user: null, role: null, loading: false, accountStatus: null });
      }
    });

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, []);

  const getRedirectPath = (role: string | null): string => {
    switch (role) {
      case "owner":
      case "admin_coordinator":
      case "financial_manager":
        return "/";
      case "inspector":
        return "/inspector";
      default:
        return "/client/dashboard";
    }
  };

  return (
    <AuthContext.Provider value={{ ...state, getRedirectPath }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
