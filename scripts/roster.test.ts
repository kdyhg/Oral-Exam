import { describe, expect, it } from "vitest";

import { classNames, parseRosterGrid } from "./roster";

describe("parseRosterGrid", () => {
  const grid = [
    ["2-1", "", "", "2-2", "", ""],
    ["번호", "이름", "비고", "번호", "이름", "비고"],
    ["20101", "가", "남", "20201", "다", "여(자퇴)"],
    ["20102", "나", "여(전입)", "", "", ""],
    ["20103", "", "", "20203", "라", "남(휴학)"],
    ["연번", "담임", "", "20204", "마", "여(전출)"],
  ];

  it("반별 3열 구조를 읽고 이름 없는 학번과 표 아래 메모는 건너뛴다", () => {
    const students = parseRosterGrid(grid);
    expect(students.map((student) => student.studentId)).toEqual([
      "20101",
      "20102",
      "20201",
      "20203",
      "20204",
    ]);
    expect(students[0]).toEqual({ studentId: "20101", className: "2-1", number: 1, name: "가", active: true });
    expect(classNames(students)).toEqual(["2-1", "2-2"]);
  });

  it("자퇴·휴학·전출 학생은 비활성으로, 전입 학생은 활성으로 둔다", () => {
    const active = new Map(parseRosterGrid(grid).map((student) => [student.studentId, student.active]));
    expect(active.get("20102")).toBe(true);
    expect(active.get("20201")).toBe(false);
    expect(active.get("20203")).toBe(false);
    expect(active.get("20204")).toBe(false);
  });

  it("학번이 중복되면 중단한다", () => {
    expect(() =>
      parseRosterGrid([
        ["2-1", "", ""],
        ["번호", "이름", "비고"],
        ["20101", "가", ""],
        ["20101", "나", ""],
      ]),
    ).toThrow("중복");
  });
});

