import { NextResponse } from "next/server";

import { apiError, requireAuthentication } from "@/lib/api";
import { isOpenRound } from "@/lib/rounds";
import { getBootstrapData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<NextResponse> {
  const unauthorized = await requireAuthentication();
  if (unauthorized) return unauthorized;

  const round = Number(new URL(request.url).searchParams.get("round"));
  if (!isOpenRound(round)) {
    return NextResponse.json({ error: "아직 열리지 않은 평가 차수입니다." }, { status: 403 });
  }

  try {
    return NextResponse.json(await getBootstrapData(round));
  } catch (error) {
    return apiError(error);
  }
}

