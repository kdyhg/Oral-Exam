import { describe, expect, it } from "vitest";

import { calculateScore, outcomeOptions } from "./scoring";

describe("calculateScore", () => {
  it("처음 뽑은 문제를 해결하면 난이도별 점수를 준다", () => {
    expect(calculateScore("HIGH", false, "SOLVED")).toBe(50);
    expect(calculateScore("MID", false, "SOLVED")).toBe(47);
    expect(calculateScore("LOW", false, "SOLVED")).toBe(44);
    expect(calculateScore("OWN", false, "SOLVED")).toBe(41);
  });

  it("다시 뽑아 해결하면 한 단계(3점) 낮은 점수를 준다", () => {
    expect(calculateScore("HIGH", true, "SOLVED")).toBe(47);
    expect(calculateScore("MID", true, "SOLVED")).toBe(44);
    expect(calculateScore("LOW", true, "SOLVED")).toBe(41);
  });

  it("해결하지 못하면 38점, 시도하지 않으면 기본점수 30점이다", () => {
    for (const level of ["HIGH", "MID", "LOW", "OWN"] as const) {
      for (const redrawn of [false, true]) {
        expect(calculateScore(level, redrawn, "FAILED")).toBe(38);
        expect(calculateScore(level, redrawn, "NO_ATTEMPT")).toBe(30);
      }
    }
  });

  it("결과 선택지에 현재 상황의 점수를 보여 준다", () => {
    expect(outcomeOptions("HIGH", true).map((option) => option.points)).toEqual([47, 38, 30]);
  });
});

