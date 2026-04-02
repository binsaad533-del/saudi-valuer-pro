export async function extractEdgeFunctionErrorMessage(
  error: unknown,
  fallback = "تعذر إكمال العملية حالياً"
): Promise<string> {
  if (typeof error === "object" && error !== null) {
    const context = (error as { context?: unknown }).context;

    if (context instanceof Response) {
      try {
        const payload = await context.clone().json() as { error?: string; message?: string };
        if (typeof payload.error === "string" && payload.error.trim()) return payload.error;
        if (typeof payload.message === "string" && payload.message.trim()) return payload.message;
      } catch {
        try {
          const text = await context.clone().text();
          if (text.trim()) return text;
        } catch {
          // ignore parsing failures
        }
      }
    }

    const message = (error as { message?: string }).message;
    if (typeof message === "string" && message.trim()) return message;
  }

  return fallback;
}
