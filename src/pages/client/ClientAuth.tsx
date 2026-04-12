import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Phone, Mail, Lock, User, Loader2, Eye, EyeOff, CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";
import AppFooter from "@/components/layout/AppFooter";

export default function ClientAuth() {
  const navigate = useNavigate();
  const { user, role, loading: authLoading, getRedirectPath } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(false);

  // Phone tab state
  const [phone, setPhone] = useState("");
  const [clientName, setClientName] = useState("");
  const [redirecting, setRedirecting] = useState(false);

  // Email tab state
  const [emailMode, setEmailMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [emailDone, setEmailDone] = useState(false);

  // Redirect if already logged in
  useEffect(() => {
    if (!authLoading && user && role) {
      navigate(getRedirectPath(role), { replace: true });
    }
  }, [authLoading, user, role, navigate, getRedirectPath]);

  // ── Phone login (demo-auth Edge Function) ─────────────────────────────────
  const handlePhoneLogin = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      const raw = phone.trim().replace(/^0+/, "").replace(/\D/g, "");
      if (raw.length < 8) {
        toast({ title: "أدخل رقم جوال صحيح", variant: "destructive" });
        return;
      }
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("demo-auth", {
          body: { phone: raw, client_name: clientName.trim() || undefined },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);

        if (data?.valid && data?.email && data?.password) {
          setRedirecting(true);
          const { error: signInError } = await supabase.auth.signInWithPassword({
            email: data.email,
            password: data.password,
          });
          if (signInError) throw signInError;
          toast({ title: data.is_new_account ? "تم إنشاء حسابك بنجاح" : "تم تسجيل الدخول" });
          navigate("/client/dashboard", { replace: true });
        }
      } catch (err: unknown) {
        setRedirecting(false);
        const message = err instanceof Error ? err.message : "حدث خطأ، حاول مرة أخرى";
        toast({ title: "تعذر الدخول", description: message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    },
    [phone, clientName, toast, navigate],
  );

  // ── Email sign-in ──────────────────────────────────────────────────────────
  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      toast({ title: "تم تسجيل الدخول" });
      navigate("/client/dashboard", { replace: true });
    } catch (err: any) {
      toast({ title: "خطأ في تسجيل الدخول", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  // ── Email sign-up ──────────────────────────────────────────────────────────
  const handleEmailRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 6) {
      toast({ title: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName, role: "client" },
        },
      });
      if (error) throw error;

      if (data.user) {
        // Insert profile
        await supabase.from("profiles").upsert({
          user_id: data.user.id,
          full_name_ar: fullName || email.split("@")[0],
          email,
          account_status: "active",
          user_type: "external",
          preferred_language: "ar",
        }, { onConflict: "user_id" });

        // Insert role
        await supabase.from("user_roles").insert({ user_id: data.user.id, role: "client" as any });

        // If session exists (email auto-confirm on) → go directly to dashboard
        if (data.session) {
          toast({ title: "تم إنشاء حسابك بنجاح" });
          navigate("/client/dashboard", { replace: true });
          return;
        }

        // Try signing in (fallback if auto-confirm is on but session not returned)
        const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });
        if (!signInErr) {
          toast({ title: "تم إنشاء حسابك بنجاح" });
          navigate("/client/dashboard", { replace: true });
          return;
        }
      }

      // Email confirmation required
      setEmailDone(true);
    } catch (err: any) {
      toast({ title: "خطأ في التسجيل", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (redirecting) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="text-center">
          <Loader2 className="w-12 h-12 text-primary mx-auto mb-4 animate-spin" />
          <p className="text-foreground font-medium">جاري تسجيل الدخول...</p>
        </div>
      </div>
    );
  }

  if (emailDone) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم إنشاء حسابك</h2>
            <p className="text-muted-foreground text-sm mb-6">
              تحقق من بريدك الإلكتروني لتأكيد الحساب ثم سجّل الدخول.
            </p>
            <Button onClick={() => { setEmailDone(false); setEmailMode("login"); }} className="w-full">
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4" dir="rtl">
      <div className="w-full max-w-sm flex-1 flex flex-col justify-center">
        {/* Logo */}
        <div className="text-center mb-8">
          <img src={logo} alt="جساس" className="w-28 h-auto mx-auto mb-4 object-contain" />
          <h1 className="text-xl font-extralight text-foreground">جساس للتقييم .. نصنع للأصل قيمة</h1>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <Tabs defaultValue="email" dir="rtl">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="email" className="text-sm">
                <Mail className="h-3.5 w-3.5 ml-1.5" />
                البريد الإلكتروني
              </TabsTrigger>
              <TabsTrigger value="phone" className="text-sm">
                <Phone className="h-3.5 w-3.5 ml-1.5" />
                رقم الجوال
              </TabsTrigger>
            </TabsList>

            {/* ── Email tab ── */}
            <TabsContent value="email" className="space-y-4">
              {/* login / register sub-toggle */}
              <div className="flex rounded-lg border border-border overflow-hidden">
                <button
                  type="button"
                  onClick={() => setEmailMode("login")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    emailMode === "login"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  تسجيل الدخول
                </button>
                <button
                  type="button"
                  onClick={() => setEmailMode("register")}
                  className={`flex-1 py-2 text-sm font-medium transition-colors ${
                    emailMode === "register"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted/50 text-muted-foreground hover:bg-muted"
                  }`}
                >
                  حساب جديد
                </button>
              </div>

              {emailMode === "login" ? (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email-login">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email-login"
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pr-10"
                        required
                        dir="ltr"
                        autoFocus
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="email-pass">كلمة المرور</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="email-pass"
                        type={showPassword ? "text" : "password"}
                        placeholder="أدخل كلمة المرور"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10 pl-10"
                        required
                        dir="ltr"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    دخول
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleEmailRegister} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reg-name">الاسم الكامل</Label>
                    <div className="relative">
                      <User className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-name"
                        placeholder="محمد أحمد"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="pr-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-email">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-email"
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="pr-10"
                        required
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="reg-pass">كلمة المرور</Label>
                    <div className="relative">
                      <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="reg-pass"
                        type={showPassword ? "text" : "password"}
                        placeholder="6 أحرف على الأقل"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="pr-10 pl-10"
                        required
                        dir="ltr"
                        minLength={6}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    إنشاء الحساب
                  </Button>
                </form>
              )}
            </TabsContent>

            {/* ── Phone tab (demo-auth Edge Function) ── */}
            <TabsContent value="phone">
              <form onSubmit={handlePhoneLogin} className="space-y-5">
                <div className="text-center mb-2">
                  <p className="text-sm text-muted-foreground">
                    أدخل رقم جوالك وسيتم تسجيل دخولك فوراً
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">رقم الجوال</Label>
                  <div className="relative flex items-center gap-2">
                    <span className="shrink-0 text-sm text-muted-foreground font-medium min-w-[3.5rem] text-center" dir="ltr">
                      +966
                    </span>
                    <div className="relative flex-1">
                      <Phone className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="phone"
                        type="tel"
                        placeholder="5XXXXXXXX"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="pr-10"
                        required
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="client-name">
                    الاسم <span className="text-muted-foreground text-xs">(اختياري)</span>
                  </Label>
                  <Input
                    id="client-name"
                    placeholder="اسمك الكامل"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                  />
                </div>

                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  دخول
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} جساس للتقييم - جميع الحقوق محفوظة
        </p>
      </div>
      <AppFooter />
    </div>
  );
}
