import { render, screen } from '@testing-library/react';
import { JellyfinBadge } from '../JellyfinBadge';

describe('JellyfinBadge', () => {
  it('shows "On Jellyfin" when available is true', () => {
    render(<JellyfinBadge available={true} />);
    expect(screen.getByText('On Jellyfin')).toBeInTheDocument();
  });

  it('renders nothing when available is false', () => {
    const { container } = render(<JellyfinBadge available={false} />);
    expect(container).toBeEmptyDOMElement();
  });
});