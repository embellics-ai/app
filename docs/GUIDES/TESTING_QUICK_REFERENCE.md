# Quick Testing Reference

## Run Tests

```bash
# All tests
npm test

# Watch mode (auto-rerun on changes)
npm run test:watch

# With coverage
npm run test:coverage

# Interactive UI
npm run test:ui

# Specific file
npm test tests/server/auth.test.ts

# Pattern matching
npm test -- --grep="password"
```

## Test Structure

```
tests/
├── setup.ts                    # Global configuration
├── test-utils.ts              # Mock utilities
├── mocks/
│   └── router-mocks.ts        # React Router mocks
├── lib/
│   └── utils.test.ts          # Utility functions
├── hooks/
│   ├── use-heartbeat.test.ts  # Custom hooks
│   └── use-mobile.test.ts
├── components/
│   ├── message-bubble.test.tsx
│   ├── typing-indicator.test.tsx
│   ├── empty-state.test.tsx
│   ├── protected-route.test.tsx
│   └── [...more]
└── server/
    ├── auth.test.ts
    ├── encryption.test.ts
    ├── email.test.ts
    └── invite-service.test.ts
```

## Common Test Patterns

### Component Test

```typescript
import { render, screen } from '@testing-library/react';
import { MyComponent } from '@/components/my-component';

describe('MyComponent', () => {
  it('renders correctly', () => {
    render(<MyComponent prop="value" />);
    expect(screen.getByText('Expected Text')).toBeInTheDocument();
  });
});
```

### Hook Test

```typescript
import { renderHook } from '@testing-library/react';
import { useMyHook } from '@/hooks/use-my-hook';

describe('useMyHook', () => {
  it('returns expected value', () => {
    const { result } = renderHook(() => useMyHook());
    expect(result.current).toBe(expectedValue);
  });
});
```

### User Interaction

```typescript
import userEvent from '@testing-library/user-event';

it('handles click', async () => {
  const user = userEvent.setup();
  render(<Button onClick={mockFn}>Click</Button>);
  await user.click(screen.getByRole('button'));
  expect(mockFn).toHaveBeenCalled();
});
```

### Async Operations

```typescript
import { waitFor } from '@testing-library/react';

it('loads data', async () => {
  render(<AsyncComponent />);
  await waitFor(() => {
    expect(screen.getByText('Loaded')).toBeInTheDocument();
  });
});
```

## Mock Utilities

```typescript
import {
  mockUsers, // Pre-defined user objects
  createMockRequest, // Express request
  createMockResponse, // Express response
  createMockNext, // Express next
  createMockWebSocket, // WebSocket
  createMockApiKey, // API key
  createMockAgent, // Agent
  createMockMessage, // Chat message
} from '../test-utils';

// Use in tests:
const req = createMockRequest({ user: mockUsers.clientAdmin });
```

## Assertions

```typescript
// DOM assertions
expect(element).toBeInTheDocument();
expect(element).toBeVisible();
expect(element).toHaveTextContent('text');
expect(element).toHaveClass('className');
expect(element).toBeDisabled();

// Value assertions
expect(value).toBe(expected);
expect(value).toEqual(expected);
expect(array).toContain(item);
expect(obj).toHaveProperty('key');

// Function assertions
expect(mockFn).toHaveBeenCalled();
expect(mockFn).toHaveBeenCalledWith(arg);
expect(mockFn).toHaveBeenCalledTimes(n);
```

## Debugging

```bash
# Verbose output
npm test -- --reporter=verbose

# Run single test
npm test -- --grep="specific test name"

# UI mode
npm run test:ui

# Coverage report
npm run test:coverage:open
```

## Coverage Targets

- Lines: **70%**
- Functions: **70%**
- Branches: **70%**
- Statements: **70%**

## Files

- Coverage: `coverage/index.html`
- Guide: `TESTING_GUIDE.md`
- Summary: `TEST_COVERAGE.md`
- Complete: `TESTING_IMPLEMENTATION_COMPLETE.md`
