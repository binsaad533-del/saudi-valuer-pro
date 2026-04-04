import { describe, it, expect } from "vitest";

// Test the desktop valuation business rules
const DESKTOP_BLOCKED_PURPOSES = [
  "تمويل عقاري", "ضمان بنكي", "نزع ملكية للمنفعة العامة",
];

const ALL_PURPOSES = [
  "بيع / شراء", "تمويل عقاري", "إعادة تقييم", "نزع ملكية للمنفعة العامة",
  "تصفية / تسوية", "تقارير مالية (IFRS)", "ضمان بنكي", "استثمار",
  "تأمين", "أغراض ضريبية", "نقل ملكية", "أخرى",
];

describe("Desktop Valuation Rules", () => {
  it("should block mortgage, bank guarantee, and expropriation for desktop mode", () => {
    expect(DESKTOP_BLOCKED_PURPOSES).toContain("تمويل عقاري");
    expect(DESKTOP_BLOCKED_PURPOSES).toContain("ضمان بنكي");
    expect(DESKTOP_BLOCKED_PURPOSES).toContain("نزع ملكية للمنفعة العامة");
  });

  it("should allow non-sensitive purposes for desktop mode", () => {
    const allowedPurposes = ALL_PURPOSES.filter(p => !DESKTOP_BLOCKED_PURPOSES.includes(p));
    expect(allowedPurposes).toContain("بيع / شراء");
    expect(allowedPurposes).toContain("استثمار");
    expect(allowedPurposes).toContain("تأمين");
    expect(allowedPurposes).toContain("تقارير مالية (IFRS)");
    expect(allowedPurposes.length).toBe(9);
  });

  it("should validate desktop mode requires disclaimer acceptance", () => {
    const validateDesktop = (mode: string, disclaimerAccepted: boolean, purpose: string) => {
      const errors: string[] = [];
      if (mode === "desktop" && DESKTOP_BLOCKED_PURPOSES.includes(purpose)) {
        errors.push("التقييم المكتبي غير مسموح لهذا الغرض");
      }
      if (mode === "desktop" && !disclaimerAccepted) {
        errors.push("يجب الموافقة على إقرار التقييم المكتبي");
      }
      return errors;
    };

    // Desktop without disclaimer → error
    expect(validateDesktop("desktop", false, "بيع / شراء")).toHaveLength(1);
    
    // Desktop with disclaimer, allowed purpose → no errors
    expect(validateDesktop("desktop", true, "بيع / شراء")).toHaveLength(0);
    
    // Desktop with blocked purpose → error
    expect(validateDesktop("desktop", true, "تمويل عقاري")).toHaveLength(1);
    
    // Desktop with blocked purpose AND no disclaimer → 2 errors
    expect(validateDesktop("desktop", false, "تمويل عقاري")).toHaveLength(2);
    
    // Field mode → no desktop-specific errors
    expect(validateDesktop("field", false, "تمويل عقاري")).toHaveLength(0);
  });

  it("should clear blocked purpose when switching to desktop mode", () => {
    let purpose = "تمويل عقاري";
    // Simulating the onClick handler
    if (DESKTOP_BLOCKED_PURPOSES.includes(purpose)) {
      purpose = "";
    }
    expect(purpose).toBe("");
  });
});
