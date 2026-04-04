import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'busygroup-dev-secret-change-in-production-32chars'
);

export const PORTAL_COOKIE = 'bg_portal_session';
export const PORTAL_COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 dage

export interface PortalCustomer {
  id: string;
  company: string;
  contact_name: string | null;
  contact_email: string | null;
}

export async function signPortalToken(customer: PortalCustomer): Promise<string> {
  return new SignJWT({ ...customer, type: 'portal' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(SECRET);
}

export async function verifyPortalToken(token: string): Promise<PortalCustomer | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    if (payload.type !== 'portal') return null;
    return payload as unknown as PortalCustomer;
  } catch {
    return null;
  }
}

// Server component / API route
export async function getPortalSession(): Promise<PortalCustomer | null> {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get(PORTAL_COOKIE)?.value;
    if (!token) return null;
    return verifyPortalToken(token);
  } catch {
    return null;
  }
}

// Middleware / Edge
export async function getPortalSessionFromRequest(req: NextRequest): Promise<PortalCustomer | null> {
  const token = req.cookies.get(PORTAL_COOKIE)?.value;
  if (!token) return null;
  return verifyPortalToken(token);
}
