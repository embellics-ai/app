# Testing Guide for Embellics Platform

## Overview

This document describes the comprehensive test suite for the Embellics platform, including backend API tests, frontend component tests, and end-to-end testing.

## Test Structure

```
tests/
├── backend/
│   ├── auth.test.ts          # Authentication API tests
│   └── onboarding.test.ts    # Onboarding flow tests
├── frontend/
│   └── onboarding.test.tsx   # Onboarding component tests
├── e2e/                      # End-to-end tests (future)
└── setup.ts                  # Test environment setup
```

## Running Tests

### Prerequisites

All test dependencies are already installed:

- `vitest` - Test runner
- `@vitest/ui` - Visual test interface
- `supertest` - HTTP testing
- `@testing-library/react` - React component testing
- `@testing-library/user-event` - User interaction simulation
- `happy-dom` - DOM environment

### Run All Tests

```bash
npx vitest run
```

### Run Tests in Watch Mode

```bash
npx vitest
```

### Run Tests with UI

```bash
npx vitest --ui
```

### Run Tests with Coverage

```bash
npx vitest run --coverage
```

### Run Specific Test File

```bash
npx vitest tests/backend/auth.test.ts
```

## Test Coverage

### Backend Tests (tests/backend/auth.test.ts)

Covers authentication endpoints:

- ✅ Login with existing user
- ✅ Login with invalid credentials
- ✅ Create user from pending invitation (client_admin)
- ✅ Create user from pending invitation (platform admin)
- ✅ Reject expired invitations
- ✅ Complete onboarding for client admin with tenantId
- ✅ Complete onboarding for platform admin without tenantId
- ✅ Reject onboarding without auth token
- ✅ Reject client admin without tenantId
- ✅ Change password with correct credentials
- ✅ Reject password change with wrong current password
- ✅ Get current user with valid token
- ✅ Reject /me request without token

### Backend Tests (tests/backend/onboarding.test.ts)

Covers complete onboarding flows:

- ✅ Full client admin onboarding (invitation → login → config → API key → complete)
- ✅ Skip onboarding steps
- ✅ Platform admin onboarding without tenant
- ✅ Widget configuration creation
- ✅ Widget configuration updates
- ✅ API key generation
- ✅ API key listing

### Frontend Tests (tests/frontend/onboarding.test.tsx)

Covers onboarding UI components:

- ✅ Welcome screen rendering
- ✅ Progress tracking (Step X of 5)
- ✅ Navigation between steps
- ✅ Widget customization form
- ✅ Form input validation
- ✅ Preview updates
- ✅ API key generation UI
- ✅ API key copying
- ✅ Installation code display
- ✅ Completion screen
- ✅ Error handling and toast notifications

## Key Test Scenarios

### Critical Path: Client Admin Onboarding

```typescript
1. Platform admin creates invitation
2. Client logs in with temporary password
3. System auto-creates user + tenant
4. User customizes widget (optional)
5. User generates API key (optional)
6. User completes onboarding
7. System marks onboarding as complete
8. User redirected to analytics dashboard
```

### Critical Path: Skip Onboarding

```typescript
1. User logs in with temporary password
2. User clicks "Skip for now" on step 1
3. System completes onboarding immediately
4. User redirected to dashboard
```

### Critical Path: Platform Admin Onboarding

```typescript
1. Platform owner creates admin invitation
2. Admin logs in with temporary password
3. System creates user (no tenant)
4. Admin completes onboarding
5. Admin redirected to platform admin dashboard
```

## Bug Fixes Validated by Tests

### Issue #1: Onboarding Loop (Fixed)

**Problem:** `/api/auth/complete-onboarding` required tenantId for ALL users, but platform admins don't have one.

**Test Coverage:**

- `tests/backend/auth.test.ts` - "should complete onboarding for platform admin without tenantId"
- `tests/backend/auth.test.ts` - "should complete onboarding for client admin with tenantId"

**Fix Applied:**

```typescript
// server/routes.ts:207-224
const isPlatformAdmin = req.user!.isPlatformAdmin;

// Platform admins don't have a tenantId - that's okay
if (!isPlatformAdmin) {
  const tenantId = assertTenant(req, res);
  if (!tenantId) return;
}
```

### Issue #2: Client Admin Tenant Creation

**Problem:** Client admins created during first login need tenant auto-created.

**Test Coverage:**

- `tests/backend/auth.test.ts` - "should create user from pending invitation on first login"
- `tests/backend/onboarding.test.ts` - "should complete full onboarding flow for client admin"

**Validation:**

- Tenant is created with company name from invitation
- User is assigned to new tenant
- Widget config can be created for tenant
- API keys are scoped to tenant

## Continuous Testing

### Pre-Deployment Checklist

Run these before deploying to production:

```bash
# 1. Run all tests
npx vitest run

# 2. Check test coverage
npx vitest run --coverage

# 3. Verify no LSP errors
# (Use get_latest_lsp_diagnostics tool)

# 4. Test in development
npm run dev
# Manually test onboarding flow

# 5. Deploy to production
npm run build
# Deploy using your platform's deployment process
```

## Test Data Cleanup

Tests use in-memory storage, so no cleanup is needed. Each test gets a fresh storage instance.

## Future Test Additions

### Planned E2E Tests (using Playwright)

- Complete user journey from invitation to dashboard
- Widget embedding and functionality
- Analytics data visualization
- Team member management
- Role-based access control

### Planned Integration Tests

- WebSocket real-time messaging
- Retell AI API integration
- Email invitation sending
- Database migrations

## Troubleshooting

### Tests Failing?

1. **Check environment variables** - Ensure test setup has mock credentials
2. **Clear node_modules** - Run `rm -rf node_modules && npm install`
3. **Check for port conflicts** - Tests shouldn't need real server
4. **Review test output** - Look for specific error messages

### Coverage Too Low?

Target coverage: 80%+

- Add tests for edge cases
- Test error handling paths
- Cover all user roles

## Contributing

When adding new features:

1. Write tests FIRST (TDD approach)
2. Ensure tests pass before committing
3. Update this documentation
4. Add test data examples
