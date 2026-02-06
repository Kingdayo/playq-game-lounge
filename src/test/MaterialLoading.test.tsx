import { render } from '@testing-library/react';
import MaterialLoading from '../components/MaterialLoading';
import { describe, it, expect } from 'vitest';
import React from 'react';

describe('MaterialLoading', () => {
  it('should not render when isLoading is false', () => {
    const { queryByText } = render(<MaterialLoading isLoading={false} />);
    expect(queryByText(/loading/i)).not.toBeInTheDocument();
  });

  it('should render when isLoading is true', () => {
    const { getByText } = render(<MaterialLoading isLoading={true} />);
    expect(getByText(/loading/i)).toBeInTheDocument();
  });
});
