import RaqeemAnimatedLogo from "@/components/client/RaqeemAnimatedLogo";
import { AI } from "@/config/assistantIdentity";

export default function RaqeemTypingIndicator() {
  return (
    <div className="flex gap-2">
      <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0">
        <RaqeemAnimatedLogo size={28} />
      </div>
      <div className="max-w-[80%] rounded-xl px-4 py-3 text-sm bg-card border border-primary/20 text-foreground">
        <div className="flex items-center gap-1.5 mb-1.5">
          <span className="text-[10px] font-bold text-primary">{AI.typingText}</span>
        </div>
        <div className="flex items-center gap-1.5 py-1">
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:0ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:150ms]" />
          <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce [animation-delay:300ms]" />
        </div>
      </div>
    </div>
  );
}
