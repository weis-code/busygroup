import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const secret = new TextEncoder().encode(
  process.env.JWT_SECRET ?? 'nls-dev-secret-change-in-prod-32chars'
);

export const COOKIE_NAME = 'nls_session';
export type Role = 'ADMIN' | 'MANAGER' | 'SELLER';

export interface Session {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export async function signSession(payload: Session): Promise<string> {
  return new SignJWT(payload as unknown as Record<string, unknown>)
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('30d')
    .sign(secret);
}

export async function verifySession(token: string): Promise<Session | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as Session;
  } catch {
    return null;
  }
}

export async function getSession(): Promise<Session | null> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifySession(token);
}

export function sessionFromRequest(req: NextRequest): Session | null {
  const id = req.headers.get('x-user-id');
  const role = req.headers.get('x-user-role') as Role | null;
  const name = req.headers.get('x-user-name') ?? '';
  const email = req.headers.get('x-user-email') ?? '';
  if (!id || !role) return null;
  return { id, role, name, email };
}
