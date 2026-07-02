import { render, screen } from '@testing-library/react';
import { StaggerList } from '@/components/motion/StaggerList';

describe('StaggerList', () => {
  it('renders children', () => {
    render(
      <StaggerList>
        <span>a</span>
        <span>b</span>
        <span>c</span>
      </StaggerList>
    );
    expect(screen.getByText('a')).toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
    expect(screen.getByText('c')).toBeInTheDocument();
  });

  it('applies role list', () => {
    const { container } = render(
      <StaggerList>
        <span>x</span>
      </StaggerList>
    );
    expect(container.firstChild).toHaveAttribute('role', 'list');
  });
});
