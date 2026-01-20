import { describe, it, expect } from 'vitest';
import {
  isSuccess,
  isFailure,
  unwrap,
  mapResult,
  chainResult,
  Result,
} from './result';

describe('Result Utilities', () => {
  describe('isSuccess', () => {
    it('should return true for success result', () => {
      const result: Result<string> = { success: true, data: 'test' };
      expect(isSuccess(result)).toBe(true);
    });

    it('should return false for failure result', () => {
      const result: Result<string> = { success: false, error: 'error' };
      expect(isSuccess(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result: Result<string> = { success: true, data: 'test' };
      if (isSuccess(result)) {
        // TypeScript should verify this compiles
        const data: string = result.data;
        expect(data).toBe('test');
      }
    });
  });

  describe('isFailure', () => {
    it('should return true for failure result', () => {
      const result: Result<string> = { success: false, error: 'error' };
      expect(isFailure(result)).toBe(true);
    });

    it('should return false for success result', () => {
      const result: Result<string> = { success: true, data: 'test' };
      expect(isFailure(result)).toBe(false);
    });

    it('should narrow type correctly', () => {
      const result: Result<string> = { success: false, error: 'error' };
      if (isFailure(result)) {
        // TypeScript should verify this compiles
        const error: string = result.error;
        expect(error).toBe('error');
      }
    });
  });

  describe('unwrap', () => {
    it('should return data for success result', () => {
      const result: Result<string> = { success: true, data: 'test' };
      expect(unwrap(result)).toBe('test');
    });

    it('should throw error for failure result', () => {
      const result: Result<string> = { success: false, error: 'failed' };
      expect(() => unwrap(result)).toThrow('failed');
    });
  });

  describe('mapResult', () => {
    it('should transform data for success result', () => {
      const result: Result<number> = { success: true, data: 10 };
      const mapped = mapResult(result, (n) => n * 2);
      expect(mapped).toEqual({ success: true, data: 20 });
    });

    it('should return original error for failure result', () => {
      const result: Result<number> = {
        success: false,
        error: 'original error',
      };
      const mapped = mapResult(result, (n) => n * 2);
      expect(mapped).toEqual({ success: false, error: 'original error' });
    });
  });

  describe('chainResult', () => {
    it('should chain success results', () => {
      const step1: Result<number> = { success: true, data: 10 };
      const chained = chainResult(step1, (n) => ({
        success: true,
        data: `Value: ${n}`,
      }));
      expect(chained).toEqual({ success: true, data: 'Value: 10' });
    });

    it('should return error if first result is failure', () => {
      const step1: Result<number> = { success: false, error: 'first error' };
      const chained = chainResult(step1, (n) => ({
        success: true,
        data: `Value: ${n}`,
      }));
      expect(chained).toEqual({ success: false, error: 'first error' });
    });

    it('should return error if chained function returns failure', () => {
      const step1: Result<number> = { success: true, data: 10 };
      const chained = chainResult(step1, (n) => ({
        success: false,
        error: 'chained error',
      }));
      expect(chained).toEqual({ success: false, error: 'chained error' });
    });
  });
});
