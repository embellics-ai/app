import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { EmptyState } from '@/components/empty-state';

describe('EmptyState Component', () => {
  it('should render empty state heading', () => {
    render(<EmptyState />);

    const heading = screen.getByText('Start a Conversation');
    expect(heading).toBeInTheDocument();
  });

  it('should render description text', () => {
    render(<EmptyState />);

    const description = screen.getByText(/Begin chatting with the AI assistant/);
    expect(description).toBeInTheDocument();
  });

  it('should render all four suggestion cards', () => {
    render(<EmptyState />);

    expect(screen.getByText('Ask a question')).toBeInTheDocument();
    expect(screen.getByText('Start a discussion')).toBeInTheDocument();
    expect(screen.getByText('Get assistance')).toBeInTheDocument();
    expect(screen.getByText('Explore features')).toBeInTheDocument();
  });

  it('should render suggestion card descriptions', () => {
    render(<EmptyState />);

    expect(screen.getByText('Get instant answers to your queries')).toBeInTheDocument();
    expect(screen.getByText('Have a natural conversation with AI')).toBeInTheDocument();
    expect(screen.getByText('Let the AI help you with tasks')).toBeInTheDocument();
    expect(screen.getByText('Discover what the AI can do')).toBeInTheDocument();
  });

  it('should render message icon', () => {
    const { container } = render(<EmptyState />);

    // Check for icon container
    const iconContainer = container.querySelector('.bg-primary\\/10');
    expect(iconContainer).toBeInTheDocument();
  });

  it('should have proper grid layout for suggestion cards', () => {
    const { container } = render(<EmptyState />);

    const grid = container.querySelector('.grid');
    expect(grid).toBeInTheDocument();
    expect(grid).toHaveClass('grid-cols-1', 'md:grid-cols-2');
  });
});
