import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import { AI } from "@/config/assistantIdentity";
import {
  RAQEEM_FLOATING_ELEMENT_ID,
  useRaqeemFloatingSingleton,
} from "@/lib/raqeem-floating-singleton";

export default function RaqeemFloatingButton() {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const isClientRoute = location.pathname.startsWith("/client");
  const hiddenPaths = ["/raqeem-chat", "/login", "/client/auth"];
  const shouldHide = isClientRoute || hiddenPaths.includes(location.pathname);
  const canRender = useRaqeemFloatingSingleton(shouldHide);

  if (shouldHide || !canRender) return null;

  return (
    <div id={RAQEEM_FLOATING_ELEMENT_ID} className="fixed bottom-6 left-6 z-50">
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            className="absolute bottom-16 left-0 whitespace-nowrap rounded-lg border border-border bg-card px-3 py-2 shadow-lg"
          >
            <span className="text-xs font-medium text-foreground">{AI.title}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => navigate("/raqeem-chat")}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-primary-foreground transition-shadow shadow-lg hover:shadow-xl"
        aria-label={`فتح ${AI.name}`}
      >
        <RaqeemIcon size={56} className="text-primary-foreground" />
      </motion.button>
    </div>
  );
}
