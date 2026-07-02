import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Switch } from '@/components/ui/Switch';

describe('Switch', () => {
  it('renders with label', () => {
    render(<Switch label="Show fulfilled" />);
    expect(screen.getByRole('switch', { name: 'Show fulfilled' })).toBeInTheDocument();
  });

  it('toggles checked state on click', async () => {
    render(<Switch label="x" />);
    const sw = screen.getByRole('switch');
    expect(sw).toHaveAttribute('aria-checked', 'false');
    await userEvent.click(sw);
    expect(sw).toHaveAttribute('aria-checked', 'true');
  });

  it('calls onCheckedChange', async () => {
    const onChange = jest.fn();
    render(<Switch label="x" onCheckedChange={onChange} />);
    await userEvent.click(screen.getByRole('switch'));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
