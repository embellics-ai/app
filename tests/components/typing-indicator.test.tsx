import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TypingIndicator } from '@/components/typing-indicator';

describe('TypingIndicator Component', () => {
  it('should render typing indicator', () => {
    render(<TypingIndicator />);

    const text = screen.getByText('AI is typing...');
    expect(text).toBeInTheDocument();
  });

  it('should render three animated dots', () => {
    const { container } = render(<TypingIndicator />);

    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots).toHaveLength(3);
  });

  it('should have staggered animation delays', () => {
    const { container } = render(<TypingIndicator />);

    const dots = container.querySelectorAll('.animate-bounce');
    expect(dots[0]).toHaveStyle({ animationDelay: '0ms' });
    expect(dots[1]).toHaveStyle({ animationDelay: '150ms' });
    expect(dots[2]).toHaveStyle({ animationDelay: '300ms' });
  });

  it('should have consistent animation duration', () => {
    const { container } = render(<TypingIndicator />);

    const dots = container.querySelectorAll('.animate-bounce');
    dots.forEach((dot) => {
      expect(dot).toHaveStyle({ animationDuration: '1s' });
    });
  });
});
