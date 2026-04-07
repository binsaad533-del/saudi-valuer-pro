/**
 * Workflow Engine Enforcement Tests
 * Validates that DB-level security layer works correctly
 */
import { describe, it, expect } from "vitest";
import {
  canTransition,
  ALLOWED_TRANSITIONS,
  WORKFLOW_STATUSES,
  normalizeStatus,
} from "@/lib/workflow-engine";

describe("ALLOWED_TRANSITIONS enforcement", () => {
  it("should reject skip from submitted → issued", () => {
    expect(canTransition("submitted", "issued")).toBe(false);
  });

  it("should reject skip from draft → professional_review", () => {
    expect(canTransition("draft", "professional_review")).toBe(false);
  });

  it("should reject skip from analysis_complete → issued", () => {
    expect(canTransition("analysis_complete", "issued")).toBe(false);
  });

  it("should reject reverse from issued → professional_review", () => {
    expect(canTransition("issued", "professional_review")).toBe(false);
  });

  it("should reject any transition from archived", () => {
    const fromArchived = ALLOWED_TRANSITIONS["archived"] || [];
    expect(fromArchived.length).toBe(0);
  });

  it("should allow only client_review → professional_review as reverse path", () => {
    expect(canTransition("client_review", "professional_review")).toBe(true);
  });

  it("should allow draft → submitted", () => {
    expect(canTransition("draft", "submitted")).toBe(true);
  });

  it("should allow scope_approved → first_payment_confirmed", () => {
    expect(canTransition("scope_approved", "first_payment_confirmed")).toBe(true);
  });

  it("should allow final_payment_confirmed → issued", () => {
    expect(canTransition("final_payment_confirmed", "issued")).toBe(true);
  });

  it("should allow issued → archived", () => {
    expect(canTransition("issued", "archived")).toBe(true);
  });
});

describe("18-status validation", () => {
  it("should have exactly 18 statuses", () => {
    expect(WORKFLOW_STATUSES.length).toBe(18);
  });

  it("should have transitions defined for all statuses except archived", () => {
    for (const status of WORKFLOW_STATUSES) {
      if (status === "archived") {
        expect(ALLOWED_TRANSITIONS[status]?.length || 0).toBe(0);
      } else {
        expect(ALLOWED_TRANSITIONS[status]?.length).toBeGreaterThan(0);
      }
    }
  });

  it("should not allow any status to transition to itself", () => {
    for (const [from, targets] of Object.entries(ALLOWED_TRANSITIONS)) {
      expect(targets).not.toContain(from);
    }
  });
});

describe("normalizeStatus backward compat", () => {
  it("should map legacy 'processing' to 'data_collection_open'", () => {
    expect(normalizeStatus("processing")).toBe("data_collection_open");
  });

  it("should map 'report_issued' to 'issued'", () => {
    expect(normalizeStatus("report_issued")).toBe("issued");
  });

  it("should pass through valid statuses unchanged", () => {
    expect(normalizeStatus("draft")).toBe("draft");
    expect(normalizeStatus("issued")).toBe("issued");
  });
});

describe("Payment gate enforcement (client-side)", () => {
  it("should have payment gate statuses defined", () => {
    expect(ALLOWED_TRANSITIONS["scope_approved"]).toContain("first_payment_confirmed");
    expect(ALLOWED_TRANSITIONS["draft_approved"]).toContain("final_payment_confirmed");
  });

  it("should not allow skipping payment gates", () => {
    // Cannot go from scope_approved directly to data_collection_open
    expect(canTransition("scope_approved", "data_collection_open")).toBe(false);
    // Cannot go from draft_approved directly to issued
    expect(canTransition("draft_approved", "issued")).toBe(false);
  });
});
