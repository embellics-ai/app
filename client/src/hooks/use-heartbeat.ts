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
    // Wait for user to load
    if (!user) {
      return;
    }

    // Only run for agents (support_staff and client_admin)
    if (user.role !== 'support_staff' && user.role !== 'client_admin') {
      return;
    }

    console.log('[Heartbeat] Starting for', user.role);

    let intervalId: NodeJS.Timeout | null = null;
    let failureCount = 0;
    const MAX_FAILURES = 3; // Stop after 3 consecutive 401s

    const sendHeartbeat = async () => {
      try {
        // Get fresh token from localStorage each time
        const token = localStorage.getItem('auth_token');
        if (!token) {
          console.error('[Heartbeat] No auth token found - stopping');
          if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
          }
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
          console.log('[Heartbeat] ✓ Successful');
          failureCount = 0; // Reset failure count on success
        } else if (response.status === 401) {
          failureCount++;
          console.warn(`[Heartbeat] ✗ Auth failed (${failureCount}/${MAX_FAILURES})`);

          // Stop after multiple consecutive failures
          if (failureCount >= MAX_FAILURES) {
            console.error('[Heartbeat] Too many auth failures - stopping');
            if (intervalId) {
              clearInterval(intervalId);
              intervalId = null;
            }
          }
        } else {
          console.error('[Heartbeat] Failed with status:', response.status);
        }
      } catch (error) {
        console.error('[Heartbeat] Network error:', error);
      }
    };

    // Send immediately on mount to update last_seen
    sendHeartbeat();

    // Then send every 30 seconds
    intervalId = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL);

    // Cleanup on unmount or when user changes
    return () => {
      console.log('[Heartbeat] Stopping');
      if (intervalId) {
        clearInterval(intervalId);
        intervalId = null;
      }
    };
  }, [user]);
}
