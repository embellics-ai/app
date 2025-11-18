import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useLocation } from 'wouter';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Send, Bot, User, Loader2, Plus, Headphones } from 'lucide-react';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/auth-context';
import type { Message, Conversation } from '@shared/schema';

export default function Chat() {
  const [, setLocation] = useLocation();
  const { user } = useAuth();
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null);
  const [inputMessage, setInputMessage] = useState('');
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Platform admins don't have tenantId - redirect them immediately
  useEffect(() => {
    if (user?.isPlatformAdmin) {
      setLocation('/platform-admin');
    }
  }, [user, setLocation]);

  // Query for conversations to get the most recent one (with polling to detect handoff status)
  // Completely disable queries for platform admins to prevent any API calls
  const { data: conversations = [] } = useQuery<Conversation[]>({
    queryKey: ['/api/conversations'],
    refetchInterval: 3000, // Poll every 3 seconds to detect handoff status changes
    enabled: !user?.isPlatformAdmin,
  });

  // Query for messages in current conversation
  const { data: messages = [], isLoading: messagesLoading } = useQuery<Message[]>({
    queryKey: ['/api/messages', currentConversationId],
    enabled: !!currentConversationId && !user?.isPlatformAdmin,
    refetchInterval: 2000, // Poll every 2 seconds for new messages
  });

  // Get current conversation object
  const currentConversation = conversations.find((c) => c.id === currentConversationId);

  // Create conversation mutation
  const createConversation = useMutation({
    mutationFn: async () => {
      const response = await apiRequest('POST', '/api/conversations', {
        title: `Chat ${new Date().toLocaleString()}`,
      });
      return await response.json();
    },
    onSuccess: (conversation) => {
      setCurrentConversationId(conversation.id);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to create conversation',
        variant: 'destructive',
      });
    },
  });

  // End conversation and create new one
  const startNewChat = useMutation({
    mutationFn: async () => {
      // End current conversation if it exists
      if (currentConversationId) {
        await apiRequest('POST', `/api/conversations/${currentConversationId}/end`, {});
      }

      // Create new conversation
      const response = await apiRequest('POST', '/api/conversations', {
        title: `Chat ${new Date().toLocaleString()}`,
      });
      return await response.json();
    },
    onSuccess: (conversation) => {
      setCurrentConversationId(conversation.id);
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: 'New chat started',
        description: 'Previous chat has been ended',
      });
    },
    onError: () => {
      toast({
        title: 'Error',
        description: 'Failed to start new chat',
        variant: 'destructive',
      });
    },
  });

  // Send message mutation
  const sendMessage = useMutation({
    mutationFn: async (content: string) => {
      if (!currentConversationId) throw new Error('No conversation');

      const response = await apiRequest('POST', '/api/messages', {
        conversationId: currentConversationId,
        role: 'user',
        content,
      });
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/messages', currentConversationId] });
      setInputMessage('');
    },
    onError: (error: any) => {
      toast({
        title: 'Error',
        description: error.message || 'Failed to send message',
        variant: 'destructive',
      });
    },
  });

  // Request handoff to human agent mutation
  const requestHandoff = useMutation({
    mutationFn: async () => {
      if (!currentConversationId) throw new Error('No conversation');

      return apiRequest('POST', '/api/handoff/trigger', {
        conversationId: currentConversationId,
        reason: 'user_request',
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/conversations'] });
      toast({
        title: 'Requesting human agent',
        description: 'Your request has been sent. A human agent will join shortly.',
      });
    },
    onError: () => {
      toast({
        title: 'Request failed',
        description: 'Could not request human agent. Please try again.',
        variant: 'destructive',
      });
    },
  });

  // Auto-load most recent conversation or create new one
  useEffect(() => {
    // Skip all conversation logic for platform admins
    if (user?.isPlatformAdmin) return;

    if (!currentConversationId && conversations.length > 0) {
      // Use the most recent conversation
      setCurrentConversationId(conversations[0].id);
    } else if (
      !currentConversationId &&
      conversations.length === 0 &&
      !createConversation.isPending
    ) {
      // Create a new conversation if none exist
      createConversation.mutate();
    }
  }, [currentConversationId, conversations, createConversation.isPending, user]);

  // Auto-scroll to bottom when messages change
  useEffect(() => {
    if (scrollAreaRef.current) {
      const scrollContainer = scrollAreaRef.current.querySelector(
        '[data-radix-scroll-area-viewport]',
      );
      if (scrollContainer) {
        scrollContainer.scrollTop = scrollContainer.scrollHeight;
      }
    }
  }, [messages, sendMessage.isPending]);

  const handleSend = () => {
    if (!inputMessage.trim()) return;
    sendMessage.mutate(inputMessage.trim());
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Don't render anything for platform admins - they'll be redirected
  if (user?.isPlatformAdmin) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat Header */}
      <div className="border-b px-6 py-4 flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold">AI Chat</h1>
            {currentConversation?.handoffStatus === 'pending_handoff' && (
              <Badge variant="secondary" data-testid="badge-handoff-pending">
                <Loader2 className="h-3 w-3 mr-1 animate-spin" />
                Waiting for agent...
              </Badge>
            )}
            {currentConversation?.handoffStatus === 'with_human' && (
              <Badge variant="default" data-testid="badge-handoff-active">
                <Headphones className="h-3 w-3 mr-1" />
                Human Agent
              </Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {currentConversation?.handoffStatus === 'with_human'
              ? "You're now chatting with a human agent"
              : 'Powered by Retell AI Agent - Test your widget here'}
          </p>
        </div>
        <div className="flex gap-2">
          {currentConversation && currentConversation.handoffStatus === 'ai' && (
            <Button
              onClick={() => requestHandoff.mutate()}
              variant="outline"
              disabled={requestHandoff.isPending}
              data-testid="button-request-handoff"
            >
              {requestHandoff.isPending ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Headphones className="h-4 w-4 mr-2" />
              )}
              Talk to Human
            </Button>
          )}
          <Button
            onClick={() => startNewChat.mutate()}
            variant="outline"
            disabled={startNewChat.isPending}
            data-testid="button-new-chat"
          >
            {startNewChat.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Plus className="h-4 w-4 mr-2" />
            )}
            New Chat
          </Button>
        </div>
      </div>

      {/* Messages Area */}
      <ScrollArea ref={scrollAreaRef} className="flex-1 px-6 py-4">
        <div className="space-y-4 max-w-4xl mx-auto">
          {messagesLoading ? (
            <>
              <MessageSkeleton />
              <MessageSkeleton isAssistant />
            </>
          ) : messages.length === 0 ? (
            <div className="text-center py-12">
              <Bot className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Start a conversation</h3>
              <p className="text-sm text-muted-foreground">
                Send a message below to begin chatting with your AI assistant
              </p>
            </div>
          ) : (
            messages.map((message) => <MessageBubble key={message.id} message={message} />)
          )}

          {/* Typing Indicator */}
          {sendMessage.isPending && (
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Bot className="h-4 w-4 text-primary" />
              </div>
              <Card className="flex-1 px-4 py-3 bg-muted/50">
                <div className="flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">AI is thinking...</span>
                </div>
              </Card>
            </div>
          )}
        </div>
      </ScrollArea>

      {/* Input Area */}
      <div className="border-t px-6 py-4">
        <div className="max-w-4xl mx-auto flex gap-3">
          <Input
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type your message..."
            disabled={sendMessage.isPending || !currentConversationId}
            className="flex-1"
            data-testid="input-message"
          />
          <Button
            onClick={handleSend}
            disabled={sendMessage.isPending || !inputMessage.trim() || !currentConversationId}
            data-testid="button-send-message"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isAssistant = message.role === 'assistant';
  const isHuman = message.senderType === 'human';
  const isUser = message.senderType === 'user';

  // Determine sender display
  let senderName = 'AI Assistant';
  let icon = <Bot className="h-4 w-4 text-primary" />;
  let avatarBg = 'bg-primary/10';
  let cardBg = 'bg-muted/50';

  if (isHuman) {
    senderName = 'Human Agent';
    icon = <Headphones className="h-4 w-4 text-secondary-foreground" />;
    avatarBg = 'bg-secondary';
    cardBg = 'bg-secondary/20';
  } else if (isUser) {
    senderName = 'You';
    icon = <User className="h-4 w-4 text-accent-foreground" />;
    avatarBg = 'bg-accent';
    cardBg = 'bg-card';
  }

  return (
    <div className="flex items-start gap-3" data-testid={`message-${message.id}`}>
      <div
        className={`h-8 w-8 rounded-full flex items-center justify-center flex-shrink-0 ${avatarBg}`}
      >
        {icon}
      </div>
      <Card className={`flex-1 px-4 py-3 ${cardBg}`}>
        <div className="flex items-baseline gap-2 mb-1">
          <span className="text-sm font-medium">{senderName}</span>
          <span className="text-xs text-muted-foreground">
            {new Date(message.timestamp || Date.now()).toLocaleTimeString()}
          </span>
        </div>
        <p className="text-sm whitespace-pre-wrap leading-relaxed">{message.content}</p>
      </Card>
    </div>
  );
}

function MessageSkeleton({ isAssistant = false }: { isAssistant?: boolean }) {
  return (
    <div className="flex items-start gap-3">
      <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-16 w-full" />
      </div>
    </div>
  );
}
