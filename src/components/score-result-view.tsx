"use client";

import { LEVEL_NAMES, OUTCOME_LABELS } from "@/lib/labels";
import { MAX_SCORE } from "@/lib/scoring";
import type { Exam } from "@/lib/types";

export function ScoreResultView({ exam, onHome }: { exam: Exam; onHome: () => void }) {
  const details = [
    LEVEL_NAMES[exam.level],
    exam.redrawQuestionId ? "다시 뽑음" : null,
    exam.outcome ? OUTCOME_LABELS[exam.outcome] : null,
  ].filter(Boolean);

  return (
    <main className="center">
      <section className="panel narrow result">
        <p className="meta">저장됨 · {exam.className} {exam.number}번</p>
        <h1 className="title">{exam.name}</h1>
        <p className="score" aria-label={`${exam.score ?? 0}점`}>
          <strong>{exam.score ?? "-"}</strong> / {MAX_SCORE}
        </p>
        <p className="meta">{details.join(" · ")}</p>
        <button className="button primary wide" type="button" onClick={onHome} autoFocus>
          학생 목록
        </button>
      </section>
    </main>
  );
}

