import { NextResponse } from "next/server";
import { z } from "zod";

import { apiError, requireAuthentication } from "@/lib/api";
import { isOpenRound } from "@/lib/rounds";
import { ExamConflictError, submitExam } from "@/lib/sheets";
import type { ExamSubmission } from "@/lib/types";

const nullableText = z.string().min(1).max(200).nullable();
const examSchema = z.object({
  examId: z.string().min(1).max(100),
  round: z.number().int().refine(isOpenRound, "열려 있지 않은 차수입니다."),
  studentId: z.string().min(1).max(20),
  className: z.string().max(20),
  number: z.number(),
  name: z.string().max(50),
  level: z.enum(["HIGH", "MID", "LOW", "OWN"]),
  firstQuestionId: nullableText,
  redrawQuestionId: nullableText,
  redrawAt: nullableText,
  startedAt: z.string().min(1).max(40),
  endedAt: z.string().max(40).nullable(),
  outcome: z.enum(["SOLVED", "FAILED", "NO_ATTEMPT"]),
  score: z.number().nullable(),
  memo: z.string().max(1000),
  status: z.enum(["IN_PROGRESS", "COMPLETED"]),
  updatedAt: z.string().max(40),
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

