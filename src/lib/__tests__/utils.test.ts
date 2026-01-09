import { describe, it, expect } from 'vitest'
import { cn } from '../utils'

describe('cn utility function', () => {
    it('should merge class names correctly', () => {
        const result = cn('text-red-500', 'bg-blue-500')
        expect(result).toBe('text-red-500 bg-blue-500')
    })

    it('should handle conditional classes', () => {
        const result = cn('base-class', true && 'conditional-class', false && 'hidden-class')
        expect(result).toBe('base-class conditional-class')
    })

    it('should merge Tailwind classes correctly', () => {
        // twMerge should handle conflicting Tailwind classes
        const result = cn('px-2 py-1', 'px-4')
        expect(result).toBe('py-1 px-4')
    })

    it('should handle empty inputs', () => {
        const result = cn()
        expect(result).toBe('')
    })

    it('should handle undefined and null values', () => {
        const result = cn('valid-class', undefined, null, 'another-class')
        expect(result).toBe('valid-class another-class')
    })

    it('should handle arrays of classes', () => {
        const result = cn(['class1', 'class2'], 'class3')
        expect(result).toBe('class1 class2 class3')
    })

    it('should handle objects with boolean values', () => {
        const result = cn({
            'active': true,
            'disabled': false,
            'highlighted': true
        })
        expect(result).toBe('active highlighted')
    })
})
