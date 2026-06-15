import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, requireAuthentication } from "@/lib/api";
import { ExamConflictError, resetExam } from "@/lib/sheets";

const schema = z.object({
  baseRevision: z.number().int().nonnegative(),
});

export async function DELETE(
  request: Request,
  context: { params: Promise<{ studentId: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireAuthentication();
  if (unauthorized) return unauthorized;

  try {
    const { studentId } = await context.params;
    const { baseRevision } = schema.parse(await request.json());
    return NextResponse.json(await resetExam(studentId, baseRevision));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: "초기화할 학생 기록을 확인해 주세요." },
        { status: 400 },
      );
    }
    if (error instanceof ExamConflictError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          latestExam: error.latestExam,
          latestRevision: error.latestRevision,
        },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
