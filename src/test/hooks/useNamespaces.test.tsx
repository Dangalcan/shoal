import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import React from 'react';
import { useNamespaces } from '../../hooks/useNamespaces';
import { ApiProvider } from '../../services/api-context';
import { createMockElectronAPI } from '../utils/mocks';

describe('useNamespaces', () => {
  let mockApi: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    mockApi = createMockElectronAPI();
  });

  it('should return empty namespaces initially', () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiProvider api={mockApi}>{children}</ApiProvider>
    );

    const { result } = renderHook(() => useNamespaces('test-context'), {
      wrapper,
    });

    expect(result.current.namespaces).toEqual([]);
    expect(result.current.loading).toBe(true);
  });

  it('should fetch namespaces on mount', async () => {
    mockApi.getNamespaces = vi.fn().mockResolvedValue({
      success: true,
      data: ['default', 'kube-system'],
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiProvider api={mockApi}>{children}</ApiProvider>
    );

    const { result } = renderHook(() => useNamespaces('test-context'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.namespaces).toEqual([
      'all',
      'default',
      'kube-system',
    ]);
    expect(result.current.error).toBeNull();
  });

  it('should handle error during fetch', async () => {
    mockApi.getNamespaces = vi.fn().mockResolvedValue({
      success: false,
      error: 'Failed to fetch',
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiProvider api={mockApi}>{children}</ApiProvider>
    );

    const { result } = renderHook(() => useNamespaces('test-context'), {
      wrapper,
    });

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.namespaces).toEqual([]);
    expect(result.current.error).toBe('Failed to fetch');
  });

  it('should not fetch if contextName is undefined', async () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiProvider api={mockApi}>{children}</ApiProvider>
    );

    const { result } = renderHook(() => useNamespaces(undefined), { wrapper });

    // Wait a tick to ensure effect runs
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(mockApi.getNamespaces).not.toHaveBeenCalled();
    expect(result.current.loading).toBe(false);
  });

  it('should allow setting selected namespace', async () => {
    mockApi.getNamespaces = vi.fn().mockResolvedValue({
      success: true,
      data: [],
    });

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <ApiProvider api={mockApi}>{children}</ApiProvider>
    );

    const { result } = renderHook(() => useNamespaces('ctx'), { wrapper });

    // Wait for init load
    await waitFor(() => expect(result.current.loading).toBe(false));

    // Update
    const { act } = await import('@testing-library/react');

    act(() => {
      result.current.setSelectedNamespace('custom-ns');
    });

    expect(result.current.selectedNamespace).toBe('custom-ns');
  });
});
