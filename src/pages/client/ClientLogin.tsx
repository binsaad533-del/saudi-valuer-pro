import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Mail, Lock, KeyRound, Loader2 } from "lucide-react";
import logo from "@/assets/logo.png";

export default function ClientLogin() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  // Email + Password
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // OTP
  const [otpEmail, setOtpEmail] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpCode, setOtpCode] = useState("");

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      navigate("/client");
    } catch (err: any) {
      toast({ title: "خطأ في تسجيل الدخول", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: otpEmail });
      if (error) throw error;
      setOtpSent(true);
      toast({ title: "تم إرسال رمز التحقق", description: "يرجى التحقق من بريدك الإلكتروني" });
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: otpEmail,
        token: otpCode,
        type: "email",
      });
      if (error) throw error;
      navigate("/client");
    } catch (err: any) {
      toast({ title: "رمز غير صحيح", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <img src={logo} alt="جساس" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">بوابة العملاء</h1>
          <p className="text-muted-foreground text-sm mt-1">جساس للتقييم العقاري</p>
        </div>

        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <Tabs defaultValue="password" dir="rtl">
            <TabsList className="grid w-full grid-cols-2 mb-6">
              <TabsTrigger value="password" className="text-sm">كلمة المرور</TabsTrigger>
              <TabsTrigger value="otp" className="text-sm">رمز التحقق</TabsTrigger>
            </TabsList>

            <TabsContent value="password">
              <form onSubmit={handleEmailLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="email">البريد الإلكتروني</Label>
                  <div className="relative">
                    <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="email"
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
                  <Label htmlFor="password">كلمة المرور</Label>
                  <div className="relative">
                    <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input
                      id="password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      required
                      dir="ltr"
                    />
                  </div>
                </div>
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                  تسجيل الدخول
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="otp">
              {!otpSent ? (
                <form onSubmit={handleSendOtp} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="otp-email">البريد الإلكتروني</Label>
                    <div className="relative">
                      <Mail className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="otp-email"
                        type="email"
                        placeholder="example@email.com"
                        value={otpEmail}
                        onChange={(e) => setOtpEmail(e.target.value)}
                        className="pr-10"
                        required
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    إرسال رمز التحقق
                  </Button>
                </form>
              ) : (
                <form onSubmit={handleVerifyOtp} className="space-y-4">
                  <p className="text-sm text-muted-foreground text-center">
                    تم إرسال رمز التحقق إلى <span className="font-medium text-foreground" dir="ltr">{otpEmail}</span>
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="otp-code">رمز التحقق</Label>
                    <div className="relative">
                      <KeyRound className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="otp-code"
                        type="text"
                        placeholder="123456"
                        value={otpCode}
                        onChange={(e) => setOtpCode(e.target.value)}
                        className="pr-10 text-center tracking-widest"
                        required
                        dir="ltr"
                      />
                    </div>
                  </div>
                  <Button type="submit" className="w-full" disabled={loading}>
                    {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
                    تحقق وسجّل الدخول
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    className="w-full text-sm"
                    onClick={() => setOtpSent(false)}
                  >
                    إعادة إرسال الرمز
                  </Button>
                </form>
              )}
            </TabsContent>
          </Tabs>

          <div className="mt-6 text-center text-sm text-muted-foreground">
            ليس لديك حساب؟{" "}
            <Link to="/client/register" className="text-primary font-medium hover:underline">
              إنشاء حساب جديد
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          © {new Date().getFullYear()} جساس للتقييم العقاري - جميع الحقوق محفوظة
        </p>
      </div>
    </div>
  );
}
