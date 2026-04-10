import { useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import RaqeemAnimatedLogo from "./RaqeemAnimatedLogo";

const CONTEXT_MAP: { pattern: RegExp; message: string; context: string }[] = [
  { pattern: /\/client\/new-request/, message: "ابدأ مع رقيم", context: "new_request" },
  { pattern: /\/client\/request\/.*\/upload/, message: "خل رقيم يكملها", context: "upload" },
  { pattern: /\/client\/request\/.*\/payment/, message: "خل رقيم يكملها", context: "payment" },
  { pattern: /\/client\/request\/.*\/review/, message: "رقيم يشرحها لك", context: "review" },
  { pattern: /\/client\/request\//, message: "خل رقيم ينجزها", context: "request_detail" },
];

const DEFAULT_MESSAGE = "خل رقيم ينجزها";

function getContextForPath(pathname: string) {
  for (const entry of CONTEXT_MAP) {
    if (entry.pattern.test(pathname)) return entry;
  }
  return null;
}

export default function RaqeemSmartPresence() {
  const navigate = useNavigate();
  const location = useLocation();

  const ctx = useMemo(() => getContextForPath(location.pathname), [location.pathname]);

  const isRaqeemPage = ["/client/chat", "/raqeem-chat"].some(p =>
    location.pathname.startsWith(p)
  );

  const handleClick = useCallback(() => {
    const chatPath = location.pathname.startsWith("/client")
      ? "/client/chat"
      : "/raqeem-chat";
    const query = ctx ? `?context=${ctx.context}` : "";
    navigate(`${chatPath}${query}`);
  }, [navigate, location.pathname, ctx]);

  if (isRaqeemPage) return null;

  const displayMessage = ctx?.message || DEFAULT_MESSAGE;

  return (
    <motion.button
      onClick={handleClick}
      whileHover={{ y: -2, boxShadow: "0 8px 24px rgba(74,144,217,0.18)" }}
      whileTap={{ scale: 0.97 }}
      animate={{
        scale: [1, 1.02, 1],
      }}
      transition={{
        scale: { duration: 2.5, repeat: Infinity, repeatDelay: 11, ease: "easeInOut" },
      }}
      className="fixed bottom-6 left-6 z-50 flex items-center gap-3 cursor-pointer
        rounded-full pl-3 pr-6
        border border-primary/20
        shadow-lg transition-shadow duration-300"
      style={{
        height: 68,
        background: "linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary)/0.85) 100%)",
        boxShadow: "0 4px 20px rgba(74,144,217,0.15)",
      }}
      aria-label="رقيم"
    >
      {/* Animated logo — protrudes slightly */}
      <div
        className="relative flex items-center justify-center rounded-full bg-white shadow-md"
        style={{ width: 52, height: 52, marginRight: -4 }}
      >
        <RaqeemAnimatedLogo size={40} />
      </div>

      {/* Text */}
      <span
        className="text-sm font-medium leading-none whitespace-nowrap"
        style={{ color: "hsl(var(--primary-foreground))" }}
      >
        {displayMessage}
      </span>
    </motion.button>
  );
}
