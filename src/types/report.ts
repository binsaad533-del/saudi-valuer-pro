export type ReportStatus = 'draft' | 'review' | 'approved' | 'issued' | 'delivered' | 'cancelled';

export type AssetType = 'real_estate' | 'equipment' | 'vehicle';

export type ValuationMethodology = 'market_comparison' | 'income' | 'cost' | 'combined';

export interface ReportComparable {
  description: string;
  value: number;
  source: string;
  date: string;
}

export interface EvaluatorCredentials {
  saudiAuthority: string;
  rics: string;
  asa: string;
}

export interface ReportAuditEntry {
  action: string;
  performedBy: string;
  timestamp: string;
  details: string;
}

export interface Report {
  id: string;
  reportNumber: string; // Format: RPT-YYYY-XXXXX
  valuationRequestId: string;
  clientName: string;
  clientPhone: string;
  clientEmail: string;
  assetType: AssetType;
  assetDescription: string;
  assetLocation: string;
  methodology: ValuationMethodology;
  marketAnalysis: string;
  comparables: ReportComparable[];
  estimatedValue: number;
  currency: string; // Default: 'SAR'
  notes: string;
  status: ReportStatus;
  evaluatorName: string; // Default: 'أحمد بن سعد المالكي'
  evaluatorCredentials: EvaluatorCredentials;
  signatureImageUrl: string | null;
  qrCodeUrl: string | null;
  verificationToken: string;
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  issuedAt: string | null;
  deliveredAt: string | null;
  archivedAt: string | null;
  isArchived: boolean;
  auditLog: ReportAuditEntry[];
}
