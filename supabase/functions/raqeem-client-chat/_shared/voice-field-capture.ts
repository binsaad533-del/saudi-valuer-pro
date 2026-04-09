/**
 * Level 52: Voice Field Capture Engine
 * Processes transcribed voice notes from inspectors into structured data
 */

interface ExtractedFieldData {
  condition?: string;
  finishingLevel?: string;
  estimatedAge?: number;
  floors?: number;
  rooms?: number;
  defects: string[];
  notes: string[];
  landmarks: string[];
  measurements: { field: string; value: number; unit: string }[];
}

interface VoiceFieldResult {
  section: string;
  extractedData: ExtractedFieldData | null;
  confidenceScore: number;
  rawTranscriptions: number;
}

export async function analyzeVoiceFieldCapture(
  db: any,
  assignmentId: string | undefined
): Promise<VoiceFieldResult> {
  const empty: VoiceFieldResult = { section: "", extractedData: null, confidenceScore: 0, rawTranscriptions: 0 };
  if (!assignmentId) return empty;

  try {
    // Get inspection notes and findings
    const { data: inspections } = await db
      .from("inspections")
      .select("findings_ar, notes_ar, duration_minutes")
      .eq("assignment_id", assignmentId)
      .order("created_at", { ascending: false })
      .limit(3);

    if (!inspections?.length) return empty;

    const allNotes = inspections
      .map((i: any) => [i.findings_ar, i.notes_ar].filter(Boolean).join(" "))
      .filter((n: string) => n.length > 0);

    if (allNotes.length === 0) return empty;

    const combinedText = allNotes.join(" ");

    // Pattern-based extraction (simulating NLP)
    const defects: string[] = [];
    const notes: string[] = [];
    const landmarks: string[] = [];
    const measurements: { field: string; value: number; unit: string }[] = [];

    // Defect detection patterns
    const defectPatterns = ["تشقق", "رطوبة", "تسرب", "صدأ", "تآكل", "هبوط", "تصدع", "عيب", "ضرر", "تلف"];
    for (const pattern of defectPatterns) {
      if (combinedText.includes(pattern)) {
        defects.push(pattern);
      }
    }

    // Condition keywords
    let condition = "good";
    if (combinedText.includes("ممتاز") || combinedText.includes("جديد")) condition = "excellent";
    else if (combinedText.includes("سيء") || combinedText.includes("متهالك")) condition = "poor";
    else if (combinedText.includes("متوسط") || combinedText.includes("مقبول")) condition = "fair";

    // Finishing level
    let finishingLevel = "standard";
    if (combinedText.includes("فاخر") || combinedText.includes("لوكس")) finishingLevel = "luxury";
    else if (combinedText.includes("عادي") || combinedText.includes("بسيط")) finishingLevel = "basic";
    else if (combinedText.includes("سوبر") || combinedText.includes("ممتاز")) finishingLevel = "super_luxury";

    // Number extraction (floors, rooms, age)
    const floorMatch = combinedText.match(/(\d+)\s*(طابق|دور|أدوار)/);
    const roomMatch = combinedText.match(/(\d+)\s*(غرف|غرفة)/);
    const ageMatch = combinedText.match(/(\d+)\s*(سنة|سنوات|عام)/);

    // Measurement extraction
    const areaMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*(متر|م²|م2)/g);
    if (areaMatch) {
      for (const m of areaMatch) {
        const num = parseFloat(m.match(/(\d+(?:\.\d+)?)/)?.[1] || "0");
        if (num > 0) measurements.push({ field: "مساحة", value: num, unit: "م²" });
      }
    }

    const conditionLabels: Record<string, string> = {
      excellent: "ممتاز", good: "جيد", fair: "متوسط", poor: "ضعيف",
    };
    const finishLabels: Record<string, string> = {
      luxury: "فاخر", super_luxury: "سوبر لوكس", standard: "عادي", basic: "بسيط",
    };

    const extractedData: ExtractedFieldData = {
      condition,
      finishingLevel,
      estimatedAge: ageMatch ? parseInt(ageMatch[1]) : undefined,
      floors: floorMatch ? parseInt(floorMatch[1]) : undefined,
      rooms: roomMatch ? parseInt(roomMatch[1]) : undefined,
      defects,
      notes: allNotes.slice(0, 3),
      landmarks,
      measurements,
    };

    const confidenceScore = Math.min(95, 50 + defects.length * 5 + measurements.length * 10 + (floorMatch ? 10 : 0) + (roomMatch ? 10 : 0));

    let section = "\n\n## التقاط الحقل الصوتي (المستوى 52)\n";
    section += `- الحالة: ${conditionLabels[condition]} | التشطيب: ${finishLabels[finishingLevel]}\n`;
    if (extractedData.floors) section += `- الطوابق: ${extractedData.floors}\n`;
    if (extractedData.rooms) section += `- الغرف: ${extractedData.rooms}\n`;
    if (extractedData.estimatedAge) section += `- العمر التقديري: ${extractedData.estimatedAge} سنة\n`;
    if (defects.length > 0) section += `- العيوب المكتشفة: ${defects.join("، ")}\n`;
    if (measurements.length > 0) section += `- القياسات: ${measurements.map((m) => `${m.value} ${m.unit}`).join("، ")}\n`;
    section += `- الثقة في الاستخلاص: ${confidenceScore}%\n`;

    return { section, extractedData, confidenceScore, rawTranscriptions: allNotes.length };
  } catch (e) {
    console.error("Voice field capture error:", e);
    return empty;
  }
}
