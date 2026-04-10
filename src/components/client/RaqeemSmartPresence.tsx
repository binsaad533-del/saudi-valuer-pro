import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import RaqeemAnimatedLogo from "./RaqeemAnimatedLogo";

function getContextForPath(pathname: string) {
  const map = [
    { pattern: /\/client\/new-request/, context: "new_request" },
    { pattern: /\/client\/request\/.*\/upload/, context: "upload" },
    { pattern: /\/client\/request\/.*\/payment/, context: "payment" },
    { pattern: /\/client\/request\/.*\/review/, context: "review" },
    { pattern: /\/client\/request\//, context: "request_detail" },
  ];
  for (const entry of map) {
    if (entry.pattern.test(pathname)) return entry.context;
  }
  return null;
}

export default function RaqeemSmartPresence() {
  const navigate = useNavigate();
  const location = useLocation();
  const [showBubble, setShowBubble] = useState(false);
  const [bubbleShown, setBubbleShown] = useState(false);

  const ctx = useMemo(() => getContextForPath(location.pathname), [location.pathname]);

  const isRaqeemPage = ["/client/chat", "/raqeem-chat"].some(p =>
    location.pathname.startsWith(p)
  );

  useEffect(() => {
    if (isRaqeemPage || bubbleShown) return;
    const t = setTimeout(() => {
      setShowBubble(true);
      setBubbleShown(true);
      setTimeout(() => setShowBubble(false), 2000);
    }, 1500);
    return () => clearTimeout(t);
  }, [isRaqeemPage, bubbleShown]);

  const handleClick = useCallback(() => {
    const chatPath = location.pathname.startsWith("/client")
      ? "/client/chat"
      : "/raqeem-chat";
    const query = ctx ? `?context=${ctx}` : "";
    navigate(`${chatPath}${query}`);
  }, [navigate, location.pathname, ctx]);

  if (isRaqeemPage) return null;

  return (
    <div className="relative">
      <AnimatePresence>
        {showBubble && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.3 }}
            className="absolute top-full mt-1 right-1/2 translate-x-1/2 whitespace-nowrap
              text-[11px] font-medium px-3 py-1.5 rounded-lg
              bg-primary/10 text-primary border border-primary/15 z-50"
          >
            رقيم ينفذ طلبك
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={handleClick}
        whileHover={{ scale: 1.08 }}
        whileTap={{ scale: 0.95 }}
        className="relative w-10 h-10 flex items-center justify-center rounded-full
          hover:bg-muted/60 cursor-pointer transition-colors"
        aria-label="رقيم"
      >
        <RaqeemAnimatedLogo size={32} />
      </motion.button>
    </div>
  );
}
