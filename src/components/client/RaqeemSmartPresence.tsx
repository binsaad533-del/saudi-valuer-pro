import { useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import RaqeemAnimatedLogo from "./RaqeemAnimatedLogo";
import {
  RAQEEM_FLOATING_ELEMENT_ID,
  useRaqeemFloatingSingleton,
} from "@/lib/raqeem-floating-singleton";

export default function RaqeemSmartPresence() {
  const navigate = useNavigate();
  const location = useLocation();

  const isRaqeemPage = ["/client/chat", "/raqeem-chat"].some((path) =>
    location.pathname.startsWith(path)
  );

  const ctx = useMemo(() => {
    const map = [
      { pattern: /\/client\/new-request/, context: "new_request" },
      { pattern: /\/client\/request\/.*\/upload/, context: "upload" },
      { pattern: /\/client\/request\/.*\/payment/, context: "payment" },
      { pattern: /\/client\/request\/.*\/review/, context: "review" },
      { pattern: /\/client\/request\//, context: "request_detail" },
    ];

    for (const entry of map) {
      if (entry.pattern.test(location.pathname)) return entry.context;
    }

    return null;
  }, [location.pathname]);

  const canRender = useRaqeemFloatingSingleton(isRaqeemPage);

  const handleClick = useCallback(() => {
    const chatPath = location.pathname.startsWith("/client")
      ? "/client/chat"
      : "/raqeem-chat";
    const query = ctx ? `?context=${ctx}` : "";
    navigate(`${chatPath}${query}`);
  }, [ctx, location.pathname, navigate]);

  if (isRaqeemPage || !canRender) return null;

  return (
    <div id={RAQEEM_FLOATING_ELEMENT_ID} className="fixed bottom-[72px] left-6 z-50">
      <motion.span
        className="absolute inset-0 rounded-full pointer-events-none"
        style={{ border: "2px solid hsl(var(--primary)/0.12)" }}
        animate={{ scale: [1, 1.3, 1.3], opacity: [0.35, 0, 0] }}
        transition={{ duration: 1.6, repeat: Infinity, repeatDelay: 12, ease: "easeOut" }}
      />

      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.06 }}
        whileTap={{ scale: 0.95 }}
        className="relative flex h-14 w-14 items-center justify-center rounded-full border border-border bg-card cursor-pointer"
        style={{ boxShadow: "0 4px 12px rgba(0,0,0,0.08)" }}
        aria-label="رقيم"
      >
        <RaqeemAnimatedLogo size={36} />
      </motion.button>
    </div>
  );
}
