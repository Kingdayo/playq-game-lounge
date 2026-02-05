import { renderHook, act } from '@testing-library/react';
import { LoadingProvider, useLoading } from '../contexts/LoadingContext';
import { describe, it, expect, vi } from 'vitest';
import React from 'react';

describe('LoadingContext', () => {
  it('should provide default values', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );
    const { result } = renderHook(() => useLoading(), { wrapper });

    expect(result.current.isLoading).toBe(false);
  });

  it('should update isLoading with setIsLoading', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );
    const { result } = renderHook(() => useLoading(), { wrapper });

    act(() => {
      result.current.setIsLoading(true);
    });

    expect(result.current.isLoading).toBe(true);
  });

  it('should trigger loading for a duration', async () => {
    vi.useFakeTimers();
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <LoadingProvider>{children}</LoadingProvider>
    );
    const { result } = renderHook(() => useLoading(), { wrapper });

    act(() => {
      result.current.triggerLoading(500);
    });

    expect(result.current.isLoading).toBe(true);

    act(() => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.isLoading).toBe(false);
    vi.useRealTimers();
  });
});
