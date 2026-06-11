"use client";

import { MathText } from "@/components/math-text";
import type { Mark, Question, Score } from "@/lib/types";

export function QuestionCard({
  index,
  question,
  score,
  hintQuestionId,
  busy,
  onMark,
  onHint,
}: {
  index: number;
  question: Question;
  score: Score;
  hintQuestionId: string | null;
  busy: boolean;
  onMark: (index: number, value: Exclude<Mark, null>) => void;
  onHint: (questionId: string) => void;
}) {
  const usedHere = hintQuestionId === question.id;
  const hintUsedElsewhere = Boolean(hintQuestionId) && !usedHere;

  return (
    <article className="card question-card">
      <div className="question-top">
        <div>
          <p className="question-kicker">QUESTION {index + 1}</p>
          <h3>{question.title}</h3>
        </div>
        <button
          className={`hint-button ${usedHere ? "used" : ""}`}
          type="button"
          disabled={busy || hintUsedElsewhere || usedHere}
          onClick={() => onHint(question.id)}
        >
          {usedHere ? "Hint 사용 완료" : hintUsedElsewhere ? "Hint 사용됨" : "Hint 사용"}
        </button>
      </div>
      <p className="question-text"><MathText>{question.prompt}</MathText></p>
      <div className="question-score">
        <MarkButtons
          label="정답 여부"
          value={score.correct}
          disabled={busy}
          onChange={(value) => onMark(index, value)}
        />
      </div>
    </article>
  );
}

export function MarkButtons({
  label,
  value,
  disabled,
  onChange,
  large = false,
}: {
  label: string;
  value: Mark;
  disabled: boolean;
  onChange: (value: Exclude<Mark, null>) => void;
  large?: boolean;
}) {
  return (
    <div className={`score-group ${large ? "large" : ""}`}>
      <span>{label}</span>
      <button
        className={`mark o ${value === "O" ? "selected" : ""}`}
        type="button"
        disabled={disabled}
        aria-pressed={value === "O"}
        onClick={() => onChange("O")}
      >
        O
      </button>
      <button
        className={`mark x ${value === "X" ? "selected" : ""}`}
        type="button"
        disabled={disabled}
        aria-pressed={value === "X"}
        onClick={() => onChange("X")}
      >
        X
      </button>
    </div>
  );
}
