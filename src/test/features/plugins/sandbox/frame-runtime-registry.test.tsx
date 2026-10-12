import { describe, it, expect, vi } from 'vitest';
import type { ComponentType } from 'react';
import {
  makeRegistryShim,
  type FrameView,
} from '../../../../features/plugins/sandbox/frame-runtime';

// Minimal component stand-ins (never actually rendered here).
const PageC = (() => null) as ComponentType;
const WidgetC = (() => null) as ComponentType;
const ModalC = (() => null) as ComponentType;

interface RegistryShim {
  registerPage: (p: { component?: ComponentType }) => void;
  registerWidget: (w: { id?: string; component?: ComponentType }) => void;
  registerModal: (m: { id?: string; component?: ComponentType }) => void;
  registerResourceAction: (a: {
    id?: string;
    component?: ComponentType;
  }) => void;
}

function shimFor(view: FrameView, viewProps?: unknown) {
  const mount = vi.fn();
  const shim = makeRegistryShim(
    view,
    viewProps,
    mount
  ) as unknown as RegistryShim;
  return { shim, mount };
}

describe('frame-runtime registry shim', () => {
  it('mounts only the page for a page view', () => {
    const { shim, mount } = shimFor({ kind: 'page' });
    shim.registerWidget({ id: 'w1', component: WidgetC });
    shim.registerPage({ component: PageC });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(PageC, undefined);
  });

  it('mounts only the requested widget for a widget view', () => {
    const { shim, mount } = shimFor({ kind: 'widget', widgetId: 'w2' });
    shim.registerPage({ component: PageC });
    shim.registerWidget({ id: 'w1', component: WidgetC });
    expect(mount).not.toHaveBeenCalled(); // wrong widget id
    shim.registerWidget({ id: 'w2', component: ModalC });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(ModalC, undefined);
  });

  it('mounts the matching modal with its host-supplied props', () => {
    const props = { total: 3, running: 2 };
    const { shim, mount } = shimFor({ kind: 'modal', modalId: 'm1' }, props);
    shim.registerPage({ component: PageC });
    shim.registerModal({ id: 'other', component: WidgetC });
    expect(mount).not.toHaveBeenCalled(); // wrong modal id
    shim.registerModal({ id: 'm1', component: ModalC });
    expect(mount).toHaveBeenCalledTimes(1);
    expect(mount).toHaveBeenCalledWith(ModalC, props);
  });

  it('treats a registered resource-action as a modal component', () => {
    const { shim, mount } = shimFor({ kind: 'modal', modalId: 'act1' }, {});
    shim.registerResourceAction({ id: 'act1', component: ModalC });
    expect(mount).toHaveBeenCalledWith(ModalC, {});
  });

  it('mounts at most once', () => {
    const { shim, mount } = shimFor({ kind: 'page' });
    shim.registerPage({ component: PageC });
    shim.registerPage({ component: WidgetC });
    expect(mount).toHaveBeenCalledTimes(1);
  });
});
