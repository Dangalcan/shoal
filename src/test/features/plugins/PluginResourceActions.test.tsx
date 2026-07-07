import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { PluginFrameView } from '../../../features/plugins/sandbox/PluginFrame';

const plugin = {
  manifest: {
    id: 'p1',
    name: 'Plugin One',
    permissions: ['ui', 'kubernetes'],
    extensions: {
      resourceActions: [
        {
          id: 'inspect',
          label: 'Inspect Pod',
          icon: 'Search',
          resourceTypes: ['pods'],
        },
        { id: 'anytype', label: 'Any', resourceTypes: ['*'] },
      ],
    },
  },
  state: 'enabled',
  rendererEntry: '/plugins/p1/renderer.js',
  rendererStyles: [],
};

vi.mock('../../../features/plugins/PluginProvider', () => ({
  usePlugins: () => ({ loading: false, plugins: [plugin] }),
}));

// Stub the frame so we can observe which modal view opens and close it.
vi.mock('../../../features/plugins/sandbox/PluginFrame', () => ({
  PluginFrame: ({
    view,
    onCloseModal,
  }: {
    view?: PluginFrameView;
    onCloseModal?: () => void;
  }) => (
    <div data-testid="modal-frame" data-modal-id={(view as any)?.modalId}>
      <button onClick={() => onCloseModal?.()}>close-frame</button>
    </div>
  ),
}));

import { PluginResourceActions } from '../../../features/plugins/PluginResourceActions';

const podResource = {
  metadata: { name: 'pod-1', namespace: 'default' },
  status: { phase: 'Running' },
} as never;

describe('PluginResourceActions', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('renders a button per matching action (type + wildcard) and none for other types', () => {
    const { rerender } = render(
      <PluginResourceActions resource={podResource} resourceType="pods" />
    );
    // Both the pods-specific and the '*' action apply.
    expect(screen.getAllByRole('button')).toHaveLength(2);

    // For a non-matching type only the wildcard applies.
    rerender(
      <PluginResourceActions resource={podResource} resourceType="services" />
    );
    expect(screen.getAllByRole('button')).toHaveLength(1);
  });

  it('opens the plugin action in a sandboxed modal frame and closes it', () => {
    render(
      <PluginResourceActions resource={podResource} resourceType="pods" />
    );

    expect(document.querySelector('.plugin-modal-overlay')).toBeNull();

    // Click the "Inspect Pod" action.
    fireEvent.click(screen.getByTitle(/Inspect Pod/));
    const frame = screen.getByTestId('modal-frame');
    expect(frame).toBeInTheDocument();
    expect(frame).toHaveAttribute('data-modal-id', 'inspect');
    expect(document.querySelector('.plugin-modal-overlay')).not.toBeNull();

    // The modal frame can close itself.
    fireEvent.click(screen.getByText('close-frame'));
    expect(document.querySelector('.plugin-modal-overlay')).toBeNull();
  });
});
