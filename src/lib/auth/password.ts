import {
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
  type ScryptOptions,
} from 'node:crypto';

/**
 * `promisify` picks the 3-argument scrypt overload, which drops the options
 * parameter we need for the cost factors. Wrapping it explicitly keeps them.
 */
function scrypt(
  password: string,
  salt: Buffer,
  keylen: number,
  options: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keylen, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

/**
 * scrypt parameters. N=16384 (2^14) with r=8, p=1 is the Node default recommendation
 * and costs ~100ms of CPU per verification — enough to make offline cracking of a
 * leaked hash expensive, cheap enough not to be a request-time problem.
 *
 * scrypt is used rather than argon2/bcrypt because it is in the standard library:
 * no native build step to break on Windows or in a serverless build image.
 * See docs/decisions.md D2.
 */
const KEY_LENGTH = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 } as const;

export interface PasswordRecord {
  hash: string;
  salt: string;
}

export async function hashPassword(password: string): Promise<PasswordRecord> {
  const salt = randomBytes(16);
  const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
  return { hash: derived.toString('hex'), salt: salt.toString('hex') };
}

/**
 * Constant-time verification. Returns false rather than throwing on malformed
 * stored values so a corrupt row cannot be distinguished from a wrong password.
 */
export async function verifyPassword(
  password: string,
  record: PasswordRecord,
): Promise<boolean> {
  try {
    const salt = Buffer.from(record.salt, 'hex');
    const expected = Buffer.from(record.hash, 'hex');
    if (expected.length !== KEY_LENGTH) return false;

    const derived = await scrypt(password, salt, KEY_LENGTH, SCRYPT_OPTIONS);
    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export const PASSWORD_MIN_LENGTH = 10;

/**
 * Deliberately minimal: length is the property that actually correlates with
 * strength. Composition rules push users toward predictable substitutions.
 */
export function validatePassword(password: string): string | null {
  if (password.length < PASSWORD_MIN_LENGTH) {
    return `Use at least ${PASSWORD_MIN_LENGTH} characters.`;
  }
  if (password.length > 200) return 'That password is unusually long — please shorten it.';
  return null;
}
