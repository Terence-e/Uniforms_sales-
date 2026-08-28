import { z } from 'zod';

export const loginSchema = z.object({
  email: z.email({ message: 'required' }).trim().toLowerCase(),
  password: z.string({ message: 'required' }).min(6, { message: 'required' }),
  /** Where to send the user after a successful sign-in. */
  redirectTo: z.string().startsWith('/').nullable().default(null)
});

export type LoginInput = z.input<typeof loginSchema>;

/**
 * useActionState's state shape. It lives here rather than in actions/auth.ts
 * because a 'use server' module may only export async functions -- a plain
 * object export breaks the build.
 */
export type LoginState = {
  error: string | null;
  fieldErrors: Partial<Record<'email' | 'password', string>>;
};

export const emptyLoginState: LoginState = { error: null, fieldErrors: {} };

// --- passwords -------------------------------------------------------------

/** Minimum length + a basic strength check (at least one letter and one digit). */
export const passwordSchema = z
  .string()
  .min(8, { message: 'passwordShort' })
  .regex(/[A-Za-z]/, { message: 'passwordLetter' })
  .regex(/[0-9]/, { message: 'passwordNumber' });

export const changePasswordSchema = z
  .object({
    current: z.string().min(1, { message: 'required' }),
    password: passwordSchema,
    confirm: z.string()
  })
  .refine((d) => d.password === d.confirm, {
    path: ['confirm'],
    message: 'passwordMismatch'
  })
  .refine((d) => d.password !== d.current, {
    path: ['password'],
    message: 'passwordSame'
  });

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;

/** A rough 0–3 strength score for the meter (length + character variety). */
export function passwordScore(value: string): 0 | 1 | 2 | 3 {
  if (!value) return 0;
  let score = 0;
  if (value.length >= 8) score++;
  if (/[A-Za-z]/.test(value) && /[0-9]/.test(value)) score++;
  if (value.length >= 12 && /[^A-Za-z0-9]/.test(value)) score++;
  return score as 0 | 1 | 2 | 3;
}

// --- accounts (Super Admin creates users) ----------------------------------

/** The fixed role set (spec A-2). There is deliberately no way to add roles. */
export const ROLES = ['seller', 'administration', 'maintenance', 'super_admin'] as const;
export type Role = (typeof ROLES)[number];

export const createAccountSchema = z.object({
  full_name: z.string().trim().min(1, { message: 'required' }).max(120),
  email: z.email({ message: 'invalidEmail' }).trim().toLowerCase(),
  role: z.enum(ROLES),
  password: passwordSchema
});

export type CreateAccountInput = z.infer<typeof createAccountSchema>;
