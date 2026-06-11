import type { Exam } from "@/lib/types";

export type SaveType = "CREATE" | "UPDATE" | "FORCE_OVERWRITE";

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
