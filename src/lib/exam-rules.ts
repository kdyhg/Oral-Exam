import type { ClassProgress, Exam, Mark, Score, Student } from "@/lib/types";

export function pickRandomQuestionIds(
  ids: string[],
  random: () => number = Math.random,
): [string, string] {
  if (new Set(ids).size < 2) {
    throw new Error("무작위형 문항이 최소 2개 필요합니다.");
  }

  const pool = [...new Set(ids)];
  const firstIndex = Math.floor(random() * pool.length);
  const [first] = pool.splice(firstIndex, 1);
  const secondIndex = Math.floor(random() * pool.length);

  return [first, pool[secondIndex]];
}

export function areScoresComplete(scores: Score[]): boolean {
  return (
    scores.length === 3 &&
    scores.every(
      (score) =>
        isMark(score.correct) &&
        isMark(score.fluency) &&
        Boolean(score.questionId),
    )
  );
}

export function applyHint(exam: Exam, questionId: string, usedAt: string): Exam {
  if (!exam.scores.some((score) => score.questionId === questionId)) {
    throw new Error("배정된 문항에만 Hint를 사용할 수 있습니다.");
  }
  if (exam.hintQuestionId && exam.hintQuestionId !== questionId) {
    throw new Error("Hint는 전체 평가에서 한 번만 사용할 수 있습니다.");
  }
  if (exam.hintQuestionId) return exam;
  return { ...exam, hintQuestionId: questionId, hintAt: usedAt };
}

export function isMark(value: unknown): value is Exclude<Mark, null> {
  return value === "O" || value === "X";
}

export function buildClassProgress(
  students: Student[],
  exams: Exam[],
): ClassProgress[] {
  const examsByStudent = new Map(exams.map((exam) => [exam.studentId, exam]));
  const groups = new Map<string, ClassProgress>();

  for (const student of students.filter((item) => item.active)) {
    const current = groups.get(student.className) ?? {
      className: student.className,
      total: 0,
      completed: 0,
      inProgress: 0,
    };
    const exam = examsByStudent.get(student.studentId);
    current.total += 1;
    current.completed += exam?.status === "COMPLETED" ? 1 : 0;
    current.inProgress += exam?.status === "IN_PROGRESS" ? 1 : 0;
    groups.set(student.className, current);
  }

  return [...groups.values()].sort((a, b) =>
    a.className.localeCompare(b.className, "ko", { numeric: true }),
  );
}
