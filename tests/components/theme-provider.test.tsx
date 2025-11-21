import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from '@/components/theme-provider';

describe('ThemeProvider', () => {
  beforeEach(() => {
    // Mock localStorage
    const localStorageMock = {
      getItem: vi.fn(() => 'light'),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
    };
    Object.defineProperty(window, 'localStorage', {
      value: localStorageMock,
      writable: true,
    });
  });

  it('should render children', () => {
    render(
      <ThemeProvider>
        <div>Test Content</div>
      </ThemeProvider>,
    );

    expect(screen.getByText('Test Content')).toBeInTheDocument();
  });

  it('should accept defaultTheme prop', () => {
    const { container } = render(
      <ThemeProvider defaultTheme="dark">
        <div>Test Content</div>
      </ThemeProvider>,
    );

    expect(container).toBeInTheDocument();
  });
});
