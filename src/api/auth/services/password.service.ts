import bcrypt from 'bcrypt';
import { env } from '../../../config/env';

export class PasswordService {
  private readonly bcryptRounds = env.BCRYPT_ROUNDS;

  // Password validation rules
  private readonly minLength = 12;
  private readonly maxLength = 128;
  private readonly requireUppercase = true;
  private readonly requireLowercase = true;
  private readonly requireNumbers = true;
  private readonly requireSpecialChars = true;

  /**
   * Hash password using bcrypt
   */
  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.bcryptRounds);
  }

  /**
   * Compare password with hash
   */
  async compare(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Validate password strength
   */
  validate(password: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (password.length < this.minLength) {
      errors.push(`Password must be at least ${this.minLength} characters long`);
    }

    if (password.length > this.maxLength) {
      errors.push(`Password must not exceed ${this.maxLength} characters`);
    }

    if (this.requireUppercase && !/[A-Z]/.test(password)) {
      errors.push('Password must contain at least one uppercase letter');
    }

    if (this.requireLowercase && !/[a-z]/.test(password)) {
      errors.push('Password must contain at least one lowercase letter');
    }

    if (this.requireNumbers && !/\d/.test(password)) {
      errors.push('Password must contain at least one number');
    }

    if (this.requireSpecialChars && !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
      errors.push('Password must contain at least one special character (!@#$%^&*(),.?":{}|<>)');
    }

    // Check for common patterns
    if (/^(.)\1+$/.test(password)) {
      errors.push('Password cannot be all the same character');
    }

    if (/^(123|abc|qwerty|password)/i.test(password)) {
      errors.push('Password contains common patterns');
    }

    return {
      valid: errors.length === 0,
      errors
    };
  }

  /**
   * Check if password contains user info (should be avoided)
   */
  containsUserInfo(password: string, email: string, firstName: string, lastName: string): boolean {
    const lowercasePassword = password.toLowerCase();
    const emailUsername = email.split('@')[0].toLowerCase();

    if (lowercasePassword.includes(emailUsername)) return true;
    if (firstName && lowercasePassword.includes(firstName.toLowerCase())) return true;
    if (lastName && lowercasePassword.includes(lastName.toLowerCase())) return true;

    return false;
  }

  /**
   * Generate a secure random password
   */
  generateSecurePassword(length = 16): string {
    const uppercase = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
    const lowercase = 'abcdefghijklmnopqrstuvwxyz';
    const numbers = '0123456789';
    const special = '!@#$%^&*()';
    const all = uppercase + lowercase + numbers + special;

    let password = '';

    // Ensure at least one of each required type
    password += uppercase[Math.floor(Math.random() * uppercase.length)];
    password += lowercase[Math.floor(Math.random() * lowercase.length)];
    password += numbers[Math.floor(Math.random() * numbers.length)];
    password += special[Math.floor(Math.random() * special.length)];

    // Fill the rest
    for (let i = password.length; i < length; i++) {
      password += all[Math.floor(Math.random() * all.length)];
    }

    // Shuffle the password
    return password.split('').sort(() => Math.random() - 0.5).join('');
  }
}

export const passwordService = new PasswordService();
