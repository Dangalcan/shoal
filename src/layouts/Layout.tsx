import { Outlet } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from '../components/Sidebar';
import { AppUpdateNotifier } from '../features/updates/AppUpdateNotifier';

export function Layout() {
  return (
    <div className="layout-container">
      <Toaster position="top-right" closeButton richColors />
      <AppUpdateNotifier />
      <Sidebar />
      <main className="layout-main">
        <Outlet />
      </main>
    </div>
  );
}
