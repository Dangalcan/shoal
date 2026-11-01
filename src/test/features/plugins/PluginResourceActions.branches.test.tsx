/**
 * Which plugins and actions PluginResourceActions offers for a resource type,
 * with a plugin list each test sets up.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { Plugin } from '../../../../electron/types/plugin-types';
import { makePlugin } from './plugin-fixtures';

const state = vi.hoisted(() => ({ plugins: [] as Plugin[] }));

vi.mock('../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({ loading: false, plugins: state.plugins }),
}));

vi.mock('../../../features/plugins/sandbox/PluginFrame', () => ({
  PluginFrame: () => <div data-testid="modal-frame" />,
}));

import { PluginResourceActions } from '../../../features/plugins/PluginResourceActions';

const podResource = {
  metadata: { name: 'pod-1', namespace: 'default' },
} as never;

/** An enabled plugin with a renderer and the given resource actions. */
function withActions(
  id: string,
  resourceActions: unknown[] | undefined,
  overrides: Partial<Plugin> = {}
): Plugin {
  return makePlugin({
    state: 'enabled',
    rendererEntry: `/plugins/${id}/renderer.js`,
    ...overrides,
    manifest: {
      id,
      name: id.toUpperCase(),
      extensions: resourceActions ? ({ resourceActions } as never) : undefined,
    },
  });
}

const inspect = { id: 'inspect', label: 'Inspect', resourceTypes: ['pods'] };

describe('PluginResourceActions (plugin list)', () => {
  beforeEach(() => {
    state.plugins = [];
  });

  it('renders nothing when no plugin offers an action for the type', () => {
    state.plugins = [withActions('p1', [inspect])];
    const { container } = render(
      <PluginResourceActions resource={podResource} resourceType="services" />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('only offers actions of enabled plugins that ship a renderer', () => {
    state.plugins = [
      withActions('off', [inspect], { state: 'disabled' }),
      withActions('headless', [inspect], { rendererEntry: undefined }),
      withActions('on', [inspect]),
    ];
    render(
      <PluginResourceActions resource={podResource} resourceType="pods" />
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTitle('Inspect (ON)')).toBeInTheDocument();
  });

  it('skips plugins without extensions and actions without resource types', () => {
    state.plugins = [
      withActions('bare', undefined),
      withActions('untyped', [{ id: 'any', label: 'Untyped' }]),
      withActions('typed', [inspect]),
    ];
    render(
      <PluginResourceActions resource={podResource} resourceType="pods" />
    );

    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByTitle('Inspect (TYPED)')).toBeInTheDocument();
    expect(screen.queryByTitle('Untyped (UNTYPED)')).not.toBeInTheDocument();
  });

  it('falls back to the puzzle icon for an icon name it does not know', () => {
    state.plugins = [withActions('p1', [{ ...inspect, icon: 'NotARealIcon' }])];
    render(
      <PluginResourceActions resource={podResource} resourceType="pods" />
    );

    const button = screen.getByTitle('Inspect (P1)');
    expect(button.querySelector('svg.lucide-puzzle')).not.toBeNull();
  });
});
