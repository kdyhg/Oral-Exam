"use client";

import { calculateExamScore } from "@/lib/scoring";
import type { Exam } from "@/lib/types";

export function ScoreResultView({
  exam,
  onHome,
}: {
  exam: Exam;
  onHome: () => void;
}) {
  const score = calculateExamScore(exam);

  return (
    <main className="shell result-shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">f(x)</div>
          <div>
            <h1>평가 결과</h1>
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
        <div className="total-score" aria-label="총점">
          <strong>{score ? score.total : "-"}</strong>
          <span>/ 100점</span>
        </div>
      </section>

      {score ? (
        <section className="score-breakdown" aria-label="점수 세부 항목">
          <ScorePart
            title="유창성"
            mark={score.fluency}
            points={score.fluencyScore}
            description="O 30점 · X 20점"
          />
          <ScorePart
            title="선택형 문제"
            mark={score.selfCorrect}
            points={score.selfScore}
            description="O 30점 · X 20점"
          />
          <ScorePart
            title="무작위 문제"
            mark={`${score.randomCorrect[0]} / ${score.randomCorrect[1]}`}
            points={score.randomScore}
            description={`정답 ${score.randomCorrectCount}개 · 2개 40점, 1개 30점, 0개 20점`}
          />
        </section>
      ) : (
        <div className="notice error">점수 계산에 필요한 완료 기록을 확인하지 못했습니다.</div>
      )}

      <section className="card result-note">
        <strong>점수는 점수현황 Sheet에서도 확인할 수 있습니다.</strong>
        <span>완료 기록을 수정하거나 초기화하면 Sheet 점수도 공식 기록 기준으로 함께 바뀝니다.</span>
      </section>
    </main>
  );
}

function ScorePart({
  title,
  mark,
  points,
  description,
}: {
  title: string;
  mark: string;
  points: number;
  description: string;
}) {
  return (
    <article className="card score-part">
      <p>{title}</p>
      <div>
        <strong>{points}</strong>
        <span>점</span>
      </div>
      <em>{mark}</em>
      <small>{description}</small>
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
