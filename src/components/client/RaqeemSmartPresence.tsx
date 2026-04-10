import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import RaqeemAnimatedLogo from "./RaqeemAnimatedLogo";

/** Context map: path pattern → hint text + context key */
const CONTEXT_MAP: { pattern: RegExp; hint: string; context: string }[] = [
  { pattern: /\/client\/new-request/, hint: "ابدأ لك الطلب؟", context: "new_request" },
  { pattern: /\/client\/request\/.*\/upload/, hint: "أحتاج ملفاتك هنا", context: "upload" },
  { pattern: /\/client\/request\/.*\/payment/, hint: "باقي خطوة", context: "payment" },
  { pattern: /\/client\/request\/.*\/review/, hint: "أشرح لك التقرير؟", context: "review" },
  { pattern: /\/client\/request\//, hint: "أكملها عنك؟", context: "request_detail" },
];

function getContextForPath(pathname: string) {
  for (const entry of CONTEXT_MAP) {
    if (entry.pattern.test(pathname)) {
      return { hint: entry.hint, context: entry.context };
    }
  }
  return null;
}

export default function RaqeemSmartPresence() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showHint, setShowHint] = useState(false);
  const [hasAction, setHasAction] = useState(false);
  const lastInteraction = useRef(Date.now());
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const pulseTimerRef = useRef<ReturnType<typeof setInterval>>();
  const [pulseRing, setPulseRing] = useState(false);

  // Hide on chat pages
  const hiddenPaths = ["/client/chat", "/raqeem-chat"];
  if (hiddenPaths.some(p => location.pathname.startsWith(p))) return null;

  const ctx = getContextForPath(location.pathname);

  // Track user interaction to suppress hints
  useEffect(() => {
    const handler = () => { lastInteraction.current = Date.now(); };
    window.addEventListener("click", handler);
    window.addEventListener("keydown", handler);
    window.addEventListener("scroll", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("scroll", handler);
    };
  }, []);

  // Detect if there's an actionable context
  useEffect(() => {
    setHasAction(!!ctx);
  }, [location.pathname]);

  // Show hint periodically if context exists and user idle > 5s
  useEffect(() => {
    if (!ctx) { setShowHint(false); return; }

    const tryShowHint = () => {
      const idleTime = Date.now() - lastInteraction.current;
      if (idleTime >= 5000) {
        setShowHint(true);
        hintTimerRef.current = setTimeout(() => setShowHint(false), 3000);
      }
    };

    // Initial delay then check
    const initial = setTimeout(tryShowHint, 6000);
    const interval = setInterval(tryShowHint, 15000);

    return () => {
      clearTimeout(initial);
      clearInterval(interval);
      if (hintTimerRef.current) clearTimeout(hintTimerRef.current);
    };
  }, [location.pathname, ctx?.hint]);

  // Pulse ring every 8s
  useEffect(() => {
    pulseTimerRef.current = setInterval(() => {
      setPulseRing(true);
      setTimeout(() => setPulseRing(false), 1200);
    }, 8000);
    return () => { if (pulseTimerRef.current) clearInterval(pulseTimerRef.current); };
  }, []);

  const handleClick = useCallback(() => {
    lastInteraction.current = Date.now();
    setShowHint(false);
    const chatPath = location.pathname.startsWith("/client") ? "/client/chat" : "/raqeem-chat";
    const query = ctx ? `?context=${ctx.context}` : "";
    navigate(`${chatPath}${query}`);
  }, [navigate, location.pathname, ctx]);

  return (
    <div className="relative flex items-center">
      {/* Hint text */}
      <AnimatePresence>
        {showHint && ctx && (
          <motion.span
            initial={{ opacity: 0, x: 8 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }}
            transition={{ duration: 0.4 }}
            className="absolute left-full ml-3 whitespace-nowrap text-xs font-medium text-primary bg-primary/5 border border-primary/10 rounded-full px-3 py-1"
          >
            {ctx.hint}
          </motion.span>
        )}
      </AnimatePresence>

      {/* Main button */}
      <button
        onClick={handleClick}
        className="relative p-2 rounded-xl hover:bg-muted/60 transition-colors group"
        aria-label="رقيم"
      >
        {/* Pulse ring */}
        <AnimatePresence>
          {pulseRing && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0.5 }}
              animate={{ scale: 1.8, opacity: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute inset-0 rounded-xl border-2 border-primary/20"
            />
          )}
        </AnimatePresence>

        {/* Active glow */}
        {hasAction && (
          <div className="absolute inset-0 rounded-xl bg-primary/5 animate-pulse" style={{ animationDuration: "3s" }} />
        )}

        {/* Logo */}
        <div className="relative">
          <RaqeemAnimatedLogo size={32} />
        </div>

        {/* Action dot indicator */}
        {hasAction && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </button>
    </div>
  );
}
