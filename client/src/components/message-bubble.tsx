import { formatDistanceToNow } from "date-fns";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { User, Bot } from "lucide-react";

type MessageBubbleProps = {
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

export function MessageBubble({ role, content, timestamp }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <div
      className={`flex gap-3 ${isUser ? "flex-row-reverse" : "flex-row"}`}
      data-testid={`message-${role}`}
    >
      <Avatar className="h-8 w-8 shrink-0">
        <AvatarFallback className={isUser ? "bg-primary text-primary-foreground" : "bg-muted"}>
          {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
        </AvatarFallback>
      </Avatar>

      <div className={`flex flex-col gap-1 max-w-2xl ${isUser ? "items-end" : "items-start"}`}>
        <div
          className={`rounded-2xl px-4 py-3 ${
            isUser
              ? "bg-primary text-primary-foreground rounded-tr-sm"
              : "bg-card border border-card-border rounded-tl-sm"
          }`}
        >
          <p className="text-base whitespace-pre-wrap break-words">
            {content}
          </p>
        </div>
        <time
          className="text-xs text-muted-foreground px-1"
          dateTime={timestamp.toISOString()}
          data-testid="message-timestamp"
        >
          {formatDistanceToNow(timestamp, { addSuffix: true })}
        </time>
      </div>
    </div>
  );
}
