import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface AuthState {
  user: any | null;
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

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        // Fetch role
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        // Fetch account status
        const { data: profile } = await supabase
          .from("profiles")
          .select("account_status")
          .eq("user_id", session.user.id)
          .single();

        setState({
          user: session.user,
          role: roleData?.role || "client",
          loading: false,
          accountStatus: profile?.account_status || "active",
        });
      } else {
        setState({ user: null, role: null, loading: false, accountStatus: null });
      }
    });

    // Initial check
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data: roleData } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", session.user.id)
          .single();

        const { data: profile } = await supabase
          .from("profiles")
          .select("account_status")
          .eq("user_id", session.user.id)
          .single();

        setState({
          user: session.user,
          role: roleData?.role || "client",
          loading: false,
          accountStatus: profile?.account_status || "active",
        });
      } else {
        setState({ user: null, role: null, loading: false, accountStatus: null });
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const getRedirectPath = (role: string | null): string => {
    switch (role) {
      case "super_admin":
      case "firm_admin":
      case "valuer":
      case "reviewer":
        return "/";
      case "inspector":
        return "/inspector";
      case "auditor":
        return "/auditor";
      default:
        return "/client";
    }
  };

  return { ...state, getRedirectPath };
}
