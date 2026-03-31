import { createContext, useContext, useState, useEffect, useRef, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

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
    initializedRef.current = false;

    const loadUserData = (user: User) => {
      Promise.all([
        supabase.from("user_roles").select("role").eq("user_id", user.id).single(),
        supabase.from("profiles").select("account_status").eq("user_id", user.id).single(),
      ]).then(([{ data: roleData }, { data: profile }]) => {
        if (!mountedRef.current) return;
        setState({
          user,
          role: roleData?.role || "client",
          loading: false,
          accountStatus: profile?.account_status || "active",
        });
      }).catch(() => {
        if (!mountedRef.current) return;
        setState({ user, role: "client", loading: false, accountStatus: "active" });
      });
    };

    // 1. Register listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mountedRef.current) return;

        if (event === "INITIAL_SESSION") {
          // Mark as initialized so getSession doesn't double-fire
          initializedRef.current = true;
        }

        if (event === "SIGNED_OUT") {
          setState({ user: null, role: null, loading: false, accountStatus: null });
          return;
        }

        if (session?.user) {
          loadUserData(session.user);
        } else {
          setState({ user: null, role: null, loading: false, accountStatus: null });
        }
      }
    );

    // 2. Fallback: if INITIAL_SESSION didn't fire within 1s, use getSession
    const fallbackTimer = setTimeout(() => {
      if (!initializedRef.current && mountedRef.current) {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (!mountedRef.current || initializedRef.current) return;
          initializedRef.current = true;
          if (session?.user) {
            loadUserData(session.user);
          } else {
            setState({ user: null, role: null, loading: false, accountStatus: null });
          }
        });
      }
    }, 1000);

    return () => {
      mountedRef.current = false;
      clearTimeout(fallbackTimer);
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
