import type { Exam, Student } from "@/lib/types";

export type SaveType = "CREATE" | "UPDATE" | "FORCE_OVERWRITE" | "RESET";

export function hasRevisionConflict(
  baseRevision: number,
  currentRevision: number,
  forceOverwrite: boolean,
): boolean {
  return baseRevision !== currentRevision && !forceOverwrite;
}

export function nextRevision(currentRevision: number): number {
  return currentRevision + 1;
}

export function storedEndedAt(existing: Exam | null, now: string): string {
  return existing?.endedAt ?? now;
}

export function saveType(existing: Exam | null, forceOverwrite: boolean): SaveType {
  if (forceOverwrite) return "FORCE_OVERWRITE";
  return existing ? "UPDATE" : "CREATE";
}

export function resetHistoryExam(existing: Exam, now: string): Exam {
  return {
    ...existing,
    updatedAt: now,
    revision: nextRevision(existing.revision),
  };
}

export function serializeResetRecord(
  student: Student,
  revision: number,
): (string | number)[] {
  return [
    "",
    student.studentId,
    student.className,
    student.number,
    student.name,
    ...Array<string>(14).fill(""),
    revision,
  ];
}
