import type { LucideIcon } from "lucide-react";

export type PipelineStep = 0 | 1 | 2 | 3 | 4 | 5;

export interface ReportDraft {
  report_title_ar?: string;
  report_title_en?: string;
  reference_number?: string;
  report_date?: string;
  sections?: Record<string, {
    title_ar?: string;
    title_en?: string;
    content_ar?: string;
    content_en?: string;
    tables?: { caption_ar?: string; headers?: string[]; rows?: string[][] }[];
  }>;
  final_value?: {
    amount?: number;
    currency?: string;
    text_ar?: string;
    text_en?: string;
    effective_date?: string;
    basis_of_value_ar?: string;
    confidence_level?: string;
  };
  metadata?: {
    standards_referenced?: string[];
    approaches_used?: string[];
    data_completeness_pct?: number;
    sections_needing_review?: string[];
    missing_data_items?: string[];
  };
}

export interface AggregatedData {
  request?: any;
  client?: any;
  assignment?: any;
  subject?: any;
  inspection?: any;
  inspection_analysis?: any;
  inspection_photos?: any[];
  inspection_checklist?: any[];
  comparables?: any[];
  document_extractions?: any[];
  assumptions?: any[];
  reconciliation?: any;
  compliance_checks?: any[];
  portfolio_assets?: any[];
  valuer?: any;
  reviewer?: any;
  organization?: any;
  final_value?: any;
}
