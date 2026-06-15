import type { Exam, ExamDraft } from "@/lib/types";

export const DRAFT_STORAGE_KEY = "oral-exam-drafts-v3";
export const LEGACY_DRAFT_STORAGE_KEY = "oral-exam-drafts-v2";
export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type ExamDrafts = Record<string, ExamDraft>;

export function parseDrafts(raw: string | null, now = Date.now()): ExamDrafts {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).flatMap(([studentId, candidate]) => {
        const draft = normalizeDraft(studentId, candidate);
        if (!draft || now - Date.parse(draft.touchedAt) >= DRAFT_TTL_MS) return [];
        return [[studentId, draft]];
      }),
    );
  } catch {
    return {};
  }
}

export function mergeExams(saved: Exam[], drafts: ExamDrafts): Exam[] {
  const merged = new Map(saved.map((exam) => [exam.studentId, exam]));
  Object.values(drafts).forEach(({ exam }) => merged.set(exam.studentId, exam));
  return [...merged.values()];
}

export function isDraftStale(draft: ExamDraft, currentRevision: number): boolean {
  return draft.baseRevision !== currentRevision;
}

export function pruneExpiredDrafts(drafts: ExamDrafts, now = Date.now()): ExamDrafts {
  const active = Object.entries(drafts).filter(
    ([, draft]) => now - Date.parse(draft.touchedAt) < DRAFT_TTL_MS,
  );
  return active.length === Object.keys(drafts).length ? drafts : Object.fromEntries(active);
}

function normalizeDraft(studentId: string, candidate: unknown): ExamDraft | null {
  if (!studentId || !candidate || typeof candidate !== "object") return null;

  if ("exam" in candidate) {
    const draft = candidate as Partial<ExamDraft>;
    if (!isExamDraftValue(studentId, draft.exam)) return null;
    const touchedAt = validDate(draft.touchedAt) ? draft.touchedAt : draft.exam.updatedAt;
    if (!validDate(touchedAt)) return null;
    return {
      exam: { ...draft.exam, revision: numberOrZero(draft.exam.revision) },
      baseRevision: numberOrZero(draft.baseRevision),
      touchedAt,
    };
  }

  // Preserve valid drafts from the previous storage format during the upgrade.
  if (!isExamDraftValue(studentId, candidate)) return null;
  const exam = candidate as Exam;
  const touchedAt = validDate(exam.updatedAt) ? exam.updatedAt : exam.startedAt;
  if (!validDate(touchedAt)) return null;
  return {
    exam: { ...exam, revision: numberOrZero(exam.revision) },
    baseRevision: numberOrZero(exam.revision),
    touchedAt,
  };
}

function isExamDraftValue(studentId: string, value: unknown): value is Exam {
  return Boolean(
    value &&
      typeof value === "object" &&
      "studentId" in value &&
      value.studentId === studentId &&
      "scores" in value &&
      Array.isArray(value.scores) &&
      value.scores.length === 3,
  );
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}
