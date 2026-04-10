import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import RaqeemIcon from "@/components/ui/RaqeemIcon";
import { AI } from "@/config/assistantIdentity";

export default function RaqeemFloatingButton() {
  const [isHovered, setIsHovered] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on chat pages and auth pages
  const hiddenPaths = ["/raqeem-chat", "/client/chat", "/login", "/client/auth"];
  if (hiddenPaths.includes(location.pathname)) return null;

  // Route to client chat when on client pages, owner chat otherwise
  const isClientRoute = location.pathname.startsWith("/client");
  const chatPath = isClientRoute ? "/client/chat" : "/raqeem-chat";

  return (
    <div className="fixed bottom-6 left-6 z-50">
      <AnimatePresence>
        {isHovered && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.9 }}
            className="absolute bottom-16 left-0 bg-card border border-border rounded-lg px-3 py-2 shadow-lg whitespace-nowrap"
          >
            <span className="text-xs font-medium text-foreground">
              {isClientRoute ? `${AI.title} — مركز التشغيل` : AI.title}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        onClick={() => navigate(chatPath)}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
        className="w-14 h-14 rounded-full shadow-lg hover:shadow-xl flex items-center justify-center transition-shadow bg-primary-foreground"
        aria-label={`فتح ${AI.name}`}
      >
        <RaqeemIcon size={56} className="text-primary-foreground" />
      </motion.button>
    </div>
  );
}
