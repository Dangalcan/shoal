import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { mockToast } from './mocks/toast-mock';
import { mockElectronAPI } from './setup';
import * as factories from './helpers/resource-factories';

// Re-export commonly used testing utilities
export { mockToast };
export { mockElectronAPI };
export { factories };

/**
 * Custom render function that includes common providers like MemoryRouter.
 */
interface CustomRenderOptions extends RenderOptions {
  route?: string;
  path?: string;
  initialEntries?: string[];
}

const AllTheProviders = ({ children, initialEntries = ['/'] }: { children: React.ReactNode, initialEntries?: string[] }) => {
  return (
    <MemoryRouter initialEntries={initialEntries}>
      {children}
    </MemoryRouter>
  );
};

const customRender = (
  ui: ReactElement,
  options?: Omit<CustomRenderOptions, 'wrapper'>
) => {
  const { route, path, initialEntries, ...renderOptions } = options || {};
  
  if (path && route) {
    return render(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>,
      renderOptions
    );
  }

  return render(ui, { 
    wrapper: (props) => <AllTheProviders {...props} initialEntries={initialEntries} />, 
    ...renderOptions 
  });
};

// Re-export everything from RTL
export * from '@testing-library/react';

// Re-export userEvent for convenience
export { default as userEvent } from '@testing-library/user-event';

/**
 * Custom render function with router support
 * 
 * Wraps components in MemoryRouter for testing components that use routing.
 * 
 * @param ui - Component to render
 * @param options - Render options including route configuration
 * @returns Render result from React Testing Library
 * 
 * @example
 * ```typescript
 * // Simple render with router
 * render(<MyComponent />)
 * 
 * // Render with specific route
 * render(<ClusterDetails />, { 
 *   route: '/clusters/my-cluster',
 *   path: '/clusters/:name'
 * })
 * ```
 */
export { customRender as render };
