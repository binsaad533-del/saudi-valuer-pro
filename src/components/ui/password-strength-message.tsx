import { useMemo } from "react";

interface Props {
  password: string;
}

export function PasswordStrengthMessage({ password }: Props) {
  const checks = useMemo(() => ({
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  }), [password]);

  const allPassed = checks.uppercase && checks.lowercase && checks.number && checks.special;

  if (!password || allPassed) return null;

  return (
    <div className="text-xs text-destructive mt-1.5 space-y-0.5" dir="rtl">
      <p className="font-medium">كلمة المرور ضعيفة، يجب أن تحتوي على:</p>
      {!checks.uppercase && <p>- حرف كبير (A-Z)</p>}
      {!checks.lowercase && <p>- حرف صغير (a-z)</p>}
      {!checks.number && <p>- رقم (0-9)</p>}
      {!checks.special && <p>- رمز خاص (!@#$%)</p>}
      <p className="font-medium mt-1 text-muted-foreground" dir="ltr" style={{ textAlign: "left" }}>
        Password must include:
        {!checks.uppercase && " Uppercase (A-Z),"}{!checks.lowercase && " Lowercase (a-z),"}{!checks.number && " Number (0-9),"}{!checks.special && " Special char (!@#$%)"}
      </p>
    </div>
  );
}
