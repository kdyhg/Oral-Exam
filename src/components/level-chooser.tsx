"use client";

import { EXAM_LEVELS, LEVEL_TITLES } from "@/lib/labels";
import { questionIdsFor } from "@/lib/exam-rules";
import { calculateScore } from "@/lib/scoring";
import type { ExamLevel, Question, Student } from "@/lib/types";

export function LevelChooser({
  student,
  questions,
  durationSeconds,
  onBack,
  onChoose,
}: {
  student: Student;
  questions: Question[];
  durationSeconds: number;
  onBack: () => void;
  onChoose: (level: ExamLevel) => void;
}) {
  const minutes = Math.round(durationSeconds / 60);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">f′(x)</div>
          <div>
            <h1>{student.className} {student.number}번 {student.name}</h1>
            <p>난이도를 선택하면 즉시 {minutes}분 평가가 시작됩니다.</p>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={onBack}>학생 목록</button>
      </header>
      <section className="card chooser">
        <p className="eyebrow">Student Choice</p>
        <h2>학생이 도전할 난이도를 고르세요.</h2>
        <p>선택한 난이도에서 문제가 무작위로 1개 뽑히고 타이머가 시작됩니다. 설명하지 못하면 같은 난이도에서 한 번 다시 뽑을 수 있으며, 이때 3점이 차감됩니다.</p>
        <div className="level-grid">
          {EXAM_LEVELS.map((level) => {
            const count = questionIdsFor(questions, level).length;
            const own = level === "OWN";
            return (
              <button
                className={`level-choice level-${level.toLowerCase()}`}
                key={level}
                type="button"
                disabled={!own && count === 0}
                onClick={() => onChoose(level)}
              >
                <strong>{LEVEL_TITLES[level]}</strong>
                <span className="level-points">{calculateScore(level, false, "SOLVED")}점</span>
                <small>
                  {own
                    ? "학생이 준비해 온 문제 · 다시 뽑기 없음"
                    : `문항 ${count}개 중 무작위 · 다시 뽑으면 ${calculateScore(level, true, "SOLVED")}점`}
                </small>
              </button>
            );
          })}
        </div>
      </section>
    </main>
  );
}

