import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { MessageSquare, Send, CheckCircle, Clock, User, Bot, X, ArrowLeft } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { formatDistanceToNow, format } from 'date-fns';
import { useLocation, useRoute } from 'wouter';

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

type HandoffMessage = {
  id: string;
  handoffId: string;
  senderType: string;
  senderId?: string | null;
  content: string;
  timestamp: string;
};

export default function AgentChat() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [, params] = useRoute('/agent-chat/:id');
  const handoffId = params?.id;

  const [messageInput, setMessageInput] = useState('');
  const [isSending, setIsSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Fetch handoff details
  const { data: handoff, isLoading: handoffLoading } = useQuery<WidgetHandoff>({
    queryKey: [`/api/widget-handoffs/${handoffId}`],
    enabled: !!handoffId,
    refetchInterval: 3000, // Refresh every 3 seconds for status updates
  });

  // Fetch messages
  const { data: messages = [], isLoading: messagesLoading } = useQuery<HandoffMessage[]>({
    queryKey: [`/api/widget-handoffs/${handoffId}/messages`],
    enabled: !!handoffId,
    refetchInterval: 1000, // Poll every second for new messages
  });

  // Resolve handoff mutation
  const resolveMutation = useMutation({
    mutationFn: async () => {
      return await apiRequest('POST', `/api/widget-handoffs/${handoffId}/resolve`, {});
    },
    onSuccess: () => {
      toast({
        title: 'Handoff resolved',
        description: 'This conversation has been closed',
      });
      queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs/active'] });
      navigate('/agent-queue');
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to resolve handoff',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Send message mutation
  const sendMessageMutation = useMutation({
    mutationFn: async (message: string) => {
      return await apiRequest('POST', `/api/widget-handoffs/${handoffId}/send-message`, {
        message,
      });
    },
    onSuccess: () => {
      setMessageInput('');
      queryClient.invalidateQueries({
        queryKey: [`/api/widget-handoffs/${handoffId}/messages`],
      });
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to send message',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendMessage = async () => {
    const trimmedMessage = messageInput.trim();
    if (!trimmedMessage || isSending) return;

    setIsSending(true);
    try {
      await sendMessageMutation.mutateAsync(trimmedMessage);
    } finally {
      setIsSending(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Waiting
          </Badge>
        );
      case 'active':
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Active
          </Badge>
        );
      case 'resolved':
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            Resolved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderMessage = (message: HandoffMessage, index: number) => {
    const isAgent = message.senderType === 'agent';
    const isSystem = message.senderType === 'system';

    if (isSystem) {
      return (
        <div key={message.id || index} className="flex justify-center my-2">
          <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
            {message.content}
          </div>
        </div>
      );
    }

    return (
      <div
        key={message.id || index}
        className={`flex ${isAgent ? 'justify-end' : 'justify-start'} mb-4`}
      >
        <div
          className={`flex items-start gap-2 max-w-[70%] ${isAgent ? 'flex-row-reverse' : 'flex-row'}`}
        >
          <div
            className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
              isAgent ? 'bg-blue-500' : 'bg-gray-300'
            }`}
          >
            {isAgent ? (
              <User className="h-4 w-4 text-white" />
            ) : (
              <MessageSquare className="h-4 w-4 text-gray-600" />
            )}
          </div>
          <div className={`flex flex-col ${isAgent ? 'items-end' : 'items-start'}`}>
            <div
              className={`px-4 py-2 rounded-lg ${
                isAgent
                  ? 'bg-blue-500 text-white rounded-br-none'
                  : 'bg-gray-100 text-gray-900 rounded-bl-none'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap break-words">{message.content}</p>
            </div>
            <span className="text-xs text-gray-500 mt-1">
              {format(new Date(message.timestamp), 'h:mm a')}
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderAIHistoryMessage = (message: any, index: number) => {
    const isUser = message.role === 'user';

    return (
      <div
        key={`ai-${index}`}
        className={`flex ${isUser ? 'justify-start' : 'justify-end'} mb-3 opacity-60`}
      >
        <div
          className={`flex items-start gap-2 max-w-[70%] ${isUser ? 'flex-row' : 'flex-row-reverse'}`}
        >
          <div
            className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center ${
              isUser ? 'bg-gray-300' : 'bg-purple-500'
            }`}
          >
            {isUser ? (
              <MessageSquare className="h-3 w-3 text-gray-600" />
            ) : (
              <Bot className="h-3 w-3 text-white" />
            )}
          </div>
          <div className={`flex flex-col ${isUser ? 'items-start' : 'items-end'}`}>
            <div
              className={`px-3 py-2 rounded-lg text-sm ${
                isUser
                  ? 'bg-gray-50 text-gray-700 rounded-bl-none border border-gray-200'
                  : 'bg-purple-50 text-purple-900 rounded-br-none border border-purple-200'
              }`}
            >
              <p className="text-xs font-medium mb-1 uppercase tracking-wide">
                {isUser ? 'User' : 'AI Assistant'}
              </p>
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!handoffId) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <X className="h-12 w-12 mx-auto mb-3 text-red-400" />
              <p className="text-lg font-medium">Handoff not found</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (handoffLoading) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">Loading...</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!handoff) {
    return (
      <div className="container mx-auto p-6 max-w-4xl">
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-gray-500">
              <X className="h-12 w-12 mx-auto mb-3 text-red-400" />
              <p className="text-lg font-medium">Handoff not found</p>
              <Button className="mt-4" onClick={() => navigate('/agent-queue')}>
                Back to Queue
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/agent-queue')}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Queue
          </Button>
          <h1 className="text-2xl font-bold">Agent Chat</h1>
          {getStatusBadge(handoff.status)}
        </div>
        {handoff.status === 'active' && (
          <Button
            variant="destructive"
            onClick={() => resolveMutation.mutate()}
            disabled={resolveMutation.isPending}
            className="gap-2"
          >
            <CheckCircle className="h-4 w-4" />
            Resolve Chat
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chat Area */}
        <div className="lg:col-span-2">
          <Card className="h-[calc(100vh-200px)] flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg">Conversation</CardTitle>
                <div className="text-sm text-gray-500">
                  <Clock className="h-3 w-3 inline mr-1" />
                  Started {formatDistanceToNow(new Date(handoff.requestedAt), { addSuffix: true })}
                </div>
              </div>
            </CardHeader>
            <Separator />

            {/* Messages */}
            <ScrollArea className="flex-1 px-6 py-4">
              {/* AI Conversation History */}
              {handoff.conversationHistory && handoff.conversationHistory.length > 0 && (
                <div className="mb-6">
                  <div className="flex items-center gap-2 mb-4">
                    <Bot className="h-4 w-4 text-purple-500" />
                    <span className="text-sm font-medium text-gray-600">
                      Previous AI Conversation
                    </span>
                    <Separator className="flex-1" />
                  </div>
                  {handoff.conversationHistory.map((msg: any, idx: number) =>
                    renderAIHistoryMessage(msg, idx),
                  )}
                  <div className="my-6">
                    <Separator />
                    <div className="flex items-center justify-center -mt-3">
                      <span className="bg-white px-3 text-xs text-gray-500 font-medium">
                        LIVE CHAT WITH AGENT
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Live Messages */}
              {messagesLoading && messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">Loading messages...</div>
              ) : messages.length === 0 ? (
                <div className="text-center text-gray-500 py-8">
                  <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                  <p>No messages yet. Send a message to start the conversation.</p>
                </div>
              ) : (
                messages.map((msg, idx) => renderMessage(msg, idx))
              )}
              <div ref={messagesEndRef} />
            </ScrollArea>

            {/* Input Area */}
            {handoff.status === 'active' ? (
              <>
                <Separator />
                <div className="p-4">
                  <div className="flex gap-2">
                    <Textarea
                      value={messageInput}
                      onChange={(e) => setMessageInput(e.target.value)}
                      onKeyPress={handleKeyPress}
                      placeholder="Type your message..."
                      className="resize-none"
                      rows={2}
                      disabled={isSending}
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!messageInput.trim() || isSending}
                      className="self-end"
                      size="icon"
                    >
                      <Send className="h-4 w-4" />
                    </Button>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">
                    Press Enter to send, Shift+Enter for new line
                  </p>
                </div>
              </>
            ) : (
              <>
                <Separator />
                <div className="p-4 bg-gray-50 text-center text-sm text-gray-600">
                  {handoff.status === 'resolved'
                    ? 'This conversation has been resolved'
                    : 'This conversation is not active'}
                </div>
              </>
            )}
          </Card>
        </div>

        {/* Info Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Chat Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Status */}
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Status</p>
                {getStatusBadge(handoff.status)}
              </div>

              {/* Chat ID */}
              <div>
                <p className="text-sm font-medium text-gray-600 mb-1">Chat ID</p>
                <p className="text-sm font-mono text-gray-900 break-all">{handoff.chatId}</p>
              </div>

              {/* Contact Info */}
              {handoff.userEmail && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Customer Email</p>
                  <p className="text-sm text-gray-900">{handoff.userEmail}</p>
                </div>
              )}

              {/* User Message */}
              {handoff.userMessage && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Initial Request</p>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                    {handoff.userMessage}
                  </p>
                </div>
              )}

              {/* Last User Message */}
              {handoff.lastUserMessage && (
                <div>
                  <p className="text-sm font-medium text-gray-600 mb-1">Last Message</p>
                  <p className="text-sm text-gray-900 bg-gray-50 p-2 rounded">
                    {handoff.lastUserMessage}
                  </p>
                </div>
              )}

              {/* Timestamps */}
              <Separator />
              <div className="space-y-2">
                <div>
                  <p className="text-xs text-gray-500">Requested</p>
                  <p className="text-sm text-gray-900">
                    {format(new Date(handoff.requestedAt), 'PPp')}
                  </p>
                </div>
                {handoff.pickedUpAt && (
                  <div>
                    <p className="text-xs text-gray-500">Picked Up</p>
                    <p className="text-sm text-gray-900">
                      {format(new Date(handoff.pickedUpAt), 'PPp')}
                    </p>
                  </div>
                )}
                {handoff.resolvedAt && (
                  <div>
                    <p className="text-xs text-gray-500">Resolved</p>
                    <p className="text-sm text-gray-900">
                      {format(new Date(handoff.resolvedAt), 'PPp')}
                    </p>
                  </div>
                )}
              </div>

              {/* AI History Count */}
              {handoff.conversationHistory && handoff.conversationHistory.length > 0 && (
                <>
                  <Separator />
                  <div>
                    <p className="text-sm font-medium text-gray-600 mb-1">AI Conversation</p>
                    <p className="text-sm text-gray-900">
                      {handoff.conversationHistory.length} messages in history
                    </p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
