import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Route, Routes, useLocation } from 'react-router-dom';
import { render, screen, fireEvent } from '../utils';
import { createMockElectronAPI } from '../utils/mocks';
import { Clusters } from '../../pages/Clusters';

/**
 * Opening a cluster from its card on the Clusters page, by mouse and from
 * the keyboard (the card info is a role="button" div).
 */

function CurrentPath() {
  return <p data-testid="current-path">{useLocation().pathname}</p>;
}

describe('Clusters page navigation', () => {
  let api: ReturnType<typeof createMockElectronAPI>;

  beforeEach(() => {
    vi.clearAllMocks();
    api = createMockElectronAPI({
      getClusters: vi
        .fn()
        .mockResolvedValue({ success: true, data: ['kind-dev', 'team/a'] }),
    });
  });

  const renderPage = () =>
    render(
      <Routes>
        <Route path="/clusters" element={<Clusters />} />
        <Route path="*" element={<CurrentPath />} />
      </Routes>,
      { api, initialEntries: ['/clusters'] }
    );

  const card = async (name: string) =>
    (await screen.findByRole('heading', { name })).closest(
      '[role="button"]'
    ) as HTMLElement;

  it('opens the cluster details on click, encoding the name', async () => {
    renderPage();

    fireEvent.click(await card('team/a'));

    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/cluster/team%2Fa'
    );
  });

  it('opens the cluster details with Enter', async () => {
    renderPage();

    fireEvent.keyDown(await card('kind-dev'), { key: 'Enter' });

    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/cluster/kind-dev'
    );
  });

  it('opens the cluster details with Space', async () => {
    renderPage();

    fireEvent.keyDown(await card('kind-dev'), { key: ' ' });

    expect(screen.getByTestId('current-path')).toHaveTextContent(
      '/cluster/kind-dev'
    );
  });

  it('ignores other keys on a cluster card', async () => {
    renderPage();
    const kindDev = await card('kind-dev');

    fireEvent.keyDown(kindDev, { key: 'a' });

    expect(screen.queryByTestId('current-path')).toBeNull();
    expect(kindDev).toBeInTheDocument();
  });
});
