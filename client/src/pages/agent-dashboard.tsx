import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { Users, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { AgentChatInterface } from '@/components/agent-chat-interface';

type HumanAgent = {
  id: string;
  name: string;
  email: string;
  status: string;
  activeChats: number;
  maxChats: number;
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

export default function AgentDashboard() {
  const { toast } = useToast();
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null);
  const [chatDialogOpen, setChatDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('pending');

  // Fetch all human agents with auto-refresh
  const { data: agents = [], isLoading: agentsLoading } = useQuery<HumanAgent[]>({
    queryKey: ['/api/human-agents'],
    refetchInterval: 5000, // Refresh every 5 seconds for agent status
  });

  // Fetch pending handoffs with auto-refresh every 3 seconds
  const { data: pendingHandoffs = [], isLoading: pendingLoading } = useQuery<WidgetHandoff[]>({
    queryKey: ['/api/widget-handoffs/pending'],
    refetchInterval: 3000, // Refresh every 3 seconds for new handoffs
  });

  // Fetch ALL active handoffs for tenant (all agents) with auto-refresh
  const { data: activeChats = [], isLoading: activeChatsLoading } = useQuery<WidgetHandoff[]>({
    queryKey: ['/api/widget-handoffs/active'],
    refetchInterval: 3000, // Refresh every 3 seconds for status updates
  });

  // Fetch all handoffs for history (resolved conversations)
  const { data: allHandoffs = [], isLoading: allHandoffsLoading } = useQuery<WidgetHandoff[]>({
    queryKey: ['/api/widget-handoffs'],
    refetchInterval: 5000, // Refresh every 5 seconds
  });

  // Refetch history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs'] });
    }
  }, [activeTab]);

  // Assign handoff mutation
  const assignMutation = useMutation({
    mutationFn: async ({
      conversationId,
      humanAgentId,
    }: {
      conversationId: string;
      humanAgentId: string;
    }) => {
      return apiRequest('POST', '/api/handoff/assign', { conversationId, humanAgentId });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/handoff/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/handoff/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/human-agents'] });
      toast({
        title: 'Handoff assigned',
        description: "You've been assigned to this conversation",
      });
    },
    onError: () => {
      toast({
        title: 'Assignment failed',
        description: 'Could not assign handoff',
        variant: 'destructive',
      });
    },
  });

  const handleClaimHandoff = (conversationId: string, agentId: string) => {
    assignMutation.mutate({ conversationId, humanAgentId: agentId });
  };

  const handleOpenChat = (conversationId: string) => {
    setSelectedConversation(conversationId);
    setChatDialogOpen(true);
  };

  const handleCloseChat = () => {
    setChatDialogOpen(false);
    setSelectedConversation(null);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'available':
        return 'default';
      case 'busy':
        return 'secondary';
      case 'offline':
        return 'outline';
      default:
        return 'outline';
    }
  };

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-semibold" data-testid="text-page-title">
            Agent Dashboard
          </h1>
          <p className="text-sm text-muted-foreground" data-testid="text-page-description">
            Manage human agent handoffs and live conversations
          </p>
        </div>

        {/* Agents Overview */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card data-testid="card-total-agents">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Total Agents</CardTitle>
              <Users className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-total-agents">
                {agents.length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-available-agents">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Available</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-available-agents">
                {agents.filter((a) => a.status === 'available').length}
              </div>
            </CardContent>
          </Card>

          <Card data-testid="card-pending-handoffs">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 gap-2">
              <CardTitle className="text-sm font-medium">Pending Handoffs</CardTitle>
              <AlertCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="text-pending-count">
                {pendingHandoffs.length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs
          defaultValue="pending"
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList data-testid="tabs-handoff">
            <TabsTrigger value="pending" data-testid="tab-pending">
              Pending Handoffs
              {pendingHandoffs.length > 0 && (
                <Badge variant="secondary" className="ml-2" data-testid="badge-pending-count">
                  {pendingHandoffs.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="active" data-testid="tab-active">
              Active Chats
              {activeChats.length > 0 && (
                <Badge variant="secondary" className="ml-2" data-testid="badge-active-count">
                  {activeChats.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" data-testid="tab-history">
              History
            </TabsTrigger>
            <TabsTrigger value="agents" data-testid="tab-agents">
              Agents
            </TabsTrigger>
          </TabsList>

          {/* Pending Handoffs Tab */}
          <TabsContent value="pending" className="space-y-4">
            {pendingLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-pending">
                Loading pending handoffs...
              </div>
            ) : pendingHandoffs.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground" data-testid="text-no-pending">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No pending handoffs</p>
                    <p className="text-sm">
                      Conversations will appear here when users request human support
                    </p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {pendingHandoffs.map((conversation) => (
                  <Card key={conversation.id} data-testid={`card-handoff-${conversation.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <CardTitle
                            className="text-base"
                            data-testid={`text-conversation-${conversation.id}`}
                          >
                            Conversation {conversation.id.slice(0, 8)}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            {conversation.requestedAt
                              ? formatDistanceToNow(new Date(conversation.requestedAt), {
                                  addSuffix: true,
                                })
                              : 'Just now'}
                          </CardDescription>
                        </div>
                        <Badge variant="secondary" data-testid={`badge-reason-${conversation.id}`}>
                          {conversation.userMessage ? 'User Message' : 'Handoff Requested'}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Last User Message */}
                      {conversation.lastUserMessage && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Last Message</h4>
                          <div
                            className="text-sm text-muted-foreground bg-muted p-3 rounded-md"
                            data-testid={`text-summary-${conversation.id}`}
                          >
                            {conversation.lastUserMessage}
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        {agents
                          .filter(
                            (agent) =>
                              agent.status === 'available' && agent.activeChats < agent.maxChats,
                          )
                          .map((agent) => (
                            <Button
                              key={agent.id}
                              size="sm"
                              onClick={() => handleClaimHandoff(conversation.id, agent.id)}
                              disabled={assignMutation.isPending}
                              data-testid={`button-assign-${agent.id}-${conversation.id}`}
                            >
                              Assign to {agent.name}
                            </Button>
                          ))}
                        {agents.filter(
                          (agent) =>
                            agent.status === 'available' && agent.activeChats < agent.maxChats,
                        ).length === 0 && (
                          <p
                            className="text-sm text-muted-foreground"
                            data-testid="text-no-available-agents"
                          >
                            No available agents
                          </p>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* Active Chats Tab */}
          <TabsContent value="active" className="space-y-4">
            {activeChatsLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-active">
                Loading active chats...
              </div>
            ) : activeChats.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground" data-testid="text-no-active">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No active chats</p>
                    <p className="text-sm">Claimed conversations will appear here</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4">
                {activeChats.map((conversation) => (
                  <Card key={conversation.id} data-testid={`card-active-${conversation.id}`}>
                    <CardHeader>
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 space-y-1">
                          <CardTitle
                            className="text-base"
                            data-testid={`text-active-conversation-${conversation.id}`}
                          >
                            Conversation {conversation.id.slice(0, 8)}
                          </CardTitle>
                          <CardDescription className="flex items-center gap-2">
                            <Clock className="h-3 w-3" />
                            Active since{' '}
                            {conversation.pickedUpAt
                              ? formatDistanceToNow(new Date(conversation.pickedUpAt), {
                                  addSuffix: true,
                                })
                              : 'recently'}
                          </CardDescription>
                        </div>
                        <Badge
                          variant="default"
                          data-testid={`badge-active-status-${conversation.id}`}
                        >
                          In Progress
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {/* Last User Message */}
                      {conversation.lastUserMessage && (
                        <div>
                          <h4 className="text-sm font-medium mb-2">Context</h4>
                          <div
                            className="text-sm text-muted-foreground bg-muted p-3 rounded-md"
                            data-testid={`text-active-summary-${conversation.id}`}
                          >
                            {conversation.lastUserMessage}
                          </div>
                        </div>
                      )}

                      <Separator />

                      {/* Agent Assignment Info */}
                      {conversation.assignedAgentId && (
                        <div className="flex items-center gap-2 text-sm">
                          <span className="text-muted-foreground">Assigned to:</span>
                          <span
                            className="font-medium"
                            data-testid={`text-assigned-agent-${conversation.id}`}
                          >
                            {agents.find((a) => a.id === conversation.assignedAgentId)?.name ||
                              'Unknown Agent'}
                          </span>
                        </div>
                      )}

                      <Separator />

                      {/* Action Buttons */}
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenChat(conversation.id)}
                          data-testid={`button-view-chat-${conversation.id}`}
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          View Chat
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-4">
            {allHandoffsLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-history">
                Loading history...
              </div>
            ) : allHandoffs.filter((h) => h.status === 'resolved').length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground" data-testid="text-no-history">
                    <MessageSquare className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No resolved conversations</p>
                    <p className="text-sm">Completed conversations will appear here</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <ScrollArea className="h-[600px]">
                <div className="grid gap-4 pr-4">
                  {allHandoffs
                    .filter((h) => h.status === 'resolved')
                    .slice(0, 50)
                    .map((conversation) => (
                      <Card key={conversation.id} data-testid={`card-history-${conversation.id}`}>
                        <CardHeader>
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1 space-y-1">
                              <CardTitle
                                className="text-base"
                                data-testid={`text-history-conversation-${conversation.id}`}
                              >
                                Conversation {conversation.id.slice(0, 8)}
                              </CardTitle>
                              <CardDescription className="flex items-center gap-2">
                                <Clock className="h-3 w-3" />
                                Resolved{' '}
                                {conversation.resolvedAt
                                  ? formatDistanceToNow(new Date(conversation.resolvedAt), {
                                      addSuffix: true,
                                    })
                                  : conversation.requestedAt
                                    ? formatDistanceToNow(new Date(conversation.requestedAt), {
                                        addSuffix: true,
                                      })
                                    : 'recently'}
                              </CardDescription>
                            </div>
                            <Badge
                              variant="outline"
                              className="bg-green-50 text-green-700 border-green-200"
                              data-testid={`badge-history-status-${conversation.id}`}
                            >
                              Resolved
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                          {/* Last User Message */}
                          {conversation.lastUserMessage && (
                            <div>
                              <h4 className="text-sm font-medium mb-2">Last Message</h4>
                              <div
                                className="text-sm text-muted-foreground bg-muted p-3 rounded-md"
                                data-testid={`text-history-summary-${conversation.id}`}
                              >
                                {conversation.lastUserMessage}
                              </div>
                            </div>
                          )}

                          {/* Agent Assignment Info */}
                          {conversation.assignedAgentId && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Handled by:</span>
                              <span
                                className="font-medium"
                                data-testid={`text-history-agent-${conversation.id}`}
                              >
                                {agents.find((a) => a.id === conversation.assignedAgentId)?.name ||
                                  'Unknown Agent'}
                              </span>
                            </div>
                          )}

                          {/* User Email */}
                          {conversation.userEmail && (
                            <div className="flex items-center gap-2 text-sm">
                              <span className="text-muted-foreground">Customer:</span>
                              <span className="font-medium">{conversation.userEmail}</span>
                            </div>
                          )}

                          <Separator />

                          {/* View Chat Button */}
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleOpenChat(conversation.id)}
                              data-testid={`button-view-history-${conversation.id}`}
                            >
                              <MessageSquare className="h-4 w-4 mr-1" />
                              View Chat
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                </div>
              </ScrollArea>
            )}
          </TabsContent>

          {/* Agents Tab */}
          <TabsContent value="agents" className="space-y-4">
            {agentsLoading ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="loading-agents">
                Loading agents...
              </div>
            ) : agents.length === 0 ? (
              <Card>
                <CardContent className="py-8">
                  <div className="text-center text-muted-foreground" data-testid="text-no-agents">
                    <Users className="h-12 w-12 mx-auto mb-2 opacity-50" />
                    <p>No agents configured</p>
                    <p className="text-sm">Add human agents to handle live support conversations</p>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <div className="grid gap-4 md:grid-cols-2">
                {agents.map((agent) => (
                  <Card key={agent.id} data-testid={`card-agent-${agent.id}`}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <div>
                          <CardTitle
                            className="text-base"
                            data-testid={`text-agent-name-${agent.id}`}
                          >
                            {agent.name}
                          </CardTitle>
                          <CardDescription data-testid={`text-agent-email-${agent.id}`}>
                            {agent.email}
                          </CardDescription>
                        </div>
                        <Badge
                          variant={getStatusBadgeVariant(agent.status)}
                          data-testid={`badge-status-${agent.id}`}
                        >
                          {agent.status}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Active Chats</span>
                        <span className="font-medium" data-testid={`text-active-chats-${agent.id}`}>
                          {agent.activeChats} / {agent.maxChats}
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>

        {/* Chat Dialog - Read-only for Client Admin (no send/complete actions) */}
        <Dialog open={chatDialogOpen} onOpenChange={setChatDialogOpen}>
          <DialogContent className="max-w-4xl p-0" data-testid="dialog-chat">
            {selectedConversation && (
              <AgentChatInterface
                conversationId={selectedConversation}
                onClose={handleCloseChat}
                readOnly={true}
              />
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
