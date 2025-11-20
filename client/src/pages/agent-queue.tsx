import { useQuery, useMutation } from '@tanstack/react-query';
import { queryClient, apiRequest } from '@/lib/queryClient';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Users, Clock, CheckCircle, MessageSquare, Mail, User } from 'lucide-react';
import { useState, useEffect } from 'react';
import { formatDistanceToNow } from 'date-fns';
import { useLocation } from 'wouter';

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
  activeChats: number;
  maxChats: number;
};

export default function AgentQueue() {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState<string>('pending');

  // Fetch pending handoffs with auto-refresh
  const { data: pendingHandoffs = [], isLoading: pendingLoading } = useQuery<WidgetHandoff[]>({
    queryKey: ['/api/widget-handoffs/pending'],
    refetchInterval: 2000, // Refresh every 2 seconds
  });

  // Fetch active handoffs
  const { data: activeHandoffs = [], isLoading: activeLoading } = useQuery<WidgetHandoff[]>({
    queryKey: ['/api/widget-handoffs/active'],
    refetchInterval: 3000, // Refresh every 3 seconds
  });

  // Fetch all handoffs for history
  const { data: allHandoffs = [], isLoading: allLoading } = useQuery<WidgetHandoff[]>({
    queryKey: ['/api/widget-handoffs'],
    refetchInterval: 5000, // Refresh every 5 seconds (WebSocket provides real-time updates)
  });

  // Fetch agents for status display
  const { data: agents = [] } = useQuery<HumanAgent[]>({
    queryKey: ['/api/human-agents'],
    refetchInterval: 5000,
  });

  // Pick up handoff mutation
  const pickUpMutation = useMutation({
    mutationFn: async (handoffId: string) => {
      return await apiRequest('POST', `/api/widget-handoffs/${handoffId}/pickup`, {});
    },
    onSuccess: (data, handoffId) => {
      toast({
        title: 'Handoff picked up',
        description: 'You are now chatting with the customer',
      });
      // Refetch all queries
      queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs/pending'] });
      queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs/active'] });
      queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs'] });
      // Navigate to chat interface
      navigate(`/agent-chat/${handoffId}`);
    },
    onError: (error: Error) => {
      toast({
        title: 'Failed to pick up handoff',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  // Refetch history when switching to history tab
  useEffect(() => {
    if (activeTab === 'history') {
      queryClient.invalidateQueries({ queryKey: ['/api/widget-handoffs'] });
    }
  }, [activeTab]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return (
          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">
            Waiting
          </Badge>
        );
      case 'active':
        return (
          <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
            Active
          </Badge>
        );
      case 'resolved':
        return (
          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200">
            Resolved
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const renderHandoffCard = (handoff: WidgetHandoff, showPickupButton: boolean = false) => {
    const assignedAgent = agents.find((a) => a.id === handoff.assignedAgentId);
    const conversationLength = handoff.conversationHistory?.length || 0;

    return (
      <Card key={handoff.id} className="mb-4 hover:shadow-md transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <CardTitle className="text-base flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat {handoff.chatId.slice(0, 8)}...
                {getStatusBadge(handoff.status)}
              </CardTitle>
              <CardDescription className="text-sm mt-1">
                <Clock className="h-3 w-3 inline mr-1" />
                Requested {formatDistanceToNow(new Date(handoff.requestedAt), { addSuffix: true })}
              </CardDescription>
            </div>
            {showPickupButton && (
              <Button
                size="sm"
                variant="gradient"
                onClick={() => pickUpMutation.mutate(handoff.id)}
                disabled={pickUpMutation.isPending}
                className="ml-2"
              >
                Pick Up
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          {handoff.lastUserMessage && (
            <div className="mb-3">
              <p className="text-sm font-medium text-gray-700 mb-1">Last message:</p>
              <p className="text-sm text-gray-600 bg-gray-50 p-2 rounded-md">
                "{handoff.lastUserMessage.slice(0, 150)}
                {handoff.lastUserMessage.length > 150 ? '...' : ''}"
              </p>
            </div>
          )}

          {conversationLength > 0 && (
            <div className="mb-3">
              <p className="text-sm text-gray-600">
                <User className="h-3 w-3 inline mr-1" />
                {conversationLength} messages in AI conversation history
              </p>
            </div>
          )}

          {handoff.userEmail && (
            <div className="mb-3">
              <p className="text-sm text-gray-600">
                <Mail className="h-3 w-3 inline mr-1" />
                Contact: {handoff.userEmail}
              </p>
              {handoff.userMessage && (
                <p className="text-sm text-gray-600 mt-1 italic">
                  Message: "{handoff.userMessage.slice(0, 100)}
                  {handoff.userMessage.length > 100 ? '...' : ''}"
                </p>
              )}
            </div>
          )}

          {assignedAgent && (
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <Users className="h-3 w-3" />
              Assigned to: {assignedAgent.name}
            </div>
          )}

          {handoff.status === 'active' && handoff.pickedUpAt && (
            <div className="text-xs text-gray-500 mt-2">
              Picked up {formatDistanceToNow(new Date(handoff.pickedUpAt), { addSuffix: true })}
            </div>
          )}

          {handoff.status === 'resolved' && handoff.resolvedAt && (
            <div className="text-xs text-gray-500 mt-2">
              Resolved {formatDistanceToNow(new Date(handoff.resolvedAt), { addSuffix: true })}
            </div>
          )}
        </CardContent>
      </Card>
    );
  };

  return (
    <div className="container mx-auto p-6 max-w-6xl">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Agent Queue</h1>
        <p className="text-gray-600">Manage customer handoff requests from the chat widget</p>
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <Card className="border-amber-100 bg-gradient-to-br from-white to-amber-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Waiting</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-gray-900">{pendingHandoffs.length}</span>
              <Clock className="h-8 w-8 text-amber-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-emerald-100 bg-gradient-to-br from-white to-emerald-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Active Chats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-gray-900">{activeHandoffs.length}</span>
              <MessageSquare className="h-8 w-8 text-emerald-500" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-purple-100 bg-gradient-to-br from-white to-purple-50/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-700">Available Agents</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <span className="text-3xl font-bold text-gray-900">
                {agents.filter((a) => a.status === 'available').length}
              </span>
              <Users className="h-8 w-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Handoff Lists */}
      <Card>
        <CardHeader>
          <CardTitle>Handoff Requests</CardTitle>
          <CardDescription>
            Pick up pending chats or continue with your active conversations
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="pending">Pending ({pendingHandoffs.length})</TabsTrigger>
              <TabsTrigger value="active">Active ({activeHandoffs.length})</TabsTrigger>
              <TabsTrigger value="history">History</TabsTrigger>
            </TabsList>

            <TabsContent value="pending" className="mt-4">
              <ScrollArea className="h-[600px] pr-4">
                {pendingLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : pendingHandoffs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-lg font-medium">No pending handoffs</p>
                    <p className="text-sm">New handoff requests will appear here</p>
                  </div>
                ) : (
                  pendingHandoffs.map((handoff) => renderHandoffCard(handoff, true))
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="active" className="mt-4">
              <ScrollArea className="h-[600px] pr-4">
                {activeLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : activeHandoffs.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <MessageSquare className="h-12 w-12 mx-auto mb-3 text-gray-400" />
                    <p className="text-lg font-medium">No active chats</p>
                    <p className="text-sm">Pick up a pending handoff to start chatting</p>
                  </div>
                ) : (
                  activeHandoffs.map((handoff) => (
                    <div key={handoff.id}>
                      {renderHandoffCard(handoff, false)}
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mb-4"
                        onClick={() => navigate(`/agent-chat/${handoff.id}`)}
                      >
                        Open Chat
                      </Button>
                    </div>
                  ))
                )}
              </ScrollArea>
            </TabsContent>

            <TabsContent value="history" className="mt-4">
              <ScrollArea className="h-[600px] pr-4">
                {allLoading ? (
                  <div className="text-center py-8 text-gray-500">Loading...</div>
                ) : (
                  allHandoffs
                    .filter((h) => h.status === 'resolved')
                    .slice(0, 50)
                    .map((handoff) => renderHandoffCard(handoff, false))
                )}
              </ScrollArea>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
