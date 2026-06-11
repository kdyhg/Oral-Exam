import { NextResponse } from "next/server";

import { apiError, requireAuthentication } from "@/lib/api";
import { getBootstrapData } from "@/lib/sheets";

export const dynamic = "force-dynamic";

export async function GET(): Promise<NextResponse> {
  const unauthorized = await requireAuthentication();
  if (unauthorized) return unauthorized;

  try {
    return NextResponse.json(await getBootstrapData());
  } catch (error) {
    return apiError(error);
  }
}
