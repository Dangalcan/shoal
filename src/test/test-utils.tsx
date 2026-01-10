import React, { ReactElement } from 'react';
import { render, RenderOptions } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { vi } from 'vitest';
import { mockToast } from './mocks/toast-mock';
export { mockToast };

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

// Override render method
export { customRender as render };
