import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Send, X, CheckCircle, User, Bot, Headphones } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow } from 'date-fns';

type WidgetHandoffMessage = {
  id: string;
  handoffId: string;
  senderType: string; // 'user', 'agent', 'system'
  senderId?: string | null;
  content: string;
  timestamp: string;
};

type WidgetHandoff = {
  id: string;
  chatId: string;
  tenantId: string;
  status: string;
  requestedAt: string;
  pickedUpAt?: string | null;
  resolvedAt?: string | null;
  assignedAgentId?: string | null;
  userEmail?: string | null;
  userMessage?: string | null;
  conversationHistory?: any[];
  lastUserMessage?: string | null;
  metadata?: any;
};

type HumanAgent = {
  id: string;
  name: string;
  email: string;
  status: string;
};

interface AgentChatInterfaceProps {
  conversationId: string;
  onClose: () => void;
  readOnly?: boolean; // For Client Admin view (no send/complete actions)
}

export function AgentChatInterface({
  conversationId,
  onClose,
  readOnly = false,
}: AgentChatInterfaceProps) {
  const { toast } = useToast();
  const [message, setMessage] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Fetch handoff details
  const { data: handoff } = useQuery<WidgetHandoff>({
    queryKey: ['/api/widget-handoffs', conversationId],
  });

  // Fetch messages for this handoff
  const { data: messages = [], isLoading: messagesLoading } = useQuery<WidgetHandoffMessage[]>({
    queryKey: ['/api/widget-handoffs', conversationId, 'messages'],
    refetchInterval: 2000, // Poll every 2 seconds for new messages
  });

  // Fetch agents to get current agent name
  const { data: agents = [] } = useQuery<HumanAgent[]>({
    queryKey: ['/api/human-agents'],
  });

  const currentAgent = agents.find((a) => a.id === handoff?.assignedAgentId);

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (content: string) => {
      if (!handoff?.assignedAgentId) {
        throw new Error('No agent assigned');
      }
      return apiRequest('POST', `/api/widget-handoffs/${conversationId}/send-message`, {
        message: content,
      });
    },
    onSuccess: () => {
      setMessage('');
      queryClient.invalidateQueries({
        queryKey: ['/api/widget-handoffs', conversationId, 'messages'],
      });
      toast({
        title: 'Message sent',
        description: 'Your message has been delivered',
      });
    },
    onError: () => {
      toast({
        title: 'Failed to send message',
        description: 'Could not deliver your message',
        variant: 'destructive',
      });
    },
  });

  // Complete handoff mutation
  const completeMutation = useMutation({
    mutationFn: async () => {
      if (!handoff?.assignedAgentId) {
        throw new Error('No agent assigned');
      }
      return apiRequest('POST', `/api/widget-handoffs/${conversationId}/resolve`, {});
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs'] });
      queryClient.invalidateQueries({ queryKey: ['/api/human-agents'] });
      toast({
        title: 'Conversation completed',
        description: 'The handoff has been marked as complete',
      });
      onClose();
    },
    onError: () => {
      toast({
        title: 'Failed to complete',
        description: 'Could not complete the handoff',
        variant: 'destructive',
      });
    },
  });

  const handleSend = () => {
    if (!message.trim()) return;
    sendMessageMutation.mutate(message);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const getSenderIcon = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return <User className="h-4 w-4" />;
      case 'agent':
        return <Headphones className="h-4 w-4" />;
      case 'system':
        return <Bot className="h-4 w-4" />;
      default:
        return <User className="h-4 w-4" />;
    }
  };

  const getSenderLabel = (senderType: string) => {
    switch (senderType) {
      case 'user':
        return 'Customer';
      case 'agent':
        return currentAgent?.name || 'Agent';
      case 'system':
        return 'System';
      default:
        return 'Unknown';
    }
  };

  return (
    <Card className="h-[600px] flex flex-col" data-testid="card-agent-chat">
      <CardHeader className="border-b">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <CardTitle className="text-lg" data-testid="text-chat-title">
              {currentAgent?.name || 'Agent'} &{' '}
              {handoff?.userEmail || handoff?.metadata?.phoneNumber || 'Customer'}
            </CardTitle>
            <CardDescription className="flex items-center gap-2 mt-1">
              {handoff?.lastUserMessage && (
                <span className="text-xs italic">
                  "{handoff.lastUserMessage.slice(0, 60)}
                  {handoff.lastUserMessage.length > 60 ? '...' : ''}"
                </span>
              )}
            </CardDescription>
          </div>
        </div>

        {/* Last User Message Context */}
        {handoff?.lastUserMessage && handoff.lastUserMessage.length > 60 && (
          <div className="mt-4">
            <h4 className="text-sm font-medium mb-2">Last Message</h4>
            <div
              className="text-sm text-muted-foreground bg-muted p-3 rounded-md"
              data-testid="text-chat-summary"
            >
              {handoff.lastUserMessage}
            </div>
          </div>
        )}
      </CardHeader>

      {/* Messages Area */}
      <CardContent className="flex-1 p-0 overflow-hidden">
        <ScrollArea className="h-full" ref={scrollRef}>
          <div className="p-4 space-y-4" data-testid="container-messages">
            {messagesLoading ? (
              <div className="text-center text-muted-foreground" data-testid="loading-messages">
                Loading messages...
              </div>
            ) : messages.length === 0 ? (
              <div className="text-center text-muted-foreground" data-testid="text-no-messages">
                No messages yet
              </div>
            ) : (
              messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.senderType === 'user' ? 'flex-row-reverse' : ''}`}
                  data-testid={`message-${msg.id}`}
                >
                  <div
                    className={`flex-shrink-0 h-8 w-8 rounded-full flex items-center justify-center ${
                      msg.senderType === 'user'
                        ? 'bg-primary text-primary-foreground'
                        : msg.senderType === 'human'
                          ? 'bg-secondary text-secondary-foreground'
                          : 'bg-muted text-muted-foreground'
                    }`}
                    data-testid={`avatar-${msg.senderType}`}
                  >
                    {getSenderIcon(msg.senderType)}
                  </div>
                  <div className="flex-1 max-w-[75%]">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-medium" data-testid={`sender-label-${msg.id}`}>
                        {getSenderLabel(msg.senderType)}
                      </span>
                      <span
                        className="text-xs text-muted-foreground"
                        data-testid={`timestamp-${msg.id}`}
                      >
                        {formatDistanceToNow(new Date(msg.timestamp), {
                          addSuffix: true,
                        })}
                      </span>
                    </div>
                    <div
                      className={`rounded-2xl px-4 py-3 text-sm ${
                        msg.senderType === 'user'
                          ? 'bg-primary text-primary-foreground rounded-tr-sm'
                          : 'bg-muted text-foreground rounded-tl-sm'
                      }`}
                      data-testid={`content-${msg.id}`}
                    >
                      {msg.content}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CardContent>

      {/* Input Area - Only show for agents, not for read-only (Client Admin) view */}
      {!readOnly && (
        <div className="border-t p-4">
          <div className="flex gap-2 mb-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => completeMutation.mutate()}
              disabled={completeMutation.isPending}
              data-testid="button-complete-chat"
            >
              <CheckCircle className="h-4 w-4 mr-1" />
              Complete Handoff
            </Button>
          </div>
          <div className="flex gap-2">
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Type your message..."
              className="resize-none"
              rows={3}
              disabled={sendMessageMutation.isPending}
              data-testid="input-message"
            />
            <Button
              size="icon"
              onClick={handleSend}
              disabled={!message.trim() || sendMessageMutation.isPending}
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
