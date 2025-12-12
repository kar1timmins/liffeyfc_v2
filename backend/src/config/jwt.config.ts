import * as crypto from 'crypto';

/**
 * JWT Configuration with security validation
 */
export class JwtConfig {
  private static _secret: string | null = null;

  /**
   * Minimum secret length in bytes (32 bytes = 256 bits)
   * This ensures sufficient entropy for HS256 algorithm
   */
  private static readonly MIN_SECRET_LENGTH = 32;

  /**
   * Get JWT secret with validation
   * Throws error if secret is not configured or is insecure
   */
  static getSecret(): string {
    if (this._secret) {
      return this._secret;
    }

    const secret = process.env.JWT_SECRET;

    // Require JWT_SECRET to be set
    if (!secret) {
      throw new Error(
        'FATAL: JWT_SECRET environment variable is not set. ' +
        'Please set a secure random secret (at least 32 bytes). ' +
        'You can generate one using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    // Validate minimum length
    if (secret.length < this.MIN_SECRET_LENGTH) {
      throw new Error(
        `FATAL: JWT_SECRET is too short (${secret.length} characters). ` +
        `Minimum length is ${this.MIN_SECRET_LENGTH} characters for security. ` +
        'Please generate a strong secret using: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    // Warn if secret looks weak (all lowercase alphanumeric, common patterns)
    if (this.isWeakSecret(secret)) {
      console.warn(
        '⚠️  WARNING: JWT_SECRET appears to be weak. ' +
        'Consider using a cryptographically random secret. ' +
        'Generate one with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
      );
    }

    this._secret = secret;
    return this._secret;
  }

  /**
   * Validate JWT configuration at startup
   * Should be called before application starts accepting requests
   */
  static validate(): void {
    try {
      const secret = this.getSecret();
      const isDevelopment = process.env.NODE_ENV !== 'production';
      
      if (isDevelopment) {
        console.log('✅ JWT_SECRET validated successfully');
        console.log(`   Length: ${secret.length} characters (minimum: ${this.MIN_SECRET_LENGTH})`);
        console.log(`   Algorithm: HS256`);
      }
    } catch (error) {
      console.error('❌ JWT Configuration Error:', error.message);
      throw error;
    }
  }

  /**
   * Detect potentially weak secrets
   * Returns true if secret appears to be weak
   */
  private static isWeakSecret(secret: string): boolean {
    // Check if it's a valid hex string of sufficient length (crypto.randomBytes output)
    const isStrongHex = /^[0-9a-f]{64,}$/i.test(secret);
    if (isStrongHex) {
      return false; // Strong cryptographic hex string
    }

    // Check for common weak patterns
    const weakPatterns = [
      /^(.)\1+$/,                // Repeated character (e.g., "aaaaaaa")
      /^(password|secret|key)/i, // Common words
      /^[0-9]+$/,                // Only numbers (not hex)
      /^[a-z]+$/i,               // Only letters (no numbers or special chars)
    ];

    // Check if it has variety in character types
    const hasLowerCase = /[a-z]/.test(secret);
    const hasUpperCase = /[A-Z]/.test(secret);
    const hasNumbers = /[0-9]/.test(secret);
    const hasSpecialChars = /[^a-zA-Z0-9]/.test(secret);

    const varietyCount = [hasLowerCase, hasUpperCase, hasNumbers, hasSpecialChars].filter(Boolean).length;

    // Weak if matches a weak pattern or has very low variety (only 1 type)
    return weakPatterns.some(pattern => pattern.test(secret)) || varietyCount < 2;
  }

  /**
   * Generate a secure random secret (for development/setup)
   * This is a helper function - secrets should be generated externally
   */
  static generateSecureSecret(): string {
    return crypto.randomBytes(32).toString('hex');
  }
}
