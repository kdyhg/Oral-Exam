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
  onMark: (index: number, field: "correct" | "fluency", value: Exclude<Mark, null>) => void;
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
      <div className="score-grid">
        <ScoreButtons
          label="정답 여부"
          value={score.correct}
          disabled={busy}
          onChange={(value) => onMark(index, "correct", value)}
        />
        <ScoreButtons
          label="유창성"
          value={score.fluency}
          disabled={busy}
          onChange={(value) => onMark(index, "fluency", value)}
        />
      </div>
    </article>
  );
}

function ScoreButtons({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: Mark;
  disabled: boolean;
  onChange: (value: Exclude<Mark, null>) => void;
}) {
  return (
    <div className="score-group">
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
