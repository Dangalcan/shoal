import React, { ReactElement } from 'react';
import { render as rtlRender, RenderOptions } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

/**
 * Custom render options with router support.
 */
export interface CustomRenderOptions extends RenderOptions {
  /** Initial route for MemoryRouter */
  route?: string;
  /** Path pattern for Route */
  path?: string;
  /** Initial entries for MemoryRouter */
  initialEntries?: string[];
}

/**
 * Provider wrapper for tests.
 */
const AllTheProviders: React.FC<{
  children: React.ReactNode;
  initialEntries?: string[];
}> = ({ children, initialEntries = ['/'] }) => {
  return <MemoryRouter initialEntries={initialEntries}>{children}</MemoryRouter>;
};

/**
 * Custom render function with router support.
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
export function render(
  ui: ReactElement,
  options?: Omit<CustomRenderOptions, 'wrapper'>
) {
  const { route, path, initialEntries, ...renderOptions } = options || {};

  if (path && route) {
    return rtlRender(
      <MemoryRouter initialEntries={[route]}>
        <Routes>
          <Route path={path} element={ui} />
        </Routes>
      </MemoryRouter>,
      renderOptions
    );
  }

  return rtlRender(ui, {
    wrapper: (props) => (
      <AllTheProviders {...props} initialEntries={initialEntries} />
    ),
    ...renderOptions,
  });
}

// Re-export everything from RTL
export * from '@testing-library/react';

// Override render with our custom version
export { render as default };

// Re-export userEvent for convenience
export { default as userEvent } from '@testing-library/user-event';
