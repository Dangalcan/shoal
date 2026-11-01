import { describe, it, expect, vi, afterEach } from 'vitest';
import { Route, Routes } from 'react-router-dom';
import { render, screen, fireEvent, createMockElectronAPI } from '../utils';
import { Layout } from '../../layouts/Layout';

function BrokenPage(): never {
  throw new Error('page exploded');
}

function renderLayout(route: string, api = createMockElectronAPI()) {
  render(
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<p>Dashboard page</p>} />
        <Route path="/clusters" element={<BrokenPage />} />
      </Route>
    </Routes>,
    { initialEntries: [route], api }
  );
  return api;
}

describe('Layout', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('shows the sidebar next to the current page', async () => {
    renderLayout('/');

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(screen.getByRole('main')).toHaveTextContent('Dashboard page');
    expect(screen.getByRole('link', { name: /Clusters/ })).toBeInTheDocument();
  });

  it('subscribes to app update notifications', async () => {
    const api = renderLayout('/');

    await screen.findByText('Dashboard page');
    expect(api.onUpdateStatus).toHaveBeenCalledTimes(1);
  });

  it('keeps the sidebar usable when a page throws, and recovers on navigation', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    renderLayout('/clusters');

    expect(await screen.findByText('Something went wrong')).toBeInTheDocument();
    expect(screen.getByRole('main')).not.toHaveTextContent('Dashboard page');

    fireEvent.click(screen.getByRole('link', { name: /Dashboard/ }));

    expect(await screen.findByText('Dashboard page')).toBeInTheDocument();
    expect(screen.queryByText('Something went wrong')).toBeNull();
  });
});
