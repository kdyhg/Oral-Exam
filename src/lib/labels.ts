import type { Difficulty, ExamLevel, Outcome } from "./types";

export const DIFFICULTIES: readonly Difficulty[] = ["HIGH", "MID", "LOW"];
export const EXAM_LEVELS: readonly ExamLevel[] = ["HIGH", "MID", "LOW", "OWN"];
export const OUTCOMES: readonly Outcome[] = ["SOLVED", "FAILED", "NO_ATTEMPT"];

// Sheet에 기록되는 짧은 표기입니다.
export const LEVEL_LABELS: Record<ExamLevel, string> = {
  HIGH: "상",
  MID: "중",
  LOW: "하",
  OWN: "준비문제",
};

export const LEVEL_TITLES: Record<ExamLevel, string> = {
  HIGH: "상 난이도",
  MID: "중 난이도",
  LOW: "하 난이도",
  OWN: "자신이 준비한 문제",
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  SOLVED: "해결",
  FAILED: "미해결",
  NO_ATTEMPT: "미시도",
};

export function levelFromLabel(value: string): ExamLevel | null {
  return EXAM_LEVELS.find((level) => LEVEL_LABELS[level] === value) ?? null;
}

export function difficultyFromLabel(value: string): Difficulty | null {
  return DIFFICULTIES.find((difficulty) => LEVEL_LABELS[difficulty] === value) ?? null;
}

export function outcomeFromLabel(value: string): Outcome | null {
  return OUTCOMES.find((outcome) => OUTCOME_LABELS[outcome] === value) ?? null;
}

