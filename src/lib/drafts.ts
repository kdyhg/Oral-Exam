import { isExamLevel } from "./exam-rules";
import type { Round } from "./rounds";
import type { Exam, ExamDraft } from "./types";

export const DRAFT_TTL_MS = 24 * 60 * 60 * 1000;

export type ExamDrafts = Record<string, ExamDraft>;

export function draftStorageKey(round: Round): string {
  return `docent-drafts-round${round}-v1`;
}

export function parseDrafts(raw: string | null, round: Round, now = Date.now()): ExamDrafts {
  if (!raw) return {};
  try {
    const value: unknown = JSON.parse(raw);
    if (!value || typeof value !== "object" || Array.isArray(value)) return {};
    return Object.fromEntries(
      Object.entries(value).flatMap(([studentId, candidate]) => {
        const draft = normalizeDraft(studentId, round, candidate);
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

function normalizeDraft(studentId: string, round: Round, candidate: unknown): ExamDraft | null {
  if (!studentId || !candidate || typeof candidate !== "object" || !("exam" in candidate)) {
    return null;
  }
  const draft = candidate as Partial<ExamDraft>;
  const exam = draft.exam;
  if (
    !exam ||
    typeof exam !== "object" ||
    exam.studentId !== studentId ||
    exam.round !== round ||
    !isExamLevel(exam.level) ||
    !validDate(draft.touchedAt)
  ) {
    return null;
  }
  return {
    exam: { ...exam, revision: numberOrZero(exam.revision) },
    baseRevision: numberOrZero(draft.baseRevision),
    touchedAt: draft.touchedAt,
  };
}

function validDate(value: unknown): value is string {
  return typeof value === "string" && !Number.isNaN(Date.parse(value));
}

function numberOrZero(value: unknown): number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 ? value : 0;
}

