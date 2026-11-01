import { createHash, randomBytes } from 'node:crypto';
import { z } from 'zod';

export const emailSchema = z.string().trim().toLowerCase().pipe(z.email());
export const roleSchema = z.enum(['decisore', 'membro']);
export const tokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);
export const nameSchema = z.string().trim().min(1).max(100);
export const uuidSchema = z.uuid();

export function newInviteToken() {
  return randomBytes(32).toString('base64url');
}

export function tokenHash(token: string) {
  return createHash('sha256').update(token).digest('hex');
}
