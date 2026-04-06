import { useMemo } from "react";

interface Props {
  password: string;
  /** If true, show as warning instead of error (non-blocking) */
  warningOnly?: boolean;
}

export function PasswordStrengthMessage({ password, warningOnly = false }: Props) {
  const checks = useMemo(() => ({
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    number: /[0-9]/.test(password),
  }), [password]);

  const allPassed = checks.minLength && checks.uppercase && checks.lowercase && checks.number;

  if (!password || allPassed) return null;

  const colorClass = warningOnly ? "text-amber-600" : "text-destructive";

  return (
    <div className={`text-xs ${colorClass} mt-1.5 space-y-0.5`} dir="rtl">
      <p className="font-medium">
        {warningOnly ? "كلمة المرور ضعيفة، يُفضل اختيار كلمة أقوى:" : "كلمة المرور يجب أن تحتوي على:"}
      </p>
      {!checks.minLength && <p>- 8 أحرف على الأقل</p>}
      {!checks.uppercase && <p>- حرف كبير (A-Z)</p>}
      {!checks.lowercase && <p>- حرف صغير (a-z)</p>}
      {!checks.number && <p>- رقم (0-9)</p>}
    </div>
  );
}

/** Check if password meets minimum rules (non-blocking) */
export function isPasswordMinValid(password: string): boolean {
  return password.length >= 8 &&
    /[A-Z]/.test(password) &&
    /[a-z]/.test(password) &&
    /[0-9]/.test(password);
}

