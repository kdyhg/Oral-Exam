import { isMark } from "./exam-rules";
import type { Exam, Mark } from "./types";

export interface ExamScore {
  fluency: Exclude<Mark, null>;
  fluencyScore: number;
  selfCorrect: Exclude<Mark, null>;
  selfScore: number;
  randomCorrect: [Exclude<Mark, null>, Exclude<Mark, null>];
  randomCorrectCount: number;
  randomScore: number;
  total: number;
}

export function calculateExamScore(exam: Exam): ExamScore | null {
  if (exam.status !== "COMPLETED") return null;
  const [self, randomOne, randomTwo] = exam.scores;
  if (
    !self ||
    !randomOne ||
    !randomTwo ||
    !isMark(self.correct) ||
    !isMark(randomOne.correct) ||
    !isMark(randomTwo.correct) ||
    !isMark(exam.fluency)
  ) {
    return null;
  }

  const fluencyScore = markScore(exam.fluency);
  const selfScore = markScore(self.correct);
  const randomCorrectCount = [randomOne.correct, randomTwo.correct].filter((mark) => mark === "O").length;
  const randomScore = randomCorrectCount === 2 ? 40 : randomCorrectCount === 1 ? 30 : 20;

  return {
    fluency: exam.fluency,
    fluencyScore,
    selfCorrect: self.correct,
    selfScore,
    randomCorrect: [randomOne.correct, randomTwo.correct],
    randomCorrectCount,
    randomScore,
    total: fluencyScore + selfScore + randomScore,
  };
}

function markScore(mark: Exclude<Mark, null>): number {
  return mark === "O" ? 30 : 20;
}
