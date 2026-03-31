import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  role: string | null;
  loading: boolean;
  accountStatus: string | null;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    role: null,
    loading: true,
    accountStatus: null,
  });

  const fetchUserData = useCallback(async (user: User) => {
    try {
      const [{ data: roleData }, { data: profile }] = await Promise.all([
        supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", user.id)
          .single(),
        supabase
          .from("profiles")
          .select("account_status")
          .eq("user_id", user.id)
          .single(),
      ]);

      setState({
        user,
        role: roleData?.role || "client",
        loading: false,
        accountStatus: profile?.account_status || "active",
      });
    } catch {
      setState({
        user,
        role: "client",
        loading: false,
        accountStatus: "active",
      });
    }
  }, []);

  useEffect(() => {
    let mounted = true;

    // 1. Check existing session first
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      if (session?.user) {
        fetchUserData(session.user);
      } else {
        setState({ user: null, role: null, loading: false, accountStatus: null });
      }
    });

    // 2. Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!mounted) return;
        if (session?.user) {
          // Use setTimeout to avoid calling Supabase inside the callback synchronously
          setTimeout(() => {
            if (mounted) fetchUserData(session.user);
          }, 0);
        } else {
          setState({ user: null, role: null, loading: false, accountStatus: null });
        }
      }
    );

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [fetchUserData]);

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

  return { ...state, getRedirectPath };
}
