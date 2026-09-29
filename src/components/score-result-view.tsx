"use client";

import { LEVEL_TITLES, OUTCOME_LABELS } from "@/lib/labels";
import { MAX_SCORE, REDRAW_PENALTY } from "@/lib/scoring";
import type { Exam } from "@/lib/types";

export function ScoreResultView({
  exam,
  onHome,
}: {
  exam: Exam;
  onHome: () => void;
}) {
  const redrawn = Boolean(exam.redrawQuestionId);

  return (
    <main className="shell result-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">f′(x)</div>
          <div>
            <h1>{exam.round}차 평가 결과</h1>
            <p>Google Sheet 저장이 완료되었습니다.</p>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={onHome}>
          홈으로
        </button>
      </header>

      <section className="card result-hero">
        <div>
          <p>{exam.className} · {exam.number}번</p>
          <h2>{exam.name}</h2>
          <span>수정시각 {formatDateTime(exam.updatedAt)}</span>
        </div>
        <div className="total-score" aria-label="점수">
          <strong>{exam.score ?? "-"}</strong>
          <span>/ {MAX_SCORE}점</span>
        </div>
      </section>

      <section className="score-breakdown" aria-label="점수 세부 항목">
        <ScorePart title="선택 난이도" value={LEVEL_TITLES[exam.level]} />
        <ScorePart
          title="다시 뽑기"
          value={exam.level === "OWN" ? "해당 없음" : redrawn ? `사용 (−${REDRAW_PENALTY}점)` : "사용 안 함"}
        />
        <ScorePart title="결과" value={exam.outcome ? OUTCOME_LABELS[exam.outcome] : "-"} />
      </section>

      <section className="card result-note">
        <strong>점수는 점수현황 Sheet에서도 확인할 수 있습니다.</strong>
        <span>차수별 평가 영역 만점은 50점, 기본점수는 30점입니다. 완료 기록을 수정하거나 초기화하면 Sheet 점수도 함께 바뀝니다.</span>
      </section>
    </main>
  );
}

function ScorePart({ title, value }: { title: string; value: string }) {
  return (
    <article className="card score-part">
      <p>{title}</p>
      <em>{value}</em>
    </article>
  );
}

function formatDateTime(value: string): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("ko-KR", {
    dateStyle: "short",
    timeStyle: "short",
  });
}

