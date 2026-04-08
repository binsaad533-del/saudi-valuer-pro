export interface AssetSourceInfo {
  file_name: string;
  file_type: "excel" | "pdf" | "image" | "unknown";
  sheet_name?: string;
  row_number?: number;
  page_number?: number;
  region?: string;
}

export interface ExtractedAsset {
  id: number;
  name: string;
  type: string;
  category: string | null;
  quantity: number;
  condition: string;
  confidence: number;
  source: string;
  license_status: "permitted" | "not_permitted" | "needs_review";
  license_reason?: string;
  ai_suggestion?: string;
  source_info?: AssetSourceInfo;
}

export interface AIReviewData {
  detectedType: string;
  confirmedType: string;
  confidence: number;
  assets: ExtractedAsset[];
  totalFiles: number;
  clientName?: string;
  requestScope?: {
    clientName?: string;
    phone?: string;
    email?: string;
    idNumber?: string;
    purpose?: string;
    intendedUser?: string;
    valuationMode?: string;
    assetType?: string;
    notes?: string;
    files?: { name: string; type?: string }[];
    locations?: {
      name: string;
      city?: string;
      googleMapsUrl?: string;
      latitude?: number;
      longitude?: number;
    }[];
  };
}

export type TriggerType = "low_confidence" | "unclear_name" | "no_category" | "bad_quantity" | "conflict" | "mixed";

export interface SmartQuestion {
  id: string;
  assetIds: number[];
  question: string;
  options: { label: string; action: "approve" | "exclude" | "update"; updateField?: string; updateValue?: string }[];
  allowCustom: boolean;
  customPlaceholder?: string;
  triggerType: TriggerType;
}

export interface ChatAttachment {
  name: string;
  size: number;
  type: string;
  path: string;
}

export interface ChatMessage {
  id: string;
  type: "system" | "question" | "answer" | "info";
  text: string;
  questionData?: SmartQuestion;
  timestamp: number;
  attachments?: ChatAttachment[];
}

export interface KnowledgeRef {
  source: string;
  article: string;
  principle: string;
}
