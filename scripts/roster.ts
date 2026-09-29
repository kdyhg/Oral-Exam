export interface RosterStudent {
  studentId: string;
  className: string;
  number: number;
  name: string;
  active: boolean;
}

// 비고에 자퇴·전출·휴학이 있는 학생은 명렬에는 남기되 평가 대상에서 제외합니다.
const INACTIVE_NOTE = /자퇴|전출|휴학/;

/**
 * '전체 명렬' 시트를 2차원 텍스트 배열로 받아 학생 목록을 만듭니다.
 * 1행은 반 이름, 2행은 번호·이름·비고 헤더이며 반마다 3열을 차지합니다.
 */
export function parseRosterGrid(grid: string[][]): RosterStudent[] {
  const cell = (row: number, column: number) => String(grid[row]?.[column] ?? "").trim();
  const width = Math.max(0, ...grid.map((row) => row.length));
  const students: RosterStudent[] = [];

  for (let column = 0; column < width; column += 3) {
    const className = cell(0, column);
    if (!/^2-\d+$/.test(className) || cell(1, column) !== "번호" || cell(1, column + 1) !== "이름") {
      continue;
    }
    for (let row = 2; row < grid.length; row += 1) {
      const studentId = cell(row, column);
      const name = cell(row, column + 1);
      if (!/^\d{5}$/.test(studentId) || !name) continue;
      students.push({
        studentId,
        className,
        number: Number(studentId.slice(-2)),
        name,
        active: !INACTIVE_NOTE.test(cell(row, column + 2)),
      });
    }
  }

  const seen = new Set<string>();
  for (const student of students) {
    if (seen.has(student.studentId)) throw new Error(`학번이 중복되었습니다: ${student.studentId}`);
    seen.add(student.studentId);
  }
  return students.sort((a, b) => a.studentId.localeCompare(b.studentId));
}

export function classNames(students: RosterStudent[]): string[] {
  return [...new Set(students.map((student) => student.className))].sort((a, b) =>
    a.localeCompare(b, "ko", { numeric: true }),
  );
}

