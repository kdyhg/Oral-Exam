import { DIFFICULTIES, EXAM_LEVELS, OUTCOMES } from "./labels";
import type {
  ClassProgress,
  Difficulty,
  Exam,
  ExamLevel,
  Outcome,
  Question,
  Student,
} from "./types";

export function isExamLevel(value: unknown): value is ExamLevel {
  return EXAM_LEVELS.includes(value as ExamLevel);
}

export function isDifficulty(value: unknown): value is Difficulty {
  return DIFFICULTIES.includes(value as Difficulty);
}

export function isOutcome(value: unknown): value is Outcome {
  return OUTCOMES.includes(value as Outcome);
}

export function questionIdsFor(questions: Question[], level: ExamLevel): string[] {
  if (level === "OWN") return [];
  return questions.filter((question) => question.difficulty === level).map((question) => question.id);
}

export function pickQuestionId(
  ids: string[],
  excluded: (string | null)[] = [],
  random: () => number = Math.random,
): string {
  const pool = [...new Set(ids)].filter((id) => !excluded.includes(id));
  if (!pool.length) throw new Error("뽑을 수 있는 문항이 없습니다.");
  return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

export function currentQuestionId(
  exam: Pick<Exam, "firstQuestionId" | "redrawQuestionId">,
): string | null {
  return exam.redrawQuestionId ?? exam.firstQuestionId;
}

// 다시 뽑으면 새 문제 기준으로 제한 시간이 다시 시작됩니다.
export function timerStartedAt(exam: Pick<Exam, "startedAt" | "redrawAt">): string {
  return exam.redrawAt ?? exam.startedAt;
}

export function canRedraw(exam: Exam, questions: Question[]): boolean {
  return (
    exam.level !== "OWN" &&
    exam.status !== "COMPLETED" &&
    Boolean(exam.firstQuestionId) &&
    !exam.redrawQuestionId &&
    questionIdsFor(questions, exam.level).some((id) => id !== exam.firstQuestionId)
  );
}

export function applyRedraw(
  exam: Exam,
  questions: Question[],
  usedAt: string,
  random: () => number = Math.random,
): Exam {
  if (!canRedraw(exam, questions)) {
    throw new Error("다시 뽑기는 같은 난이도에서 한 번만 사용할 수 있습니다.");
  }
  const redrawQuestionId = pickQuestionId(
    questionIdsFor(questions, exam.level),
    [exam.firstQuestionId],
    random,
  );
  return { ...exam, redrawQuestionId, redrawAt: usedAt, outcome: null, score: null };
}

export function examStructureError(
  exam: Pick<Exam, "level" | "firstQuestionId" | "redrawQuestionId" | "redrawAt" | "outcome">,
  questions: Question[],
): string | null {
  if (!isExamLevel(exam.level)) return "난이도를 선택해 주세요.";
  if (!isOutcome(exam.outcome)) return "평가 결과를 선택해 주세요.";
  if (exam.level === "OWN") {
    return exam.firstQuestionId || exam.redrawQuestionId || exam.redrawAt
      ? "자신이 준비한 문제는 추첨 문항을 가질 수 없습니다."
      : null;
  }

  const pool = questionIdsFor(questions, exam.level);
  if (!exam.firstQuestionId || !pool.includes(exam.firstQuestionId)) {
    return "선택한 난이도의 문항 배정을 확인해 주세요.";
  }
  if (exam.redrawQuestionId === null) {
    return exam.redrawAt ? "다시 뽑기 기록을 확인해 주세요." : null;
  }
  if (
    exam.redrawQuestionId === exam.firstQuestionId ||
    !pool.includes(exam.redrawQuestionId) ||
    !exam.redrawAt ||
    Number.isNaN(Date.parse(exam.redrawAt))
  ) {
    return "다시 뽑은 문항 기록을 확인해 주세요.";
  }
  return null;
}

export function buildClassProgress(students: Student[], exams: Exam[]): ClassProgress[] {
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

