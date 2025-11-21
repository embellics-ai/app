import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MessageBubble } from '@/components/message-bubble';

describe('MessageBubble Component', () => {
  const mockTimestamp = new Date('2024-01-15T10:00:00Z');

  it('should render user message correctly', () => {
    render(<MessageBubble role="user" content="Hello, AI!" timestamp={mockTimestamp} />);

    const message = screen.getByText('Hello, AI!');
    expect(message).toBeInTheDocument();
  });

  it('should render assistant message correctly', () => {
    render(
      <MessageBubble
        role="assistant"
        content="Hello! How can I help you?"
        timestamp={mockTimestamp}
      />,
    );

    const message = screen.getByText('Hello! How can I help you?');
    expect(message).toBeInTheDocument();
  });

  it('should show user avatar for user messages', () => {
    render(<MessageBubble role="user" content="Test" timestamp={mockTimestamp} />);

    const messageContainer = screen.getByTestId('message-user');
    expect(messageContainer).toBeInTheDocument();
  });

  it('should show bot avatar for assistant messages', () => {
    render(<MessageBubble role="assistant" content="Test" timestamp={mockTimestamp} />);

    const messageContainer = screen.getByTestId('message-assistant');
    expect(messageContainer).toBeInTheDocument();
  });

  it('should display timestamp', () => {
    render(<MessageBubble role="user" content="Test message" timestamp={mockTimestamp} />);

    const timestamp = screen.getByTestId('message-timestamp');
    expect(timestamp).toBeInTheDocument();
    expect(timestamp).toHaveAttribute('datetime', mockTimestamp.toISOString());
  });

  it('should handle multi-line content', () => {
    const multilineContent = 'Line 1\nLine 2\nLine 3';
    render(<MessageBubble role="user" content={multilineContent} timestamp={mockTimestamp} />);

    // Check that all lines are present (text might be split across elements)
    expect(screen.getByText(/Line 1/)).toBeInTheDocument();
    expect(screen.getByText(/Line 2/)).toBeInTheDocument();
    expect(screen.getByText(/Line 3/)).toBeInTheDocument();
  });

  it('should handle long messages', () => {
    const longMessage = 'Lorem ipsum dolor sit amet, '.repeat(20);
    render(<MessageBubble role="assistant" content={longMessage} timestamp={mockTimestamp} />);

    // Check that the message content is present (might be rendered across multiple elements)
    expect(screen.getByText(/Lorem ipsum dolor sit amet/)).toBeInTheDocument();
  });

  it('should handle special characters in content', () => {
    const specialContent = 'Test with @#$%^&*()_+-=[]{}|;:,.<>?';
    render(<MessageBubble role="user" content={specialContent} timestamp={mockTimestamp} />);

    const message = screen.getByText(specialContent);
    expect(message).toBeInTheDocument();
  });

  it('should apply correct styling for user messages', () => {
    const { container } = render(
      <MessageBubble role="user" content="User message" timestamp={mockTimestamp} />,
    );

    const messageContainer = container.querySelector('.flex-row-reverse');
    expect(messageContainer).toBeInTheDocument();
  });

  it('should apply correct styling for assistant messages', () => {
    const { container } = render(
      <MessageBubble role="assistant" content="Assistant message" timestamp={mockTimestamp} />,
    );

    const messageContainer = container.querySelector('.flex-row');
    expect(messageContainer).toBeInTheDocument();
  });
});
