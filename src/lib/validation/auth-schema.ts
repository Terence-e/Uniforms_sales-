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
