import { useQuery } from "@tanstack/react-query";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Bot, Calendar, BarChart3 } from "lucide-react";
import { useLocation } from "wouter";
import type { Conversation } from "@shared/schema";

type ChatSidebarProps = {
  currentConversationId?: string | null;
  onConversationSelect?: (id: string) => void;
};

export function ChatSidebar({
  currentConversationId,
  onConversationSelect,
}: ChatSidebarProps) {
  const [location, setLocation] = useLocation();

  // Query for all conversations
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ["/api/conversations"],
  });

  return (
    <Sidebar>
      <SidebarHeader className="border-b px-4 py-3">
        <div className="flex items-center gap-2">
          <MessageSquare className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Embellics</h2>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent className="px-3 py-2">
            <div className="space-y-1">
              <Button
                variant={location === "/" ? "secondary" : "ghost"}
                className="w-full justify-start hover-elevate"
                onClick={() => setLocation("/")}
                data-testid="nav-chat"
              >
                <MessageSquare className="h-4 w-4 mr-2" />
                Chat
              </Button>
              <Button
                variant={location === "/analytics" ? "secondary" : "ghost"}
                className="w-full justify-start hover-elevate"
                onClick={() => setLocation("/analytics")}
                data-testid="nav-analytics"
              >
                <BarChart3 className="h-4 w-4 mr-2" />
                Analytics
              </Button>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>About</SidebarGroupLabel>
          <SidebarGroupContent className="px-4 py-3">
            <div className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  A custom AI chat interface built with OpenAI integration. All
                  conversations are saved to PostgreSQL for history and
                  analytics.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="secondary" className="text-xs">
                  <Bot className="h-3 w-3 mr-1" />
                  OpenAI
                </Badge>
                <Badge variant="secondary" className="text-xs">
                  PostgreSQL
                </Badge>
              </div>
            </div>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>
            Recent Conversations ({conversations.length})
          </SidebarGroupLabel>
          <SidebarGroupContent className="px-3 py-2">
            {conversations.length === 0 ? (
              <div className="text-center py-8 px-4">
                <MessageSquare className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
                <p className="text-xs text-muted-foreground">
                  No conversations yet
                </p>
              </div>
            ) : (
              <div className="space-y-1">
                {conversations.slice(0, 10).map((conversation) => (
                  <Button
                    key={conversation.id}
                    variant={
                      currentConversationId === conversation.id
                        ? "secondary"
                        : "ghost"
                    }
                    className="w-full justify-start text-left hover-elevate"
                    onClick={() => onConversationSelect?.(conversation.id)}
                    data-testid={`conversation-${conversation.id}`}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">
                        {conversation.title}
                      </div>
                      {conversation.createdAt && (
                        <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                          <Calendar className="h-3 w-3" />
                          {new Date(
                            conversation.createdAt
                          ).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </Button>
                ))}
              </div>
            )}
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel>Features</SidebarGroupLabel>
          <SidebarGroupContent className="px-4 py-3">
            <ul className="text-xs text-muted-foreground space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Real-time AI responses using OpenAI</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Persistent conversation history</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>PostgreSQL database storage</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-primary mt-0.5">✓</span>
                <span>Powered by OpenAI & Retell AI</span>
              </li>
            </ul>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
    </Sidebar>
  );
}
