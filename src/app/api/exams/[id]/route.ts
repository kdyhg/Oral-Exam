import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, requireAuthentication } from "@/lib/api";
import { updateExam } from "@/lib/sheets";

const markSchema = z.union([z.literal("O"), z.literal("X"), z.null()]);
const schema = z.object({
  scores: z
    .array(
      z.object({
        questionId: z.string().min(1),
        correct: markSchema,
        fluency: markSchema,
      }),
    )
    .length(3)
    .optional(),
  memo: z.string().max(1000).optional(),
  hintQuestionId: z.string().min(1).optional(),
  status: z.literal("COMPLETED").optional(),
});

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const unauthorized = await requireAuthentication();
  if (unauthorized) return unauthorized;

  try {
    const { id } = await context.params;
    const patch = schema.parse(await request.json());
    return NextResponse.json(await updateExam(id, patch));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "저장할 평가 값을 확인해 주세요." }, { status: 400 });
    }
    return apiError(error);
  }
}
