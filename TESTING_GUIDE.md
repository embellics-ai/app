# Testing Guide for Embellics-AI

## Overview

This project uses a comprehensive testing strategy with **Vitest** as the test runner, **React Testing Library** for component tests, and **Supertest** for API integration tests.

## Test Structure

```
tests/
├── setup.ts                    # Global test setup and configuration
├── test-utils.ts              # Test utilities and helper functions
├── mocks/
│   └── router-mocks.ts        # Mock implementations for routing
├── components/                # Component unit tests
│   ├── message-bubble.test.tsx
│   ├── typing-indicator.test.tsx
│   ├── empty-state.test.tsx
│   ├── protected-route.test.tsx
│   └── role-protected-route.test.tsx
├── hooks/                     # Custom hooks tests
│   ├── use-heartbeat.test.ts
│   └── use-mobile.test.ts
├── lib/                       # Utility function tests
│   └── utils.test.ts
└── server/                    # Server-side tests
    ├── auth.test.ts
    ├── encryption.test.ts
    ├── email.test.ts
    └── invite-service.test.ts
```

## Running Tests

### Run all tests

```bash
npm test
```

### Run tests in watch mode (for development)

```bash
npm run test:watch
```

### Run tests with coverage

```bash
npm test -- --coverage
```

### Run specific test file

```bash
npm test -- tests/components/message-bubble.test.tsx
```

### Run tests matching a pattern

```bash
npm test -- --grep="MessageBubble"
```

## Writing Tests

### Component Tests

Use React Testing Library for component tests:

```typescript
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/my-component';

describe('MyComponent', () => {
  it('should render correctly', () => {
    render(<MyComponent />);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
```

### Hook Tests

Use `renderHook` from React Testing Library:

```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from '@/hooks/use-my-hook';

describe('useMyHook', () => {
  it('should return expected value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current).toBe(expectedValue);
  });
});
```

### Server Tests

Test server-side functions directly:

```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '@server/auth';

describe('Password Hashing', () => {
  it('should hash and verify passwords', async () => {
    const password = 'test123';
    const hash = await hashPassword(password);
    const isValid = await verifyPassword(password, hash);
    expect(isValid).toBe(true);
  });
});
```

### API Integration Tests

Use Supertest for API endpoint tests:

```typescript
import request from 'supertest';
import { app } from '@server/index';

describe('API Routes', () => {
  it('should return 200 for health check', async () => {
    const response = await request(app).get('/api/health');
    expect(response.status).toBe(200);
  });
});
```

## Test Utilities

### Mock Utilities

The `test-utils.ts` file provides helpful mock creators:

- `createMockRequest()` - Mock Express request
- `createMockResponse()` - Mock Express response
- `createMockNext()` - Mock Express next function
- `createMockWebSocket()` - Mock WebSocket connection
- `createMockDb()` - Mock database connection
- `createMockApiKey()` - Mock API key object
- `createMockAgent()` - Mock agent object
- `createMockMessage()` - Mock chat message

### Mock Users

Pre-defined mock users are available:

```typescript
import { mockUsers } from '../test-utils';

// Use in tests:
mockUsers.platformAdmin;
mockUsers.tenantOwner;
mockUsers.clientAdmin;
mockUsers.supportStaff;
```

## Mocking

### Mocking Modules

```typescript
vi.mock('@/contexts/auth-context', () => ({
  useAuth: vi.fn(),
}));
```

### Mocking Functions

```typescript
const mockFn = vi.fn();
mockFn.mockReturnValue('value');
mockFn.mockResolvedValue('async value');
```

### Mocking Timers

```typescript
vi.useFakeTimers();
vi.advanceTimersByTime(1000);
vi.useRealTimers();
```

## Coverage Goals

The project aims for the following coverage thresholds:

- **Lines**: 70%
- **Functions**: 70%
- **Branches**: 70%
- **Statements**: 70%

Coverage reports are generated in the `coverage/` directory.

## Best Practices

1. **Arrange-Act-Assert**: Structure tests with clear setup, execution, and verification
2. **Test Behavior, Not Implementation**: Focus on what components do, not how they do it
3. **Descriptive Test Names**: Use clear, descriptive test names that explain what is being tested
4. **Isolate Tests**: Each test should be independent and not rely on others
5. **Mock External Dependencies**: Mock API calls, database operations, and external services
6. **Test Edge Cases**: Include tests for error conditions and edge cases
7. **Keep Tests Fast**: Avoid unnecessary async operations and use fake timers when possible

## Common Patterns

### Testing Async Operations

```typescript
it('should handle async operation', async () => {
  const result = await asyncFunction();
  expect(result).toBe(expected);
});
```

### Testing User Interactions

```typescript
import { fireEvent } from '@testing-library/react';

it('should handle button click', () => {
  render(<MyComponent />);
  const button = screen.getByRole('button');
  fireEvent.click(button);
  expect(mockHandler).toHaveBeenCalled();
});
```

### Testing Forms

```typescript
import userEvent from '@testing-library/user-event';

it('should submit form', async () => {
  const user = userEvent.setup();
  render(<MyForm />);

  await user.type(screen.getByLabelText('Email'), 'test@example.com');
  await user.click(screen.getByRole('button', { name: /submit/i }));

  expect(mockSubmit).toHaveBeenCalledWith({ email: 'test@example.com' });
});
```

## Debugging Tests

### Run single test in debug mode

```bash
npm test -- --reporter=verbose tests/specific-test.test.ts
```

### Use Vitest UI

```bash
npx vitest --ui
```

This opens a browser-based UI for running and debugging tests.

## Continuous Integration

Tests run automatically on:

- Every push to the repository
- Pull requests
- Before deployment

Ensure all tests pass before merging code.

## Additional Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)
