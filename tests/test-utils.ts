import { vi } from 'vitest';
import type { JWTPayload } from '../server/auth';

// Mock user data for testing
export const mockUsers = {
  platformAdmin: {
    userId: 'admin-1',
    tenantId: null,
    email: 'admin@platform.com',
    role: 'owner',
    isPlatformAdmin: true,
  } as JWTPayload,
  tenantOwner: {
    userId: 'owner-1',
    tenantId: 'tenant-1',
    email: 'owner@tenant.com',
    role: 'owner',
    isPlatformAdmin: false,
  } as JWTPayload,
  clientAdmin: {
    userId: 'client-1',
    tenantId: 'tenant-1',
    email: 'client@tenant.com',
    role: 'client_admin',
    isPlatformAdmin: false,
  } as JWTPayload,
  supportStaff: {
    userId: 'support-1',
    tenantId: 'tenant-1',
    email: 'support@tenant.com',
    role: 'support_staff',
    isPlatformAdmin: false,
  } as JWTPayload,
};

// Mock Express Request
export const createMockRequest = (overrides = {}) => ({
  headers: {},
  body: {},
  params: {},
  query: {},
  user: undefined,
  ...overrides,
});

// Mock Express Response
export const createMockResponse = () => {
  const res: any = {
    statusCode: 200,
    headers: {},
    data: null,
  };

  res.status = vi.fn((code: number) => {
    res.statusCode = code;
    return res;
  });

  res.json = vi.fn((data: any) => {
    res.data = data;
    return res;
  });

  res.send = vi.fn((data: any) => {
    res.data = data;
    return res;
  });

  res.setHeader = vi.fn((key: string, value: string) => {
    res.headers[key] = value;
    return res;
  });

  return res;
};

// Mock Express Next Function
export const createMockNext = () => vi.fn();

// Mock WebSocket
export const createMockWebSocket = () => ({
  send: vi.fn(),
  close: vi.fn(),
  on: vi.fn(),
  readyState: 1, // OPEN
  CONNECTING: 0,
  OPEN: 1,
  CLOSING: 2,
  CLOSED: 3,
});

// Mock Database Connection
export const createMockDb = () => ({
  select: vi.fn().mockReturnThis(),
  insert: vi.fn().mockReturnThis(),
  update: vi.fn().mockReturnThis(),
  delete: vi.fn().mockReturnThis(),
  where: vi.fn().mockReturnThis(),
  values: vi.fn().mockReturnThis(),
  set: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([]),
  execute: vi.fn().mockResolvedValue([]),
});

// Helper to create mock API key
export const createMockApiKey = (overrides = {}) => ({
  id: 'key-1',
  tenantId: 'tenant-1',
  keyHash: 'hash-123',
  keyPreview: 'rck_test_',
  name: 'Test API Key',
  isActive: true,
  createdAt: new Date(),
  lastUsedAt: null,
  expiresAt: null,
  ...overrides,
});

// Helper to create mock agent
export const createMockAgent = (overrides = {}) => ({
  id: 'agent-1',
  tenantId: 'tenant-1',
  name: 'Test Agent',
  email: 'agent@test.com',
  status: 'online',
  isAvailable: true,
  lastSeenAt: new Date(),
  createdAt: new Date(),
  ...overrides,
});

// Helper to create mock chat message
export const createMockMessage = (overrides = {}) => ({
  id: 'msg-1',
  chatId: 'chat-1',
  content: 'Test message',
  sender: 'user',
  timestamp: new Date(),
  ...overrides,
});

// Mock localStorage
export const createMockLocalStorage = () => {
  let store: Record<string, string> = {};

  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value;
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key];
    }),
    clear: vi.fn(() => {
      store = {};
    }),
  };
};

// Mock fetch
export const createMockFetch = (response: any = {}, status = 200) => {
  return vi.fn(() =>
    Promise.resolve({
      ok: status >= 200 && status < 300,
      status,
      json: () => Promise.resolve(response),
      text: () => Promise.resolve(JSON.stringify(response)),
      headers: new Headers(),
    }),
  );
};

// Wait for async operations
export const waitFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Mock React Query client
export const createMockQueryClient = () => ({
  invalidateQueries: vi.fn(),
  setQueryData: vi.fn(),
  getQueryData: vi.fn(),
  prefetchQuery: vi.fn(),
  clear: vi.fn(),
});
