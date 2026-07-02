import { render, screen } from '@testing-library/react';
import { Pill } from '@/components/ui/Pill';

describe('Pill', () => {
  it('renders label', () => {
    render(<Pill variant="pending">Pending</Pill>);
    expect(screen.getByText('Pending')).toBeInTheDocument();
  });

  it('applies pending variant colors', () => {
    render(<Pill variant="pending">x</Pill>);
    expect(screen.getByText('x').parentElement).toHaveClass('bg-(--color-status-pending-bg)');
  });

  it('renders with dot', () => {
    const { container } = render(<Pill variant="fulfilled">x</Pill>);
    expect(container.querySelector('span > span')).toBeInTheDocument();
  });

  it('supports custom label via prop', () => {
    render(<Pill variant="available" label="On Jellyfin" />);
    expect(screen.getByText('On Jellyfin')).toBeInTheDocument();
  });
});
