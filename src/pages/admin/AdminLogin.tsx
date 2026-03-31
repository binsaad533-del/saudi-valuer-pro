import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, Loader2, Eye, EyeOff, ShieldCheck } from "lucide-react";
import logo from "@/assets/logo.png";

const ADMIN_ROLES = ["owner", "admin_coordinator", "financial_manager"];

export default function AdminLogin() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  // If already authenticated as admin, redirect immediately
  useEffect(() => {
    if (!authLoading && user && role && ADMIN_ROLES.includes(role)) {
      navigate("/", { replace: true });
    }
  }, [user, role, authLoading, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;

      // Check account status
      const { data: profile } = await supabase
        .from("profiles")
        .select("account_status")
        .eq("user_id", authData.user.id)
        .single();

      if (profile?.account_status === "suspended") {
        await supabase.auth.signOut();
        toast({ title: "الحساب موقوف", description: "تم إيقاف حسابك. تواصل مع الإدارة.", variant: "destructive" });
        return;
      }

      // Check role
      const { data: roleData } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authData.user.id)
        .single();

      if (!roleData || !ADMIN_ROLES.includes(roleData.role)) {
        await supabase.auth.signOut();
        toast({ title: "غير مصرّح", description: "هذه الصفحة مخصصة للإداريين فقط.", variant: "destructive" });
        return;
      }

      // Navigation is handled by the useEffect watching auth state
      // AuthProvider will update via onAuthStateChange, triggering the redirect
    } catch (err: any) {
      toast({ title: "خطأ في تسجيل الدخول", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="جساس" className="w-28 h-auto mx-auto mb-4 object-contain" />
          <h1 className="text-2xl font-extralight text-foreground">لوحة الإدارة</h1>
          <p className="text-muted-foreground text-sm mt-1">تسجيل دخول الفريق الإداري</p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <div className="flex items-center justify-center gap-2 mb-6 text-primary">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-sm font-medium">دخول إداري</span>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">البريد الإلكتروني</Label>
              <div className="relative">
                <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="email" type="email" placeholder="admin@example.com" value={email} onChange={(e) => setEmail(e.target.value)} className="pr-10" required dir="ltr" />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="password" type={showPassword ? "text" : "password"} placeholder="أدخل كلمة المرور" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10 pl-10" required dir="ltr" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-3 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              تسجيل الدخول
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} جساس للتقييم - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
