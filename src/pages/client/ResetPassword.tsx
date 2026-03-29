import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { Lock, Loader2, CheckCircle } from "lucide-react";
import logo from "@/assets/logo.png";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [done, setDone] = useState(false);
  const [hasSession, setHasSession] = useState(false);

  useEffect(() => {
    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setHasSession(true);
      }
    });
    // Also check if already in a session (redirect from email)
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) setHasSession(true);
    });
  }, []);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast({ title: "كلمات المرور غير متطابقة", variant: "destructive" });
      return;
    }
    if (password.length < 6) {
      toast({ title: "كلمة المرور يجب أن تكون 6 أحرف على الأقل", variant: "destructive" });
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      setDone(true);
    } catch (err: any) {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <CheckCircle className="w-16 h-16 text-success mx-auto mb-4" />
            <h2 className="text-xl font-bold text-foreground mb-2">تم تغيير كلمة المرور</h2>
            <p className="text-muted-foreground text-sm mb-6">يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة.</p>
            <Button onClick={() => navigate("/client/login")} className="w-full">
              تسجيل الدخول
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!hasSession) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="w-full max-w-md text-center">
          <div className="bg-card rounded-xl border border-border shadow-card p-8">
            <Loader2 className="w-10 h-10 animate-spin text-primary mx-auto mb-4" />
            <p className="text-muted-foreground">جاري التحقق من الرابط...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <img src={logo} alt="جساس" className="w-16 h-16 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-foreground">إعادة تعيين كلمة المرور</h1>
        </div>
        <div className="bg-card rounded-xl border border-border shadow-card p-6">
          <form onSubmit={handleReset} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="new-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} className="pr-10" required dir="ltr" minLength={6} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirm-new-password">تأكيد كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input id="confirm-new-password" type="password" placeholder="••••••••" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className="pr-10" required dir="ltr" minLength={6} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              تغيير كلمة المرور
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
