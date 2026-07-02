import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from '@/components/ui/Input';

describe('Input', () => {
  it('renders with label and associates htmlFor', () => {
    render(<Input label="Search" id="q" />);
    const input = screen.getByLabelText('Search');
    expect(input).toBeInTheDocument();
    expect(input).toHaveAttribute('id', 'q');
  });

  it('renders placeholder', () => {
    render(<Input label="Search" placeholder="Type here" />);
    expect(screen.getByPlaceholderText('Type here')).toBeInTheDocument();
  });

  it('calls onChange', async () => {
    const onChange = jest.fn();
    render(<Input label="X" onChange={onChange} />);
    await userEvent.type(screen.getByLabelText('X'), 'a');
    expect(onChange).toHaveBeenCalled();
  });

  it('is disabled when disabled prop set', () => {
    render(<Input label="X" disabled />);
    expect(screen.getByLabelText('X')).toBeDisabled();
  });

  it('applies search variant height (52px)', () => {
    render(<Input label="X" variant="search" />);
    expect(screen.getByLabelText('X')).toHaveClass('h-13');
  });
});
