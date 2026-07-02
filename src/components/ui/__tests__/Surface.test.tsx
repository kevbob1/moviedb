import { render, screen } from '@testing-library/react';
import { Surface } from '@/components/ui/Surface';

describe('Surface', () => {
  it('renders children', () => {
    render(<Surface>Hello</Surface>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });

  it('applies base by default', () => {
    const { container } = render(<Surface>x</Surface>);
    expect(container.firstChild).toHaveClass('bg-background');
  });

  it('applies raised variant with shadow', () => {
    const { container } = render(<Surface elevation="raised">x</Surface>);
    expect(container.firstChild).toHaveClass('bg-surface-elevated', 'shadow-lg', 'shadow-black/30');
  });

  it('renders as a different element when as prop set', () => {
    render(<Surface as="article">x</Surface>);
    expect(screen.getByText('x').tagName).toBe('ARTICLE');
  });
});
