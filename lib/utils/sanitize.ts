/**
 * Input Sanitization Utilities
 * Provides functions to sanitize and validate user inputs
 * Requirements: 8.4
 */

/**
 * Sanitize a string by removing potentially dangerous characters
 * Removes control characters and normalizes whitespace
 */
export function sanitizeString(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input
    // Remove control characters (except newline, tab, carriage return)
    .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '')
    // Normalize whitespace
    .trim();
}

/**
 * Sanitize an alphanumeric string (letters and numbers only)
 * Useful for codes, IDs, etc.
 */
export function sanitizeAlphanumeric(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input.replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Validate and sanitize an email address
 * Returns empty string if invalid
 */
export function sanitizeEmail(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  const sanitized = sanitizeString(input).toLowerCase();
  
  // Basic email validation
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(sanitized)) {
    return '';
  }
  
  return sanitized;
}

/**
 * Sanitize a URL
 * Returns empty string if invalid or uses dangerous protocol
 */
export function sanitizeUrl(input: string): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  const sanitized = sanitizeString(input);
  
  try {
    const url = new URL(sanitized);
    
    // Only allow http and https protocols
    if (!['http:', 'https:'].includes(url.protocol)) {
      return '';
    }
    
    return url.toString();
  } catch {
    return '';
  }
}

/**
 * Limit string length to prevent DoS attacks
 */
export function limitLength(input: string, maxLength: number): string {
  if (typeof input !== 'string') {
    return '';
  }
  
  return input.slice(0, maxLength);
}

/**
 * Sanitize object by removing undefined and null values
 * Useful for cleaning up request bodies
 */
export function sanitizeObject<T extends Record<string, any>>(
  obj: T
): Partial<T> {
  const result: Partial<T> = {};
  
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      result[key as keyof T] = value;
    }
  }
  
  return result;
}

/**
 * Validate that a string contains only safe characters for SQL
 * This is a defense-in-depth measure; parameterized queries should be primary defense
 */
export function isSafeSqlString(input: string): boolean {
  if (typeof input !== 'string') {
    return false;
  }
  
  // Check for common SQL injection patterns
  const dangerousPatterns = [
    /--/,           // SQL comment
    /;/,            // Statement separator
    /\/\*/,         // Multi-line comment start
    /\*\//,         // Multi-line comment end
    /xp_/i,         // Extended stored procedures
    /sp_/i,         // System stored procedures
    /exec/i,        // Execute command
    /execute/i,     // Execute command
    /union/i,       // Union query
    /select.*from/i, // Select statement
    /insert.*into/i, // Insert statement
    /delete.*from/i, // Delete statement
    /update.*set/i,  // Update statement
    /drop.*table/i,  // Drop table
  ];
  
  return !dangerousPatterns.some(pattern => pattern.test(input));
}
