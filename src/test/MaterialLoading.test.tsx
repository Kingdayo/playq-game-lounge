import { render, screen } from '@testing-library/react';
import MaterialLoading from '../components/MaterialLoading';
import { describe, it, expect } from 'vitest';
import React from 'react';

describe('MaterialLoading', () => {
  it('should not render when isLoading is false', () => {
    render(<MaterialLoading isLoading={false} />);
    expect(screen.queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('should render when isLoading is true', () => {
    render(<MaterialLoading isLoading={true} />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
  });
});
