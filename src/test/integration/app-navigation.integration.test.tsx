import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '../utils';
import { Layout } from '../../layouts/Layout';
import { Dashboard } from '../../pages/Dashboard';
import { Clusters } from '../../pages/Clusters';
import { CreateCluster } from '../../pages/CreateCluster';
import { Routes, Route } from 'react-router-dom';
import { mockElectronAPI } from '../setup';
import userEvent from '@testing-library/user-event';
import React from 'react';

describe('App Navigation Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockElectronAPI.checkTool.mockResolvedValue({ success: true, data: true });
    mockElectronAPI.getClusters.mockResolvedValue({ success: true, data: [] });
    mockElectronAPI.getCurrentContext.mockResolvedValue({ success: true, data: 'None' });
  });

  const AppRoutes = () => (
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="clusters" element={<Clusters />} />
        <Route path="settings" element={<div className="p-8"><h2 className="text-2xl font-bold">Settings</h2></div>} />
        <Route path="create-cluster" element={<CreateCluster />} />
      </Route>
    </Routes>
  );

  it('should navigate through main pages and show active link states', async () => {
    const user = userEvent.setup();
    
    render(<AppRoutes />, { initialEntries: ['/'] });

    // 1. Initially on Dashboard
    expect(screen.getByRole('heading', { name: 'Dashboard' })).toBeInTheDocument();
    
    // Check active link
    const dashboardLink = screen.getByRole('link', { name: 'Dashboard' });
    expect(dashboardLink).toHaveClass('sidebar-link-active');

    // 2. Navigate to Clusters
    const clustersLink = screen.getByRole('link', { name: 'Clusters' });
    await user.click(clustersLink);

    // Verify Clusters page
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Clusters' })).toBeInTheDocument();
    });
    
    // Check active states
    expect(clustersLink).toHaveClass('sidebar-link-active');
    expect(dashboardLink).not.toHaveClass('sidebar-link-active');

    // 3. Navigate to Settings
    const settingsLink = screen.getByRole('link', { name: 'Settings' });
    await user.click(settingsLink);

    // Verify Settings page
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Settings' })).toBeInTheDocument();
    });
    
    expect(settingsLink).toHaveClass('sidebar-link-active');
    expect(clustersLink).not.toHaveClass('sidebar-link-active');
  });

  it('should handle theme toggle successfully', async () => {
    const user = userEvent.setup();
    render(<AppRoutes />, { initialEntries: ['/'] });

    // Initially says "Switch to dark mode"
    const themeToggle = screen.getByRole('button', { name: /mode/i });
    expect(themeToggle).toHaveAttribute('title', 'Switch to dark mode');
    
    await user.click(themeToggle);
    
    // After click it should say "Switch to light mode"
    await waitFor(() => {
      expect(themeToggle).toHaveAttribute('title', 'Switch to light mode');
    });
  });
});
