/**
 * Level 53: Image Fraud Detection Engine
 * Detects manipulated, outdated, or internet-sourced photos
 */

interface FraudFlag {
  type: "metadata_missing" | "date_mismatch" | "gps_mismatch" | "duplicate" | "quality_issue" | "timestamp_suspicious";
  severity: "high" | "medium" | "low";
  description: string;
  photoId?: string;
}

interface ImageFraudResult {
  section: string;
  totalPhotos: number;
  flaggedPhotos: number;
  fraudFlags: FraudFlag[];
  overallTrustScore: number;
  recommendation: string;
}

export async function analyzeImageFraud(
  db: any,
  assignmentId: string | undefined
): Promise<ImageFraudResult> {
  const empty: ImageFraudResult = { section: "", totalPhotos: 0, flaggedPhotos: 0, fraudFlags: [], overallTrustScore: 100, recommendation: "" };
  if (!assignmentId) return empty;

  try {
    // Get inspection photos
    const { data: inspections } = await db
      .from("inspections")
      .select("id, inspection_date, latitude, longitude")
      .eq("assignment_id", assignmentId);

    if (!inspections?.length) return empty;

    const inspectionIds = inspections.map((i: any) => i.id);
    const { data: photos } = await db
      .from("inspection_photos")
      .select("*")
      .in("inspection_id", inspectionIds);

    if (!photos?.length) return empty;

    const fraudFlags: FraudFlag[] = [];
    let flaggedPhotos = 0;

    // Get subject location for GPS comparison
    const { data: subject } = await db
      .from("subjects")
      .select("latitude, longitude")
      .eq("assignment_id", assignmentId)
      .limit(1)
      .single();

    for (const photo of photos) {
      let photoFlagged = false;

      // 1. Check GPS data presence
      if (!photo.latitude || !photo.longitude) {
        fraudFlags.push({
          type: "metadata_missing",
          severity: "medium",
          description: `صورة "${photo.file_name}" بدون بيانات GPS`,
          photoId: photo.id,
        });
        photoFlagged = true;
      }

      // 2. Check GPS consistency with subject
      if (photo.latitude && photo.longitude && subject?.latitude && subject?.longitude) {
        const distance = haversine(photo.latitude, photo.longitude, subject.latitude, subject.longitude);
        if (distance > 1) { // More than 1km away
          fraudFlags.push({
            type: "gps_mismatch",
            severity: "high",
            description: `صورة "${photo.file_name}" ملتقطة على بُعد ${distance.toFixed(1)} كم من الموقع`,
            photoId: photo.id,
          });
          photoFlagged = true;
        }
      }

      // 3. Check timestamp vs inspection date
      if (photo.taken_at) {
        const photoDate = new Date(photo.taken_at);
        const inspection = inspections.find((i: any) => i.id === photo.inspection_id);
        if (inspection?.inspection_date) {
          const inspDate = new Date(inspection.inspection_date);
          const daysDiff = Math.abs((photoDate.getTime() - inspDate.getTime()) / 86400000);
          if (daysDiff > 30) {
            fraudFlags.push({
              type: "date_mismatch",
              severity: "high",
              description: `صورة "${photo.file_name}" ملتقطة قبل ${Math.round(daysDiff)} يوم من المعاينة`,
              photoId: photo.id,
            });
            photoFlagged = true;
          } else if (daysDiff > 7) {
            fraudFlags.push({
              type: "timestamp_suspicious",
              severity: "medium",
              description: `صورة "${photo.file_name}" ملتقطة قبل ${Math.round(daysDiff)} يوم من المعاينة`,
              photoId: photo.id,
            });
            photoFlagged = true;
          }
        }
      }

      // 4. Check for duplicate filenames (possible re-upload)
      const duplicates = photos.filter((p: any) => p.file_name === photo.file_name && p.id !== photo.id);
      if (duplicates.length > 0) {
        fraudFlags.push({
          type: "duplicate",
          severity: "medium",
          description: `صورة مكررة: "${photo.file_name}"`,
          photoId: photo.id,
        });
        photoFlagged = true;
      }

      if (photoFlagged) flaggedPhotos++;
    }

    const totalPhotos = photos.length;
    const highSeverity = fraudFlags.filter((f) => f.severity === "high").length;
    const mediumSeverity = fraudFlags.filter((f) => f.severity === "medium").length;
    const overallTrustScore = Math.max(0, 100 - highSeverity * 20 - mediumSeverity * 5);

    const recommendation = highSeverity > 0
      ? "يُوصى بإعادة المعاينة أو التحقق من الصور المشبوهة قبل الإصدار"
      : mediumSeverity > 0
      ? "يُنصح بمراجعة الصور المُعلَّمة والتأكد من مصداقيتها"
      : "الصور تجتاز فحص المصداقية";

    let section = "\n\n## كشف التلاعب بالصور (المستوى 53)\n";
    section += `- إجمالي الصور: ${totalPhotos} | مُعلَّمة: ${flaggedPhotos}\n`;
    section += `- درجة الثقة: ${overallTrustScore}%\n`;
    section += `- التوصية: ${recommendation}\n`;
    if (highSeverity > 0) section += `🔴 تنبيهات عالية: ${highSeverity}\n`;
    if (mediumSeverity > 0) section += `🟡 تنبيهات متوسطة: ${mediumSeverity}\n`;

    return { section, totalPhotos, flaggedPhotos, fraudFlags, overallTrustScore, recommendation };
  } catch (e) {
    console.error("Image fraud detection error:", e);
    return empty;
  }
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
