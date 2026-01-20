import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleError, handleIpcError } from './error-handler';
import { toast } from 'sonner';

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe('error-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('handleError', () => {
    it('should handle Error objects', () => {
      const error = new Error('Something went wrong');
      handleError(error, 'Test Error');

      expect(toast.error).toHaveBeenCalledWith('Test Error', {
        description: 'Something went wrong',
        duration: 5000,
        id: undefined,
      });
    });

    it('should handle string errors', () => {
      handleError('Something bad happened', 'String Error');

      expect(toast.error).toHaveBeenCalledWith('String Error', {
        description: 'Something bad happened',
        duration: 5000,
        id: undefined,
      });
    });

    it('should handle objects with message property', () => {
      const error = { message: 'Object Message' };
      handleError(error, 'Object Error');

      expect(toast.error).toHaveBeenCalledWith('Object Error', {
        description: 'Object Message',
        duration: 5000,
        id: undefined,
      });
    });

    it('should handle objects with error property', () => {
      const error = { error: 'Error Property' };
      handleError(error, 'Prop Error');

      expect(toast.error).toHaveBeenCalledWith('Prop Error', {
        description: 'Error Property',
        duration: 5000,
        id: undefined,
      });
    });

    it('should use provided description overrides', () => {
      const error = new Error('Ignored message');
      handleError(error, 'Override Error', {
        description: 'Custom description',
      });

      expect(toast.error).toHaveBeenCalledWith('Override Error', {
        description: 'Custom description',
        duration: 5000,
        id: undefined,
      });
    });

    it('should pass duration and id options', () => {
      handleError('err', 'Options Error', { duration: 1000, id: 'test-id' });

      expect(toast.error).toHaveBeenCalledWith('Options Error', {
        description: 'err',
        duration: 1000,
        id: 'test-id',
      });
    });

    it('should handle null/undefined error gracefully', () => {
      handleError(null, 'Null Error');
      expect(toast.error).toHaveBeenCalledWith(
        'Null Error',
        expect.objectContaining({
          description: undefined,
        })
      );
    });
  });

  describe('handleIpcError', () => {
    it('should format title correctly', () => {
      handleIpcError(new Error('IPC Failure'), 'fetch items');
      expect(toast.error).toHaveBeenCalledWith(
        'Failed to fetch items',
        expect.objectContaining({
          description: 'IPC Failure',
        })
      );
    });
  });
});
