import { render, screen } from '@testing-library/react';
import { PageTransition } from '@/components/motion/PageTransition';

describe('PageTransition', () => {
  it('renders children', () => {
    render(<PageTransition>Hello</PageTransition>);
    expect(screen.getByText('Hello')).toBeInTheDocument();
  });
});
