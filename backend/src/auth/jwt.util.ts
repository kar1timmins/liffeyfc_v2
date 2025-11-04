import { sign, verify, type SignOptions } from 'jsonwebtoken';

const JWT_SECRET = (process.env.JWT_SECRET || 'dev_secret_change_me') as string;

export function signJwt(payload: object, expiresIn: string | number = '15m') {
  const opts: SignOptions = { expiresIn } as SignOptions;
  return sign(payload as any, JWT_SECRET as any, opts);
}

export function verifyJwt(token: string) {
  try {
    return verify(token as any, JWT_SECRET as any);
  } catch (e) {
    return null;
  }
}
