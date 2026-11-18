// Sign-in schemas shared by the API server and the browser client.
import { z } from 'zod';

export const ROLES = ['user', 'admin'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const LoginSchema = z.strictObject({
  username: z.string().trim().min(1, 'Enter your username.'),
  password: z.string().min(1, 'Enter your password.'),
});
export type LoginInput = z.input<typeof LoginSchema>;

export const SessionUserSchema = z.object({ username: z.string(), role: RoleSchema });
export type SessionUser = z.infer<typeof SessionUserSchema>;

/** Body of POST /api/auth/login and GET /api/auth/me; `user` is null when nobody is signed in. */
export const SessionSchema = z.object({ user: SessionUserSchema.nullable() });
export type Session = z.infer<typeof SessionSchema>;
