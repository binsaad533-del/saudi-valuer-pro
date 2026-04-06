import * as XLSX from "xlsx";

export interface ParsedSheet {
  name: string;
  headers: string[];
  rows: Record<string, any>[];
  totalRows: number;
}

export interface ExcelParseResult {
  sheets: ParsedSheet[];
  fileName: string;
  fileSize: number;
}

/**
 * Parse an Excel/CSV file into structured data.
 * Automatically detects the header row by looking for the row with the most non-empty cells.
 */
export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });

  const sheets: ParsedSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    // Get raw data as array of arrays
    const rawData: any[][] = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: "" });
    if (rawData.length === 0) continue;

    // Auto-detect header row: find the row with the most non-empty cells in the first 10 rows
    let headerRowIndex = 0;
    let maxNonEmpty = 0;
    const searchLimit = Math.min(rawData.length, 10);

    for (let i = 0; i < searchLimit; i++) {
      const nonEmpty = rawData[i].filter((cell: any) => cell !== "" && cell != null).length;
      if (nonEmpty > maxNonEmpty) {
        maxNonEmpty = nonEmpty;
        headerRowIndex = i;
      }
    }

    const headers = rawData[headerRowIndex].map((h: any, idx: number) =>
      h != null && String(h).trim() !== "" ? String(h).trim() : `Column_${idx + 1}`
    );

    // Parse data rows
    const rows: Record<string, any>[] = [];
    for (let i = headerRowIndex + 1; i < rawData.length; i++) {
      const row = rawData[i];
      // Skip completely empty rows
      if (!row || row.every((cell: any) => cell === "" || cell == null)) continue;

      const record: Record<string, any> = {};
      headers.forEach((header, idx) => {
        record[header] = idx < row.length ? row[idx] : "";
      });
      rows.push(record);
    }

    if (rows.length > 0) {
      sheets.push({ name: sheetName, headers, rows, totalRows: rows.length });
    }
  }

  return { sheets, fileName: file.name, fileSize: file.size };
}

// ── Asset field definitions ──

export interface AssetFieldDef {
  key: string;
  labelAr: string;
  labelEn: string;
  required: boolean;
  aliases: string[]; // common column names that map to this field
}

export const ASSET_FIELDS: AssetFieldDef[] = [
  {
    key: "name",
    labelAr: "اسم الأصل",
    labelEn: "Asset Name",
    required: true,
    aliases: [
      "name", "asset name", "item name", "item", "asset", "اسم", "اسم الأصل", "البند",
      "description", "الوصف", "اسم المعدة", "equipment name", "machine name",
      "account name", "account", "اسم الحساب", "حساب", "بيان", "asset description",
    ],
  },
  {
    key: "type",
    labelAr: "نوع الأصل",
    labelEn: "Asset Type",
    required: false,
    aliases: [
      "type", "asset type", "category", "نوع", "نوع الأصل", "التصنيف", "فئة",
      "classification", "class",
    ],
  },
  {
    key: "quantity",
    labelAr: "الكمية",
    labelEn: "Quantity",
    required: true,
    aliases: [
      "quantity", "qty", "count", "الكمية", "العدد", "كمية", "عدد", "no.", "number", "units",
    ],
  },
  {
    key: "value",
    labelAr: "القيمة",
    labelEn: "Value",
    required: false,
    aliases: [
      "value", "cost", "price", "amount", "القيمة", "السعر", "التكلفة", "المبلغ",
      "unit price", "unit cost", "سعر الوحدة", "book value", "القيمة الدفترية",
      "acquisition cost", "original cost", "تكلفة الاقتناء", "net book value",
    ],
  },
  {
    key: "model",
    labelAr: "الموديل",
    labelEn: "Model",
    required: false,
    aliases: [
      "model", "model number", "model no", "الموديل", "رقم الموديل", "طراز",
    ],
  },
  {
    key: "serial_number",
    labelAr: "الرقم التسلسلي",
    labelEn: "Serial Number",
    required: false,
    aliases: [
      "serial", "serial number", "serial no", "s/n", "sn", "الرقم التسلسلي", "رقم تسلسلي",
    ],
  },
  {
    key: "description",
    labelAr: "الوصف",
    labelEn: "Description",
    required: false,
    aliases: [
      "description", "desc", "details", "notes", "remarks", "الوصف", "التفاصيل",
      "ملاحظات", "تفاصيل", "specifications", "المواصفات",
    ],
  },
  {
    key: "condition",
    labelAr: "الحالة",
    labelEn: "Condition",
    required: false,
    aliases: [
      "condition", "status", "state", "الحالة", "حالة", "الوضع",
    ],
  },
  {
    key: "location",
    labelAr: "الموقع",
    labelEn: "Location",
    required: false,
    aliases: [
      "location", "site", "place", "الموقع", "المكان", "موقع",
    ],
  },
  {
    key: "manufacturer",
    labelAr: "الشركة المصنعة",
    labelEn: "Manufacturer",
    required: false,
    aliases: [
      "manufacturer", "brand", "make", "الشركة المصنعة", "الشركة", "المصنع",
      "العلامة التجارية", "مصنع",
    ],
  },
  {
    key: "year",
    labelAr: "سنة الصنع",
    labelEn: "Year",
    required: false,
    aliases: [
      "year", "year built", "manufacture year", "سنة الصنع", "سنة", "العام",
      "year of manufacture", "production year",
    ],
  },
];

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string | null; // null = skip
  confidence: number; // 0-100
  autoMapped: boolean;
}

/**
 * Automatically map Excel column headers to asset fields using fuzzy matching.
 */
export function autoMapColumns(headers: string[]): ColumnMapping[] {
  return headers.map((header) => {
    const normalized = header.toLowerCase().trim();

    let bestMatch: { field: AssetFieldDef; score: number } | null = null;

    for (const field of ASSET_FIELDS) {
      // Exact match on key
      if (normalized === field.key) {
        bestMatch = { field, score: 100 };
        break;
      }

      // Check aliases
      for (const alias of field.aliases) {
        const aliasNorm = alias.toLowerCase().trim();
        if (normalized === aliasNorm) {
          bestMatch = { field, score: 95 };
          break;
        }
        // Partial match: header contains alias or alias contains header
        if (normalized.includes(aliasNorm) || aliasNorm.includes(normalized)) {
          const score = 70 + Math.min(20, (aliasNorm.length / normalized.length) * 20);
          if (!bestMatch || score > bestMatch.score) {
            bestMatch = { field, score: Math.round(score) };
          }
        }
      }
    }

    return {
      sourceColumn: header,
      targetField: bestMatch && bestMatch.score >= 60 ? bestMatch.field.key : null,
      confidence: bestMatch?.score ?? 0,
      autoMapped: bestMatch != null && bestMatch.score >= 60,
    };
  });
}

/**
 * Apply column mapping to parsed rows, producing structured asset records.
 */
export function applyMapping(
  rows: Record<string, any>[],
  mappings: ColumnMapping[],
): Record<string, any>[] {
  const activeMappings = mappings.filter((m) => m.targetField != null);

  return rows.map((row, index) => {
    const asset: Record<string, any> = { _rowIndex: index + 1 };

    for (const mapping of activeMappings) {
      const value = row[mapping.sourceColumn];
      if (value != null && value !== "") {
        asset[mapping.targetField!] = value;
      }
    }

    // Defaults
    if (!asset.quantity) asset.quantity = 1;
    if (!asset.name) asset.name = `أصل ${index + 1}`;

    return asset;
  });
}

/**
 * Validate mapped assets and return issues.
 */
export interface ValidationIssue {
  rowIndex: number;
  field: string;
  message: string;
  severity: "error" | "warning";
}

export function validateMappedAssets(
  assets: Record<string, any>[],
  mappings: ColumnMapping[],
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  const mappedFields = new Set(mappings.filter((m) => m.targetField).map((m) => m.targetField));

  // Check required fields are mapped
  for (const field of ASSET_FIELDS) {
    if (field.required && !mappedFields.has(field.key)) {
      issues.push({
        rowIndex: 0,
        field: field.key,
        message: `الحقل المطلوب "${field.labelAr}" غير معيّن لأي عمود`,
        severity: "error",
      });
    }
  }

  // Check individual row issues
  for (const asset of assets) {
    for (const field of ASSET_FIELDS) {
      if (field.required && (!asset[field.key] || String(asset[field.key]).trim() === "")) {
        issues.push({
          rowIndex: asset._rowIndex,
          field: field.key,
          message: `الصف ${asset._rowIndex}: "${field.labelAr}" فارغ`,
          severity: "warning",
        });
      }
    }

    // Validate quantity is a number
    if (asset.quantity != null && isNaN(Number(asset.quantity))) {
      issues.push({
        rowIndex: asset._rowIndex,
        field: "quantity",
        message: `الصف ${asset._rowIndex}: الكمية ليست رقمًا صحيحًا`,
        severity: "warning",
      });
    }
  }

  return issues;
}