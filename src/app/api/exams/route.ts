import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, requireAuthentication } from "@/lib/api";
import { createExam } from "@/lib/sheets";

const schema = z.object({
  studentId: z.string().min(1),
  selfQuestionId: z.string().min(1),
});

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = await requireAuthentication();
  if (unauthorized) return unauthorized;

  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(await createExam(input.studentId, input.selfQuestionId));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "학생과 자기선택형 문항을 확인해 주세요." }, { status: 400 });
    }
    return apiError(error);
  }
}
