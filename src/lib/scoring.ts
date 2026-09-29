import type { ExamLevel, Outcome } from "./types";

export const MAX_SCORE = 50;
export const BASE_SCORE = 30;
export const FAILED_SCORE = 38;
export const REDRAW_PENALTY = 3;

// 처음 뽑은 문제를 해결했을 때의 점수입니다. 다시 뽑으면 한 단계(3점) 내려갑니다.
const SOLVED_SCORES: Record<ExamLevel, number> = {
  HIGH: 50,
  MID: 47,
  LOW: 44,
  OWN: 41,
};

export function calculateScore(level: ExamLevel, redrawn: boolean, outcome: Outcome): number {
  if (outcome === "FAILED") return FAILED_SCORE;
  if (outcome === "NO_ATTEMPT") return BASE_SCORE;
  return SOLVED_SCORES[level] - (redrawn && level !== "OWN" ? REDRAW_PENALTY : 0);
}

export interface OutcomeOption {
  outcome: Outcome;
  label: string;
  description: string;
  points: number;
}

export function outcomeOptions(level: ExamLevel, redrawn: boolean): OutcomeOption[] {
  return [
    {
      outcome: "SOLVED",
      label: "해결·설명 성공",
      description: "제한 시간 안에 풀고 수학적 오류 없이 논리적으로 설명",
      points: calculateScore(level, redrawn, "SOLVED"),
    },
    {
      outcome: "FAILED",
      label: "시도했으나 해결 못함",
      description: "제한 시간 안에 논리적으로 해결하지 못함",
      points: FAILED_SCORE,
    },
    {
      outcome: "NO_ATTEMPT",
      label: "시도하지 않음",
      description: "문제를 풀려고 시도하지 않음",
      points: BASE_SCORE,
    },
  ];
}

