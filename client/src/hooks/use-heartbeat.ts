import { useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';

const HEARTBEAT_INTERVAL = 30000; // 30 seconds

/**
 * Hook that sends heartbeat pings to the server to maintain agent status.
 * Only active for users with agent roles (support_staff and client_admin).
 * Updates last_seen timestamp on the server every 30 seconds.
 */
export function useHeartbeat() {
  const { user } = useAuth();

  useEffect(() => {
    // Only run for agents (support_staff and client_admin)
    if (!user || (user.role !== 'support_staff' && user.role !== 'client_admin')) {
      return;
    }

    const sendHeartbeat = async () => {
      try {
        // Get token from localStorage
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.error('[Heartbeat] No auth token found');
          return;
        }

        const response = await fetch('/api/auth/heartbeat', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (response.ok) {
          console.log('[Heartbeat] Ping successful');
        } else {
          console.error('[Heartbeat] Failed with status:', response.status);
        }
      } catch (error) {
        console.error('[Heartbeat] Error:', error);
      }
    };

    // Send immediately on mount to update last_seen
    sendHeartbeat();

    // Then send every 30 seconds
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Cleanup on unmount
    return () => clearInterval(interval);
  }, [user]);
}
