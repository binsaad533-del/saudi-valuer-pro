import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import RaqeemAnimatedLogo from "./RaqeemAnimatedLogo";

const CONTEXT_MAP: { pattern: RegExp; hint: string; context: string }[] = [
  { pattern: /\/client\/new-request/, hint: "ابدأ لك الطلب؟", context: "new_request" },
  { pattern: /\/client\/request\/.*\/upload/, hint: "أحتاج ملفاتك هنا", context: "upload" },
  { pattern: /\/client\/request\/.*\/payment/, hint: "باقي خطوة", context: "payment" },
  { pattern: /\/client\/request\/.*\/review/, hint: "أشرح لك التقرير؟", context: "review" },
  { pattern: /\/client\/request\//, hint: "أكملها عنك؟", context: "request_detail" },
];

function getContextForPath(pathname: string) {
  for (const entry of CONTEXT_MAP) {
    if (entry.pattern.test(pathname)) return entry;
  }
  return null;
}

export default function RaqeemSmartPresence() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showHint, setShowHint] = useState(false);
  const [pulseRing, setPulseRing] = useState(false);
  const lastInteraction = useRef(Date.now());
  const hintTimerRef = useRef<ReturnType<typeof setTimeout>>();

  const ctx = useMemo(() => getContextForPath(location.pathname), [location.pathname]);
  const hasAction = !!ctx;

  const isHidden = ["/client/chat", "/raqeem-chat"].some(p => location.pathname.startsWith(p));

  // Track user interaction
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

  // Show hint when idle > 5s and context exists
  useEffect(() => {
    if (!ctx || isHidden) { setShowHint(false); return; }
    const tryShow = () => {
      if (Date.now() - lastInteraction.current >= 5000) {
        setShowHint(true);
        hintTimerRef.current = setTimeout(() => setShowHint(false), 3000);
      }
    };
    const t1 = setTimeout(tryShow, 6000);
    const t2 = setInterval(tryShow, 15000);
    return () => { clearTimeout(t1); clearInterval(t2); if (hintTimerRef.current) clearTimeout(hintTimerRef.current); };
  }, [ctx, isHidden]);

  // Pulse ring every 8s
  useEffect(() => {
    if (isHidden) return;
    const iv = setInterval(() => {
      setPulseRing(true);
      setTimeout(() => setPulseRing(false), 1200);
    }, 8000);
    return () => clearInterval(iv);
  }, [isHidden]);

  const handleClick = useCallback(() => {
    lastInteraction.current = Date.now();
    setShowHint(false);
    const chatPath = location.pathname.startsWith("/client") ? "/client/chat" : "/raqeem-chat";
    const query = ctx ? `?context=${ctx.context}` : "";
    navigate(`${chatPath}${query}`);
  }, [navigate, location.pathname, ctx]);

  if (isHidden) return null;

  return (
    <div className="relative flex items-center">
      {/* Hint */}
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

      <button
        onClick={handleClick}
        className="relative p-2.5 rounded-xl hover:bg-muted/60 transition-colors"
        aria-label="رقيم"
      >
        {/* Pulse ring */}
        <AnimatePresence>
          {pulseRing && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0.4 }}
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

        <div className="relative">
          <RaqeemAnimatedLogo size={32} />
        </div>

        {/* Action dot */}
        {hasAction && (
          <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary animate-pulse" />
        )}
      </button>
    </div>
  );
}
