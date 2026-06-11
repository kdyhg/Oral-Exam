import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, requireAuthentication } from "@/lib/api";
import { ExamConflictError, submitExam } from "@/lib/sheets";
import type { ExamSubmission } from "@/lib/types";

const markSchema = z.union([z.literal("O"), z.literal("X"), z.null()]);
const examSchema = z.object({
  examId: z.string().min(1),
  studentId: z.string().min(1),
  className: z.string(),
  number: z.number(),
  name: z.string(),
  selfQuestionId: z.string().min(1),
  randomQuestionIds: z.tuple([z.string().min(1), z.string().min(1)]),
  startedAt: z.string().min(1),
  endedAt: z.string().nullable(),
  hintQuestionId: z.string().nullable(),
  hintAt: z.string().nullable(),
  scores: z
    .array(z.object({ questionId: z.string().min(1), correct: markSchema }))
    .length(3),
  fluency: markSchema,
  memo: z.string().max(1000),
  status: z.union([z.literal("IN_PROGRESS"), z.literal("COMPLETED")]),
  updatedAt: z.string(),
  revision: z.number().int().nonnegative(),
});
const schema = z.object({
  exam: examSchema,
  baseRevision: z.number().int().nonnegative(),
  forceOverwrite: z.boolean(),
});

export async function POST(request: Request): Promise<NextResponse> {
  const unauthorized = await requireAuthentication();
  if (unauthorized) return unauthorized;

  try {
    const input = schema.parse(await request.json());
    return NextResponse.json(await submitExam(input as ExamSubmission));
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: "최종 평가 결과를 확인해 주세요." }, { status: 400 });
    }
    if (error instanceof ExamConflictError) {
      return NextResponse.json(
        { error: error.message, code: error.code, latestExam: error.latestExam },
        { status: 409 },
      );
    }
    return apiError(error);
  }
}
