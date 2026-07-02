import { render, screen } from '@testing-library/react';
import { StaggerList } from '@/components/motion/StaggerList';

describe('StaggerList', () => {
  it('renders list of items', () => {
    render(
      <StaggerList items={['a', 'b', 'c']} renderItem={(item) => <span key={item}>{item}</span>} />
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
  });

  it('applies role list', () => {
    const { container } = render(
      <StaggerList items={[1]} renderItem={(i) => <span key={i}>x</span>} />
    );
    expect(container.firstChild).toHaveAttribute('role', 'list');
  });
});
