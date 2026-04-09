import { useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface MessageRatingProps {
  messageId: string;
  requestId: string;
}

export default function MessageRating({ messageId, requestId }: MessageRatingProps) {
  const [rating, setRating] = useState<"up" | "down" | null>(null);
  const [saving, setSaving] = useState(false);

  const handleRate = async (value: "up" | "down") => {
    if (saving || rating) return;
    setRating(value);
    setSaving(true);
    try {
      // Store rating as a message in metadata (lightweight approach)
      await supabase.from("request_messages" as any).insert({
        request_id: requestId,
        sender_type: "system" as any,
        content: `تقييم رد رقيم: ${value === "up" ? "👍 مفيد" : "👎 غير مفيد"}`,
        metadata: { type: "rating", rated_message_id: messageId, rating: value },
      });
    } catch {
      // Silent fail for ratings
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-1 mt-1">
      <button
        onClick={() => handleRate("up")}
        disabled={!!rating || saving}
        className={`p-0.5 rounded transition-all ${
          rating === "up"
            ? "text-primary"
            : rating
            ? "text-muted-foreground/20 cursor-default"
            : "text-muted-foreground/40 hover:text-primary cursor-pointer"
        }`}
        title="رد مفيد"
      >
        <ThumbsUp className="w-3 h-3" />
      </button>
      <button
        onClick={() => handleRate("down")}
        disabled={!!rating || saving}
        className={`p-0.5 rounded transition-all ${
          rating === "down"
            ? "text-destructive"
            : rating
            ? "text-muted-foreground/20 cursor-default"
            : "text-muted-foreground/40 hover:text-destructive cursor-pointer"
        }`}
        title="رد غير مفيد"
      >
        <ThumbsDown className="w-3 h-3" />
      </button>
    </div>
  );
}
