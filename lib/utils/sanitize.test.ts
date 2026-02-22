/**
 * Input Sanitization Tests
 * Requirements: 8.4
 */

import { describe, it, expect } from 'vitest';
import {
  sanitizeString,
  sanitizeAlphanumeric,
  sanitizeEmail,
  sanitizeUrl,
  limitLength,
  sanitizeObject,
  isSafeSqlString,
} from './sanitize';

describe('Input Sanitization', () => {
  describe('sanitizeString', () => {
    it('should remove control characters', () => {
      const input = 'Hello\x00World\x1F';
      const result = sanitizeString(input);
      expect(result).toBe('HelloWorld');
    });

    it('should trim whitespace', () => {
      const input = '  Hello World  ';
      const result = sanitizeString(input);
      expect(result).toBe('Hello World');
    });

    it('should handle empty strings', () => {
      expect(sanitizeString('')).toBe('');
    });

    it('should handle non-string input', () => {
      expect(sanitizeString(123 as any)).toBe('');
      expect(sanitizeString(null as any)).toBe('');
      expect(sanitizeString(undefined as any)).toBe('');
    });
  });

  describe('sanitizeAlphanumeric', () => {
    it('should keep only alphanumeric characters', () => {
      const input = 'abc123!@#$%';
      const result = sanitizeAlphanumeric(input);
      expect(result).toBe('abc123');
    });

    it('should remove spaces', () => {
      const input = 'hello world 123';
      const result = sanitizeAlphanumeric(input);
      expect(result).toBe('helloworld123');
    });

    it('should handle empty strings', () => {
      expect(sanitizeAlphanumeric('')).toBe('');
    });
  });

  describe('sanitizeEmail', () => {
    it('should accept valid email', () => {
      const input = 'user@example.com';
      const result = sanitizeEmail(input);
      expect(result).toBe('user@example.com');
    });

    it('should convert to lowercase', () => {
      const input = 'User@Example.COM';
      const result = sanitizeEmail(input);
      expect(result).toBe('user@example.com');
    });

    it('should reject invalid email', () => {
      expect(sanitizeEmail('notanemail')).toBe('');
      expect(sanitizeEmail('missing@domain')).toBe('');
      expect(sanitizeEmail('@example.com')).toBe('');
    });

    it('should trim whitespace', () => {
      const input = '  user@example.com  ';
      const result = sanitizeEmail(input);
      expect(result).toBe('user@example.com');
    });
  });

  describe('sanitizeUrl', () => {
    it('should accept valid HTTP URL', () => {
      const input = 'http://example.com';
      const result = sanitizeUrl(input);
      expect(result).toBe('http://example.com/');
    });

    it('should accept valid HTTPS URL', () => {
      const input = 'https://example.com/path';
      const result = sanitizeUrl(input);
      expect(result).toBe('https://example.com/path');
    });

    it('should reject javascript: protocol', () => {
      const input = 'javascript:alert(1)';
      const result = sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should reject data: protocol', () => {
      const input = 'data:text/html,<script>alert(1)</script>';
      const result = sanitizeUrl(input);
      expect(result).toBe('');
    });

    it('should reject invalid URLs', () => {
      expect(sanitizeUrl('not a url')).toBe('');
      expect(sanitizeUrl('ftp://example.com')).toBe('');
    });
  });

  describe('limitLength', () => {
    it('should limit string length', () => {
      const input = 'Hello World';
      const result = limitLength(input, 5);
      expect(result).toBe('Hello');
    });

    it('should not truncate shorter strings', () => {
      const input = 'Hi';
      const result = limitLength(input, 5);
      expect(result).toBe('Hi');
    });

    it('should handle empty strings', () => {
      expect(limitLength('', 5)).toBe('');
    });
  });

  describe('sanitizeObject', () => {
    it('should remove null and undefined values', () => {
      const input = {
        a: 'value',
        b: null,
        c: undefined,
        d: 0,
        e: '',
      };
      const result = sanitizeObject(input);
      expect(result).toEqual({
        a: 'value',
        d: 0,
        e: '',
      });
    });

    it('should handle empty objects', () => {
      expect(sanitizeObject({})).toEqual({});
    });
  });

  describe('isSafeSqlString', () => {
    it('should accept safe strings', () => {
      expect(isSafeSqlString('hello world')).toBe(true);
      expect(isSafeSqlString('user123')).toBe(true);
      expect(isSafeSqlString('test@example.com')).toBe(true);
    });

    it('should reject SQL comments', () => {
      expect(isSafeSqlString('hello -- comment')).toBe(false);
      expect(isSafeSqlString('/* comment */')).toBe(false);
    });

    it('should reject SQL keywords', () => {
      expect(isSafeSqlString('SELECT * FROM users')).toBe(false);
      expect(isSafeSqlString('DROP TABLE users')).toBe(false);
      expect(isSafeSqlString('UNION SELECT')).toBe(false);
      expect(isSafeSqlString('INSERT INTO')).toBe(false);
      expect(isSafeSqlString('DELETE FROM')).toBe(false);
      expect(isSafeSqlString('UPDATE users SET')).toBe(false);
    });

    it('should reject statement separators', () => {
      expect(isSafeSqlString('hello; DROP TABLE')).toBe(false);
    });

    it('should reject stored procedures', () => {
      expect(isSafeSqlString('xp_cmdshell')).toBe(false);
      expect(isSafeSqlString('sp_executesql')).toBe(false);
    });

    it('should be case insensitive', () => {
      expect(isSafeSqlString('select * from users')).toBe(false);
      expect(isSafeSqlString('SELECT * FROM users')).toBe(false);
      expect(isSafeSqlString('SeLeCt * FrOm users')).toBe(false);
    });
  });
});
