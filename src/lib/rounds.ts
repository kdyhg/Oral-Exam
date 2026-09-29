export type Round = 1 | 2;

export interface RoundOption {
  id: Round;
  label: string;
  open: boolean;
}

// 2차 평가를 열 때는 open 값을 true로 바꾸고 2차 문항과 기록 탭을 준비합니다.
export const ROUNDS: readonly RoundOption[] = [
  { id: 1, label: "1차", open: true },
  { id: 2, label: "2차", open: false },
];

export function isOpenRound(value: unknown): value is Round {
  return ROUNDS.some((round) => round.open && round.id === value);
}

export function roundLabel(round: Round): string {
  return ROUNDS.find((item) => item.id === round)?.label ?? `${round}차`;
}

export function recordSheetName(round: Round): string {
  return `${round}차_평가기록`;
}

