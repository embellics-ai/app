import { expect, afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import React from 'react';

// Make React available globally for JSX
globalThis.React = React;

// Clean up after each test
afterEach(() => {
  cleanup();
});

// Mock environment variables
process.env.NODE_ENV = 'test';
// Tests now require a real PostgreSQL database (MemStorage removed)
// Set DATABASE_URL in your test environment or use the same as .env.local
if (!process.env.DATABASE_URL) {
  console.warn('⚠️  DATABASE_URL not set for tests - tests may fail');
  console.warn('⚠️  Set DATABASE_URL environment variable to run tests with PostgreSQL');
}
process.env.SESSION_SECRET = 'test-secret-key-for-testing-only';
// Use a valid 32-byte hex string (64 hex characters) for tests
process.env.ENCRYPTION_KEY = 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});
