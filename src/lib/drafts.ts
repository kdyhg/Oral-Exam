import type { Exam } from "@/lib/types";

export const DRAFT_STORAGE_KEY = "oral-exam-drafts-v2";

export type ExamDrafts = Record<string, Exam>;

export function parseDrafts(raw: string | null): ExamDrafts {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).filter(
        ([studentId, exam]) =>
          studentId &&
          exam &&
          typeof exam === "object" &&
          "studentId" in exam &&
          exam.studentId === studentId &&
          "scores" in exam &&
          Array.isArray(exam.scores) &&
          exam.scores.length === 3,
      ),
    ) as ExamDrafts;
  } catch {
    return {};
  }
}

export function mergeExams(saved: Exam[], drafts: ExamDrafts): Exam[] {
  const merged = new Map(saved.map((exam) => [exam.studentId, exam]));
  Object.values(drafts).forEach((exam) => merged.set(exam.studentId, exam));
  return [...merged.values()];
}
