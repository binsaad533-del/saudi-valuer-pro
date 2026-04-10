import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import RaqeemAnimatedLogo from "./RaqeemAnimatedLogo";

const CONTEXT_MAP: { pattern: RegExp; message: string; context: string }[] = [
  { pattern: /\/client\/new-request/, message: "ابدأ طلبك الآن", context: "new_request" },
  { pattern: /\/client\/request\/.*\/upload/, message: "ارفع ملفاتك هنا", context: "upload" },
  { pattern: /\/client\/request\/.*\/payment/, message: "باقي خطوة", context: "payment" },
  { pattern: /\/client\/request\/.*\/review/, message: "أشرح لك التقرير؟", context: "review" },
  { pattern: /\/client\/request\//, message: "أكملها عنك؟", context: "request_detail" },
];

const INTRO_MESSAGE = "أنا رقيم… أنفذ طلبك بالكامل";

function getContextForPath(pathname: string) {
  for (const entry of CONTEXT_MAP) {
    if (entry.pattern.test(pathname)) return entry;
  }
  return null;
}

export default function RaqeemSmartPresence() {
  const navigate = useNavigate();
  const location = useLocation();
  const [stripVisible, setStripVisible] = useState(false);
  const [stripMessage, setStripMessage] = useState("");
  const [isFirstShow, setIsFirstShow] = useState(true);
  const lastInteraction = useRef(Date.now());
  const stripTimerRef = useRef<ReturnType<typeof setTimeout>>();
  const loopRef = useRef<ReturnType<typeof setInterval>>();

  const ctx = useMemo(() => getContextForPath(location.pathname), [location.pathname]);

  const isRaqeemPage = ["/client/chat", "/raqeem-chat"].some(p =>
    location.pathname.startsWith(p)
  );

  // Track user interaction
  useEffect(() => {
    const handler = () => {
      lastInteraction.current = Date.now();
    };
    window.addEventListener("click", handler);
    window.addEventListener("keydown", handler);
    window.addEventListener("scroll", handler);
    return () => {
      window.removeEventListener("click", handler);
      window.removeEventListener("keydown", handler);
      window.removeEventListener("scroll", handler);
    };
  }, []);

  // Show strip logic
  const showStrip = useCallback(() => {
    if (isRaqeemPage) return;
    if (Date.now() - lastInteraction.current < 5000) return;

    // Check if user is typing or modal is open
    const activeEl = document.activeElement;
    if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA")) return;
    if (document.querySelector("[role='dialog']")) return;

    const msg = isFirstShow ? INTRO_MESSAGE : (ctx?.message || "أكملها عنك؟");
    setStripMessage(msg);
    setStripVisible(true);
    if (isFirstShow) setIsFirstShow(false);

    stripTimerRef.current = setTimeout(() => {
      setStripVisible(false);
    }, 3000);
  }, [ctx, isFirstShow, isRaqeemPage]);

  // Loop
  useEffect(() => {
    if (isRaqeemPage) {
      setStripVisible(false);
      return;
    }

    // Initial show after 4s
    const initialTimer = setTimeout(showStrip, 4000);

    // Repeat every 15s
    loopRef.current = setInterval(showStrip, 15000);

    return () => {
      clearTimeout(initialTimer);
      if (loopRef.current) clearInterval(loopRef.current);
      if (stripTimerRef.current) clearTimeout(stripTimerRef.current);
    };
  }, [showStrip, isRaqeemPage]);

  // Reset first show on route change
  useEffect(() => {
    setIsFirstShow(true);
  }, [location.pathname]);

  const handleClick = useCallback(() => {
    lastInteraction.current = Date.now();
    setStripVisible(false);
    const chatPath = location.pathname.startsWith("/client")
      ? "/client/chat"
      : "/raqeem-chat";
    const query = ctx ? `?context=${ctx.context}` : "";
    navigate(`${chatPath}${query}`);
  }, [navigate, location.pathname, ctx]);

  if (isRaqeemPage) return null;

  return (
    <div className="relative flex items-center">
      <button
        onClick={handleClick}
        className="relative p-2 rounded-xl hover:bg-muted/60 transition-colors z-10"
        aria-label="رقيم"
      >
        <RaqeemAnimatedLogo size={32} />
      </button>

      {/* Smart Strip */}
      <AnimatePresence>
        {stripVisible && (
          <motion.div
            initial={{ opacity: 0, x: 20, scaleX: 0.3 }}
            animate={{ opacity: 1, x: 0, scaleX: 1 }}
            exit={{ opacity: 0, x: 16, scaleX: 0.5 }}
            transition={{ duration: 0.4, ease: "easeOut" }}
            style={{ transformOrigin: "right center" }}
            onClick={handleClick}
            className="absolute left-full mr-1 cursor-pointer flex items-center gap-2 whitespace-nowrap
              h-9 px-4 rounded-lg
              bg-foreground/90 text-background
              border border-destructive/20
              shadow-lg shadow-destructive/5"
          >
            {/* Red pulse dot */}
            <span className="relative flex h-2 w-2 shrink-0">
              <span className="absolute inline-flex h-full w-full rounded-full bg-destructive/60 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-destructive/80" />
            </span>

            <span className="text-xs font-medium leading-none">
              {stripMessage}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
