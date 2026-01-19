import { vi } from 'vitest';

/**
 * Robust mock for sonner toast system
 */
export const mockToast = {
  promise: vi.fn((promise, hooks) => {
    // We attach handlers to the original promise but don't await the wrapper
    // This better mimics sonner's behavior which is side-effect based
    promise.then(
      (res: any) => {
        if (hooks?.success) {
          const msg =
            typeof hooks.success === 'function'
              ? hooks.success(res)
              : hooks.success;
          mockToast.success(msg);
        }
      },
      (err: any) => {
        if (hooks?.error) {
          const msg =
            typeof hooks.error === 'function' ? hooks.error(err) : hooks.error;
          mockToast.error(msg);
        }
      }
    );
    return promise;
  }),
  success: vi.fn((_m?: any, _o?: any) => 'dummy-id'),
  error: vi.fn((_m?: any, _o?: any) => 'dummy-id'),
  loading: vi.fn((_m?: any, _o?: any) => 'dummy-id'),
  dismiss: vi.fn(),
};
