import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { queryClient } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';

type WebSocketMessage = {
  type: string;
  payload: any;
};

export function useWebSocket() {
  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [lastMessage, setLastMessage] = useState<WebSocketMessage | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    console.log('[WebSocket] connect() called, user:', user);

    // Get fresh user check and token at connection time (not closure)
    if (!user) {
      console.log('[WebSocket] No user, skipping connection');
      return;
    }

    // Skip WebSocket for platform admins - they don't have tenantId and will fail auth
    if (user.isPlatformAdmin) {
      console.log('[WebSocket] Platform admin detected, skipping WebSocket connection');
      return;
    }

    // Get JWT token from localStorage at connection time
    const token = localStorage.getItem('auth_token');
    console.log('[WebSocket] Token exists:', !!token);

    if (!token) {
      console.log('[WebSocket] No auth token available');
      return;
    }

    // Determine WebSocket protocol based on current location
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    console.log('[WebSocket] Connecting to:', wsUrl);

    try {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log('[WebSocket] Connection opened, sending auth...');

        // Send authentication token as first message
        ws.send(
          JSON.stringify({
            type: 'auth',
            token: token,
          }),
        );
      };

      ws.onmessage = (event) => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);
          console.log('[WebSocket] Received message:', message);
          setLastMessage(message);

          // Handle different message types
          if (message.type === 'auth:success') {
            console.log('[WebSocket] Authenticated successfully');
            setIsConnected(true);
            reconnectAttempts.current = 0;
            return;
          }

          if (message.type === 'message:created') {
            const { conversationId, message: newMessage } = message.payload;

            // Invalidate queries to trigger refetch
            queryClient.invalidateQueries({
              queryKey: ['/api/conversations', conversationId, 'messages'],
            });
            queryClient.invalidateQueries({
              queryKey: ['/api/conversations'],
            });

            console.log('[WebSocket] Invalidated queries for conversation:', conversationId);
          }
        } catch (error) {
          console.error('[WebSocket] Failed to parse message:', error);
        }
      };

      ws.onerror = (error) => {
        console.error('[WebSocket] Connection error:', error);
      };

      ws.onclose = (event) => {
        console.log('[WebSocket] Connection closed:', event.code, event.reason);
        setIsConnected(false);
        wsRef.current = null;

        // Attempt to reconnect with exponential backoff
        if (reconnectAttempts.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts.current), 30000);
          console.log(
            `[WebSocket] Reconnecting in ${delay}ms (attempt ${reconnectAttempts.current + 1}/${maxReconnectAttempts})`,
          );

          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttempts.current++;
            connect();
          }, delay);
        } else {
          console.log('[WebSocket] Max reconnection attempts reached');
        }
      };
    } catch (error) {
      console.error('[WebSocket] Failed to create connection:', error);
    }
  }, [user]);

  const disconnect = useCallback(() => {
    // Clear any pending reconnection attempts
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Reset reconnection counter to prevent stale reconnects
    reconnectAttempts.current = 0;

    if (wsRef.current) {
      console.log('[WebSocket] Disconnecting...');
      wsRef.current.close();
      wsRef.current = null;
    }

    setIsConnected(false);
    setLastMessage(null);
  }, []);

  const sendMessage = useCallback((type: string, payload: any) => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      const message = JSON.stringify({ type, payload });
      wsRef.current.send(message);
      console.log('[WebSocket] Sent message:', { type, payload });
    } else {
      console.warn('[WebSocket] Cannot send message - connection not open');
    }
  }, []);

  useEffect(() => {
    console.log('[WebSocket] useEffect triggered, user:', user);

    if (user) {
      // User logged in or tenant changed - establish fresh connection
      connect();
    } else {
      // User logged out - clean up everything
      disconnect();
    }

    // Cleanup on unmount or user change
    return () => {
      disconnect();
    };
  }, [user, connect, disconnect]);

  return {
    isConnected,
    lastMessage,
    sendMessage,
  };
}
