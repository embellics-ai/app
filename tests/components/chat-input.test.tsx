import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatInput } from '@/components/chat-input';

describe('ChatInput Component', () => {
  const mockOnSendMessage = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render textarea', () => {
    render(<ChatInput onSendMessage={mockOnSendMessage} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeInTheDocument();
  });

  it('should call onSendMessage when user types and presses Enter', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Hello, AI!');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(mockOnSendMessage).toHaveBeenCalledWith('Hello, AI!');
    });
  });

  it('should clear textarea after sending message', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Test message');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(textarea).toHaveValue('');
    });
  });

  it('should not send empty messages', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole('textbox');
    await user.keyboard('{Enter}');

    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('should allow multiline input with Shift+Enter', async () => {
    const user = userEvent.setup();
    render(<ChatInput onSendMessage={mockOnSendMessage} />);

    const textarea = screen.getByRole('textbox');
    await user.type(textarea, 'Line 1{Shift>}{Enter}{/Shift}Line 2');

    expect(textarea).toHaveValue('Line 1\nLine 2');
    expect(mockOnSendMessage).not.toHaveBeenCalled();
  });

  it('should be disabled when disabled prop is true', () => {
    render(<ChatInput onSendMessage={mockOnSendMessage} disabled={true} />);
    const textarea = screen.getByRole('textbox');
    expect(textarea).toBeDisabled();
  });

  it('should show placeholder text', () => {
    render(<ChatInput onSendMessage={mockOnSendMessage} placeholder="Type a message..." />);
    const textarea = screen.getByPlaceholderText('Type a message...');
    expect(textarea).toBeInTheDocument();
  });
});
