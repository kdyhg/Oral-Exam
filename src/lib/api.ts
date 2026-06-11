import { NextResponse } from "next/server";

import { isAuthenticated } from "@/lib/auth";

export async function requireAuthentication(): Promise<NextResponse | null> {
  if (!(await isAuthenticated())) {
    return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });
  }
  return null;
}

export function apiError(error: unknown): NextResponse {
  const message = error instanceof Error ? error.message : "알 수 없는 오류가 발생했습니다.";
  const configurationError = message.includes("환경변수");
  console.error(error);
  return NextResponse.json(
    { error: message },
    { status: configurationError ? 503 : 500 },
  );
}
