export interface PurposeOption {
  key: string;
  label: string;
  confidence: number;
  reason: string;
}

export interface PurposeAnalysis {
  selectedPurpose: string;
  confidence: number;
  reason: string;
  allPurposes: PurposeOption[];
}

export interface BasisOption {
  key: string;
  label: string;
  labelEn: string;
  confidence: number;
  reason: string;
  ivsReference?: string;
}

export interface BasisOfValueAnalysis {
  selectedBasis: string;
  selectedBasisEn: string;
  confidence: number;
  reason: string;
  ivsReference: string;
  allBases: BasisOption[];
}

export interface ApproachOption {
  key: string;
  label: string;
  labelEn: string;
  role: "primary" | "secondary" | "supporting";
  confidence: number;
  reason: string;
  ivsReference?: string;
}

export interface MethodologyAnalysis {
  primaryApproach: ApproachOption;
  secondaryApproach: ApproachOption;
  allApproaches: ApproachOption[];
  justification: string;
}

export interface DisciplineAnalysis {
  discipline: "real_estate" | "machinery" | "mixed";
  disciplineLabel: string;
  confidence: number;
  reason: string;
  signals: string[];
  subTypes?: string[];
}

export interface ScopeData {
  valuationType: string;
  valuationStandard: string;
  valuationBasis: string;
  approaches: string[];
  primaryApproach: string;
  secondaryApproach?: string;
  approachJustification?: string;
  inspectionType: string;
  inspectionRequirements?: string[];
  deliverables: string[];
  estimatedDays: number;
  assumptions: string[];
  limitations: string[];
  requiredDocuments?: string[];
  specialConsiderations?: string[];
  complianceNotes?: string[];
  disciplineAnalysis?: DisciplineAnalysis;
  purposeAnalysis?: PurposeAnalysis;
  basisOfValueAnalysis?: BasisOfValueAnalysis;
  methodologyAnalysis?: MethodologyAnalysis;
}

export interface PricingBreakdown {
  complexityAdjustment: number;
  complexityFactor: number;
  complexityReason: string;
  urgencyAdjustment: number;
  urgencyFactor: number;
  rentalAnalysisSurcharge: number;
  portfolioDiscount: number;
  additionalServices: { name: string; price: number }[];
  additionalTotal: number;
}

export interface PricingData {
  basePrice: number;
  cityMultiplier: number;
  adjustedBase: number;
  sizeCategory: string;
  breakdown: PricingBreakdown;
  subtotal: number;
  vatRate: number;
  vatAmount: number;
  totalPrice: number;
  justification: string;
}
