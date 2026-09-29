import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";

// 사용자가 고칠 수 있는 입력 오류입니다. 400으로 응답합니다.
export class InputError extends Error {}

export async function requireAuthentication(): Promise<NextResponse | null> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return null;
}

export function apiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  if (error instanceof InputError) {
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const configurationError = message.includes("환경변수");
  console.error(error);
  return NextResponse.json(
    { error: message },
    { status: configurationError ? 503 : 500 },
  );
}
