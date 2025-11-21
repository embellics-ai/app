import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('Utils', () => {
  describe('cn (className merger)', () => {
    it('should merge class names correctly', () => {
      expect(cn('class1', 'class2')).toBe('class1 class2');
    });

    it('should handle conditional class names', () => {
      expect(cn('base', false && 'conditional', true && 'active')).toBe('base active');
    });

    it('should merge tailwind classes without conflicts', () => {
      const result = cn('px-2 py-1', 'px-4');
      expect(result).toBe('py-1 px-4'); // px-4 should override px-2
    });

    it('should handle arrays of class names', () => {
      expect(cn(['class1', 'class2'], 'class3')).toBe('class1 class2 class3');
    });

    it('should handle objects with conditional classes', () => {
      expect(cn({ 'bg-red': true, 'bg-blue': false })).toBe('bg-red');
    });

    it('should return empty string for no classes', () => {
      expect(cn()).toBe('');
    });

    it('should filter out falsy values', () => {
      expect(cn('class1', null, undefined, false, '', 'class2')).toBe('class1 class2');
    });
  });
});
