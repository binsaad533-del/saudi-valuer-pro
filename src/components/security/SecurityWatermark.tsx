/**
 * Dynamic Security Watermark Overlay
 * Displays user identity + timestamp + session on screen as a deterrent.
 * Cannot be removed without DOM manipulation (logged).
 */
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

interface WatermarkData {
  name: string;
  identifier: string;
  sessionId: string;
}

export default function SecurityWatermark() {
  const { user } = useAuth();
  const [data, setData] = useState<WatermarkData | null>(null);

  useEffect(() => {
    if (!user) return;

    const sessionId = crypto.randomUUID().slice(0, 8).toUpperCase();

    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name_ar, phone")
        .eq("user_id", user.id)
        .maybeSingle();

      setData({
        name: profile?.full_name_ar || user.email?.split("@")[0] || "مستخدم",
        identifier: user.email || profile?.phone || user.id.slice(0, 8),
        sessionId,
      });
    })();
  }, [user]);

  if (!data) return null;

  const now = new Date();
  const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  const watermarkText = `${data.name} | ${data.identifier} | ${dateStr} ${timeStr} | ${data.sessionId}`;

  // Generate tiled positions
  const tiles: { x: number; y: number }[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 3; col++) {
      tiles.push({
        x: 10 + col * 35,
        y: 8 + row * 18,
      });
    }
  }

  return (
    <div
      className="fixed inset-0 pointer-events-none select-none"
      style={{ zIndex: 9999 }}
      aria-hidden="true"
      data-security="watermark"
    >
      {tiles.map((pos, i) => (
        <div
          key={i}
          className="absolute whitespace-nowrap"
          style={{
            left: `${pos.x}%`,
            top: `${pos.y}%`,
            transform: "rotate(-25deg)",
            fontSize: "11px",
            fontFamily: "monospace",
            color: "rgba(0, 0, 0, 0.04)",
            letterSpacing: "0.5px",
            userSelect: "none",
            WebkitUserSelect: "none",
          }}
        >
          {watermarkText}
        </div>
      ))}
    </div>
  );
}
