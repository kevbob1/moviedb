import { render } from '@testing-library/react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Switch } from '@/components/ui/Switch';

describe('a11y', () => {
  it('Button has focus-visible ring class', () => {
    const { container } = render(<Button>x</Button>);
    expect(container.querySelector('button')).toHaveClass('focus-visible:ring-2');
  });

  it('Input has focus-visible ring class', () => {
    const { container } = render(<Input label="x" />);
    expect(container.querySelector('input')).toHaveClass('focus-visible:ring-2');
  });

  it('Switch root has focus-visible ring class', () => {
    const { container } = render(<Switch label="x" />);
    expect(container.querySelector('[role="switch"]')).toHaveClass('focus-visible:ring-2');
  });
});
