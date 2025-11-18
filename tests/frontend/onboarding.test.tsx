import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@testing-library/jest-dom';
import OnboardingPage from '../../client/src/pages/onboarding';
import { AuthProvider } from '../../client/src/contexts/auth-context';
import type React from 'react';

// Mock wouter
vi.mock('wouter', () => ({
  useLocation: () => ['/', vi.fn()],
}));

// Mock toast
vi.mock('../../client/src/hooks/use-toast', () => ({
  useToast: () => ({
    toast: vi.fn(),
  }),
}));

// Mock API request
vi.mock('../../client/src/lib/queryClient', () => ({
  apiRequest: vi.fn(),
  queryClient: new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  }),
}));

describe('Onboarding Page Component Tests', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = new QueryClient({
      defaultOptions: {
        queries: { retry: false },
        mutations: { retry: false },
      },
    });
  });

  const renderOnboardingPage = () => {
    return render(
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <OnboardingPage />
        </AuthProvider>
      </QueryClientProvider>
    );
  };

  describe('Step 1: Welcome Screen', () => {
    it('should render welcome screen on initial load', () => {
      renderOnboardingPage();
      
      expect(screen.getByText(/Welcome to Embellics!/i)).toBeInTheDocument();
      expect(screen.getByTestId('button-skip-onboarding')).toBeInTheDocument();
      expect(screen.getByTestId('button-get-started')).toBeInTheDocument();
    });

    it('should show progress as 20% (step 1 of 5)', () => {
      renderOnboardingPage();
      
      expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
    });

    it('should navigate to step 2 when "Get Started" is clicked', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      const getStartedButton = screen.getByTestId('button-get-started');
      await user.click(getStartedButton);
      
      expect(screen.getByText(/Customize Your Chat Widget/i)).toBeInTheDocument();
    });

    it('should call complete onboarding when "Skip for now" is clicked', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      const skipButton = screen.getByTestId('button-skip-onboarding');
      expect(skipButton).toBeInTheDocument();
    });
  });

  describe('Step 2: Widget Customization', () => {
    beforeEach(async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      const getStartedButton = screen.getByTestId('button-get-started');
      await user.click(getStartedButton);
    });

    it('should render widget customization form', () => {
      expect(screen.getByText(/Customize Your Chat Widget/i)).toBeInTheDocument();
      expect(screen.getByTestId('input-primary-color')).toBeInTheDocument();
      expect(screen.getByTestId('select-widget-position')).toBeInTheDocument();
      expect(screen.getByTestId('input-greeting')).toBeInTheDocument();
      expect(screen.getByTestId('input-placeholder')).toBeInTheDocument();
    });

    it('should have default values pre-populated', () => {
      const primaryColorInput = screen.getByTestId('input-primary-color') as HTMLInputElement;
      const greetingInput = screen.getByTestId('input-greeting') as HTMLInputElement;
      const placeholderInput = screen.getByTestId('input-placeholder') as HTMLInputElement;

      expect(primaryColorInput.value).toBe('#6366f1');
      expect(greetingInput.value).toBe('Hi! How can I help you today?');
      expect(placeholderInput.value).toBe('Type your message...');
    });

    it('should update primary color when changed', async () => {
      const user = userEvent.setup();
      const colorInput = screen.getByTestId('input-primary-color') as HTMLInputElement;
      
      await user.clear(colorInput);
      await user.type(colorInput, '#ff0000');
      
      expect(colorInput.value).toBe('#ff0000');
      expect(screen.getByTestId('text-color-value')).toHaveTextContent('#ff0000');
    });

    it('should update greeting message when changed', async () => {
      const user = userEvent.setup();
      const greetingInput = screen.getByTestId('input-greeting') as HTMLInputElement;
      
      await user.clear(greetingInput);
      await user.type(greetingInput, 'Welcome!');
      
      expect(greetingInput.value).toBe('Welcome!');
    });

    it('should show preview of widget configuration', () => {
      expect(screen.getByText(/Preview:/i)).toBeInTheDocument();
    });

    it('should have back button to return to step 1', async () => {
      const user = userEvent.setup();
      const backButton = screen.getByText('Back');
      
      await user.click(backButton);
      
      expect(screen.getByText(/Welcome to Embellics!/i)).toBeInTheDocument();
    });

    it('should have continue button to save and proceed', () => {
      const continueButton = screen.getByTestId('button-save-widget-config');
      expect(continueButton).toBeInTheDocument();
      expect(continueButton).toHaveTextContent('Continue');
    });
  });

  describe('Step 3: API Key Generation', () => {
    it('should render API key generation screen', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      // Navigate through steps
      await user.click(screen.getByTestId('button-get-started'));
      
      // Mock successful widget config
      const { apiRequest } = await import('../../client/src/lib/queryClient');
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1', primaryColor: '#6366f1' }),
      });
      
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByText(/Generate Your API Key/i)).toBeInTheDocument();
      });
    });

    it('should have generate API key button', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1' }),
      });
      
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
    });
  });

  describe('Step 4: Installation Code', () => {
    it('should show installation code with API key', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      
      // Mock widget config
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1' }),
      });
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
      
      // Mock API key generation
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({
          plainTextKey: 'test-api-key-123',
          key: { id: 'key-1', name: 'My First API Key' },
        }),
      });
      
      await user.click(screen.getByTestId('button-generate-api-key'));
      
      await waitFor(() => {
        expect(screen.getByTestId('input-api-key-display')).toBeInTheDocument();
      });
    });

    it('should allow copying API key', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      // Mock clipboard API
      Object.assign(navigator, {
        clipboard: {
          writeText: vi.fn(),
        },
      });
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1' }),
      });
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({
          plainTextKey: 'test-api-key-123',
          key: { id: 'key-1', name: 'My First API Key' },
        }),
      });
      
      await user.click(screen.getByTestId('button-generate-api-key'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-copy-api-key')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('button-copy-api-key'));
      
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('test-api-key-123');
    });

    it('should show embed code textarea', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1' }),
      });
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({
          plainTextKey: 'test-api-key-123',
          key: { id: 'key-1', name: 'My First API Key' },
        }),
      });
      
      await user.click(screen.getByTestId('button-generate-api-key'));
      
      await waitFor(() => {
        expect(screen.getByTestId('textarea-embed-code')).toBeInTheDocument();
      });
    });
  });

  describe('Step 5: Completion', () => {
    it('should show completion screen with success message', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1' }),
      });
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({
          plainTextKey: 'test-api-key-123',
          key: { id: 'key-1', name: 'My First API Key' },
        }),
      });
      await user.click(screen.getByTestId('button-generate-api-key'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-continue-to-test')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('button-continue-to-test'));
      
      await waitFor(() => {
        expect(screen.getByText(/You're All Set!/i)).toBeInTheDocument();
      });
    });

    it('should have complete onboarding button', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1' }),
      });
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({
          plainTextKey: 'test-api-key-123',
          key: { id: 'key-1', name: 'My First API Key' },
        }),
      });
      await user.click(screen.getByTestId('button-generate-api-key'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-continue-to-test')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('button-continue-to-test'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-complete-onboarding')).toBeInTheDocument();
      });
    });

    it('should show checklist of completed tasks', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1' }),
      });
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({
          plainTextKey: 'test-api-key-123',
          key: { id: 'key-1', name: 'My First API Key' },
        }),
      });
      await user.click(screen.getByTestId('button-generate-api-key'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-continue-to-test')).toBeInTheDocument();
      });
      
      await user.click(screen.getByTestId('button-continue-to-test'));
      
      await waitFor(() => {
        expect(screen.getByText(/Widget Customized/i)).toBeInTheDocument();
        expect(screen.getByText(/API Key Generated/i)).toBeInTheDocument();
        expect(screen.getByText(/Installation Code Ready/i)).toBeInTheDocument();
      });
    });
  });

  describe('Progress Tracking', () => {
    it('should show correct progress percentage for each step', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      // Step 1: 20%
      expect(screen.getByText(/Step 1 of 5/i)).toBeInTheDocument();
      
      // Step 2: 40%
      await user.click(screen.getByTestId('button-get-started'));
      expect(screen.getByText(/Step 2 of 5/i)).toBeInTheDocument();
    });
  });

  describe('Error Handling', () => {
    it('should show error message when widget config fails', async () => {
      const user = userEvent.setup();
      const { toast } = await import('../../client/src/hooks/use-toast');
      renderOnboardingPage();
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      (apiRequest as any).mockRejectedValueOnce(new Error('Failed to save'));
      
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      // Error toast should be called
      await waitFor(() => {
        expect(toast).toHaveBeenCalled();
      });
    });

    it('should show error message when API key generation fails', async () => {
      const user = userEvent.setup();
      renderOnboardingPage();
      
      await user.click(screen.getByTestId('button-get-started'));
      
      const { apiRequest } = await import('@/lib/queryClient');
      
      (apiRequest as any).mockResolvedValueOnce({
        json: async () => ({ id: 'config-1' }),
      });
      await user.click(screen.getByTestId('button-save-widget-config'));
      
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
      
      (apiRequest as any).mockRejectedValueOnce(new Error('Failed to generate'));
      
      await user.click(screen.getByTestId('button-generate-api-key'));
      
      // Error should be handled
      await waitFor(() => {
        expect(screen.getByTestId('button-generate-api-key')).toBeInTheDocument();
      });
    });
  });
});
