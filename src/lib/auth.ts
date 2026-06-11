import { createHash, timingSafeEqual } from "node:crypto";

import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";

const COOKIE_NAME = "oral_exam_session";
const SESSION_TTL = 60 * 60 * 12;

function requiredEnv(name: "APP_PIN" | "SESSION_SECRET"): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} 환경변수가 설정되지 않았습니다.`);
  }
  return value;
}

function secret(): Uint8Array {
  return new TextEncoder().encode(requiredEnv("SESSION_SECRET"));
}

export function isValidPin(pin: string): boolean {
  const expected = createHash("sha256").update(requiredEnv("APP_PIN")).digest();
  const received = createHash("sha256").update(pin).digest();
  return timingSafeEqual(expected, received);
}

export async function createSessionToken(): Promise<string> {
  return new SignJWT({ role: "teacher" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${SESSION_TTL}s`)
    .sign(secret());
}

export async function isAuthenticated(): Promise<boolean> {
  const token = (await cookies()).get(COOKIE_NAME)?.value;
  if (!token) return false;

  try {
    const result = await jwtVerify(token, secret());
    return result.payload.role === "teacher";
  } catch {
    return false;
  }
}

export const sessionCookie = {
  name: COOKIE_NAME,
  maxAge: SESSION_TTL,
};
