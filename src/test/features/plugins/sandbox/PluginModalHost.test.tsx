import { describe, it, expect, vi, beforeEach, type Mock } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { PluginModalHost } from '../../../../features/plugins/sandbox/PluginModalHost';

// The modal content runs in its own sandboxed frame; here only the host
// overlay (backdrop, dialog, dismissal) is under test.
vi.mock('../../../../features/plugins/sandbox/PluginFrame', () => ({
  PluginFrame: () => <div data-testid="plugin-frame" />,
}));

const urls = {
  hostDocumentUrl: 'plugin-file:///host/plugin-host/index.html',
  entryUrl: 'plugin-file:///p1/renderer.js',
  styleUrls: [],
  permissions: [],
};

describe('PluginModalHost', () => {
  let onClose: Mock<() => void>;

  beforeEach(() => {
    onClose = vi.fn<() => void>();
  });

  function renderHost() {
    return render(
      <PluginModalHost
        pluginId="p1"
        urls={urls}
        modalId="details"
        props={{ id: 1 }}
        onClose={onClose}
      />
    );
  }

  it('renders the dialog in a portal with the plugin frame inside', () => {
    renderHost();
    const dialog = document.querySelector('.plugin-modal-dialog');
    expect(dialog).toHaveAttribute('role', 'dialog');
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(
      dialog?.querySelector('[data-testid="plugin-frame"]')
    ).not.toBeNull();
  });

  it('closes on Escape while the overlay is mounted, and not afterwards', () => {
    const { unmount } = renderHost();

    fireEvent.keyDown(window, { key: 'Enter' });
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    unmount();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on a backdrop click but not on a click inside the dialog', () => {
    renderHost();
    const overlay = document.querySelector('.plugin-modal-overlay')!;
    const dialog = document.querySelector('.plugin-modal-dialog')!;

    fireEvent.click(dialog);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(overlay);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
