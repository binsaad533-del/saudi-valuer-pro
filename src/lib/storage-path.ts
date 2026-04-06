export interface SafeStorageObject {
  storageKey: string;
  originalFilename: string;
  extension: string;
}

function normalizeFilename(filename: string) {
  return filename
    .normalize("NFKC")
    .replace(/[\x00-\x1F\x7F]/g, "")
    .replace(/[/\\]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function extractSafeExtension(filename: string) {
  const normalized = normalizeFilename(filename);
  const parts = normalized.split(".").filter(Boolean);
  if (parts.length <= 1) return "bin";

  const rawExtension = parts.at(-1)?.toLowerCase() ?? "bin";
  const safeExtension = rawExtension.replace(/[^a-z0-9]/g, "");
  return safeExtension || "bin";
}

export function buildSafeStorageObject(params: {
  userId: string;
  originalFilename: string;
  prefix?: string;
}) : SafeStorageObject {
  const originalFilename = normalizeFilename(params.originalFilename) || "file";
  const extension = extractSafeExtension(originalFilename);
  const prefix = params.prefix?.replace(/^\/+|\/+$/g, "").replace(/[^a-z0-9/_-]/gi, "") || "uploads";
  const objectId = `${Date.now()}-${crypto.randomUUID()}`;
  const storageKey = `${prefix}/${params.userId}/${objectId}.${extension}`;

  return {
    storageKey,
    originalFilename,
    extension,
  };
}

export function getUploadErrorMessage(error: unknown) {
  const rawMessage = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  if (/Invalid key/i.test(rawMessage)) {
    return "تعذر رفع الملف حاليًا بسبب مشكلة داخلية في التخزين. تمت معالجة السبب، حاول مرة أخرى.";
  }
  if (/row-level security|rls/i.test(rawMessage)) {
    return "تعذر رفع الملف لأن الجلسة الحالية غير صالحة للرفع. يرجى تسجيل الدخول مرة أخرى ثم إعادة المحاولة.";
  }
  return "تعذر رفع الملف حاليًا. يرجى إعادة المحاولة بعد قليل.";
}
