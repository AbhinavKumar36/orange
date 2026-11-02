/**
 * Phone Number Normalization and Validation Module
 * Standardizes Indian mobile numbers to E.164 format (+91XXXXXXXXXX)
 * and enforces strict validation across Web, Backend, and Tests.
 */

export interface PhoneNormalizationResult {
  isValid: boolean;
  e164?: string;
  nationalNumber?: string;
  error?: string;
}

/**
 * Normalizes an Indian phone number string to canonical E.164 format (+91XXXXXXXXXX).
 * Handles common user entry patterns:
 *  - 10 digits: "9876543210" -> "+919876543210"
 *  - Domestic trunk "0": "09876543210" -> "+919876543210"
 *  - Prefix "91": "919876543210" -> "+919876543210"
 *  - Full E.164: "+919876543210" -> "+919876543210"
 *  - Redundant trunk zero with +91: "+9109876543210" -> "+919876543210"
 *  - Punctuation/spaces: "+91 (98765) 43210" -> "+919876543210"
 */
export function normalizeIndianPhoneNumber(input: string | null | undefined): PhoneNormalizationResult {
  if (!input || typeof input !== 'string' || !input.trim()) {
    return { isValid: false, error: 'Phone number cannot be empty.' };
  }

  const trimmed = input.trim();

  // Check for invalid characters (letters or disallowed symbols)
  // Allowed characters before normalization: digits, spaces, hyphens, periods, parentheses, leading plus
  if (/[^0-9+\s\-().]/.test(trimmed)) {
    return { isValid: false, error: 'Phone number contains invalid characters.' };
  }

  // Check for duplicate plus signs
  if ((trimmed.match(/\+/g) || []).length > 1) {
    return { isValid: false, error: 'Duplicate country prefix detected.' };
  }

  const hasPlus = trimmed.startsWith('+');

  // Strip all non-digit characters
  const digitsOnly = trimmed.replace(/\D/g, '');

  if (!digitsOnly) {
    return { isValid: false, error: 'Phone number contains no digits.' };
  }

  // Check if international code is not India (+91)
  if (hasPlus) {
    if (!trimmed.startsWith('+91')) {
      return {
        isValid: false,
        error: 'Only Indian mobile numbers (+91) are currently supported.',
      };
    }
  }

  let subscriberDigits = digitsOnly;

  // Check for duplicate 91 prefixes, e.g. "91919876543210"
  if (digitsOnly.startsWith('9191') && digitsOnly.length === 14) {
    return { isValid: false, error: 'Duplicate country prefix detected.' };
  }

  // Strip leading 91 if full 12 digits or if preceded by +
  if (hasPlus && subscriberDigits.startsWith('91')) {
    subscriberDigits = subscriberDigits.slice(2);
  } else if (!hasPlus && subscriberDigits.startsWith('91') && subscriberDigits.length === 12) {
    subscriberDigits = subscriberDigits.slice(2);
  }

  // Strip leading domestic trunk zero "0", e.g. "09876543210" -> "9876543210"
  if (subscriberDigits.startsWith('0')) {
    subscriberDigits = subscriberDigits.replace(/^0+/, '');
  }

  // In India, mobile subscriber numbers are exactly 10 digits
  if (subscriberDigits.length !== 10) {
    return {
      isValid: false,
      error: `Invalid phone number length (${subscriberDigits.length} digits). Indian mobile numbers must have exactly 10 digits.`,
    };
  }

  // Indian mobile subscriber numbers begin with 6, 7, 8, or 9
  if (!/^[6-9]/.test(subscriberDigits)) {
    return {
      isValid: false,
      error: 'Invalid Indian mobile number. Mobile numbers must begin with 6, 7, 8, or 9.',
    };
  }

  const e164 = `+91${subscriberDigits}`;

  return {
    isValid: true,
    e164,
    nationalNumber: subscriberDigits,
  };
}

/**
 * Validates whether a given phone number can be normalized to a valid Indian E.164 number.
 */
export function isValidIndianPhoneNumber(input: string | null | undefined): boolean {
  return normalizeIndianPhoneNumber(input).isValid;
}

