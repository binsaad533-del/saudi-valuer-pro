import { useNavigate, useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { MessageSquare } from "lucide-react";
import RaqeemAnimatedLogo from "./RaqeemAnimatedLogo";

export default function RaqeemFixedButton() {
  const navigate = useNavigate();
  const location = useLocation();

  // Hide on chat page itself
  if (location.pathname === "/client/chat") return null;

  return (
    <div className="fixed bottom-6 left-6 z-50" dir="rtl">
      <Button
        onClick={() => navigate("/client/chat")}
        size="lg"
        className="rounded-full shadow-lg gap-2 px-5 h-12 text-sm font-bold"
      >
        <RaqeemAnimatedLogo size={22} />
        خل رقيم يساعدك
      </Button>
    </div>
  );
}
