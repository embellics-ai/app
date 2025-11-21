import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useHeartbeat } from '@/hooks/use-heartbeat';
import { useAuth } from '@/contexts/auth-context';

// Mock the auth context
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}));

describe('useHeartbeat Hook', () => {
  let fetchMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.useFakeTimers();
    fetchMock = vi.fn();
    global.fetch = fetchMock as any;

    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn((key) => {
        if (key === 'auth_token') return 'test-token';
        return null;
      }),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should send heartbeat for support_staff role', async () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'support_staff', userId: '1', tenantId: 'tenant-1' },
    });

    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    renderHook(() => useHeartbeat());

    // Advance timers to trigger the immediate call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/heartbeat', {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer test-token',
      },
    });
  });

  it('should send heartbeat for client_admin role', async () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'client_admin', userId: '1', tenantId: 'tenant-1' },
    });

    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    renderHook(() => useHeartbeat());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalled();
  });

  it('should NOT send heartbeat for owner role', () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'owner', userId: '1', tenantId: 'tenant-1' },
    });

    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    renderHook(() => useHeartbeat());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should NOT send heartbeat when no user', () => {
    (useAuth as any).mockReturnValue({ user: null });

    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    renderHook(() => useHeartbeat());

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('should send heartbeat at 30 second intervals', async () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'support_staff', userId: '1', tenantId: 'tenant-1' },
    });

    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    renderHook(() => useHeartbeat());

    // Initial call
    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    // Advance 30 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);

    // Advance another 30 seconds
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it('should handle fetch errors gracefully', async () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'support_staff', userId: '1', tenantId: 'tenant-1' },
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    fetchMock.mockRejectedValue(new Error('Network error'));

    renderHook(() => useHeartbeat());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('should handle missing auth token', async () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'support_staff', userId: '1', tenantId: 'tenant-1' },
    });

    const localStorageMock = {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });

    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    renderHook(() => useHeartbeat());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(consoleErrorSpy).toHaveBeenCalledWith('[Heartbeat] No auth token found');
    expect(fetchMock).not.toHaveBeenCalled();
    consoleErrorSpy.mockRestore();
  });

  it('should cleanup interval on unmount', async () => {
    (useAuth as any).mockReturnValue({
      user: { role: 'support_staff', userId: '1', tenantId: 'tenant-1' },
    });

    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    const { unmount } = renderHook(() => useHeartbeat());

    await act(async () => {
      await vi.advanceTimersByTimeAsync(0);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);

    unmount();

    // Advance time after unmount
    await act(async () => {
      await vi.advanceTimersByTimeAsync(30000);
    });

    // Should not call again after unmount
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
