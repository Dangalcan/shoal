import { Outlet, useLocation } from 'react-router-dom';
import { Toaster } from 'sonner';
import { Sidebar } from '../components/Sidebar';
import { ErrorBoundary } from '../components/common/ErrorBoundary';
import { AppUpdateNotifier } from '../features/updates/AppUpdateNotifier';

export function Layout() {
  const location = useLocation();
  return (
    <div className="layout-container">
      <Toaster position="top-right" closeButton richColors />
      <AppUpdateNotifier />
      <Sidebar />
      <main className="layout-main">
        {/* A page that throws shows its error here; the sidebar stays usable,
            and navigating elsewhere (new key) gives a fresh page. */}
        <ErrorBoundary key={location.pathname}>
          <Outlet />
        </ErrorBoundary>
      </main>
    </div>
  );
}
