"use client";

import { useEffect, useMemo, useRef, useState } from "react";

import { QuestionCard } from "@/components/question-card";
import { areScoresComplete } from "@/lib/exam-rules";
import type { AppSettings, Exam, Mark, Question, Score } from "@/lib/types";

export function ExamView({
  exam,
  questions,
  settings,
  busy,
  error,
  onBack,
  onPatch,
}: {
  exam: Exam;
  questions: Question[];
  settings: AppSettings;
  busy: boolean;
  error: string;
  onBack: () => void;
  onPatch: (patch: {
    scores?: Score[];
    memo?: string;
    hintQuestionId?: string;
    status?: "COMPLETED";
  }) => Promise<void>;
}) {
  const [memo, setMemo] = useState(exam.memo);
  const [remaining, setRemaining] = useState(() => getRemaining(exam.startedAt, settings.durationSeconds));
  const warned = useRef(false);
  const ended = useRef(false);
  const questionById = useMemo(
    () => new Map(questions.map((question) => [question.id, question])),
    [questions],
  );

  useEffect(() => {
    const update = () => setRemaining(getRemaining(exam.startedAt, settings.durationSeconds));
    update();
    const timer = window.setInterval(update, 1000);
    return () => window.clearInterval(timer);
  }, [exam.startedAt, settings.durationSeconds]);

  useEffect(() => {
    if (remaining <= settings.warningSeconds && remaining > 0 && !warned.current) {
      warned.current = true;
      beep(540);
    }
    if (remaining === 0 && !ended.current) {
      ended.current = true;
      beep(320);
    }
  }, [remaining, settings.warningSeconds]);

  const assignedQuestions = exam.scores
    .map((score) => questionById.get(score.questionId))
    .filter((question): question is Question => Boolean(question));

  function mark(index: number, field: "correct" | "fluency", value: Exclude<Mark, null>) {
    const scores = exam.scores.map((score, scoreIndex) =>
      scoreIndex === index ? { ...score, [field]: value } : score,
    );
    void onPatch({ scores });
  }

  function useHint(questionId: string) {
    if (window.confirm("이 문항에 Hint를 사용하시겠습니까? 전체 평가에서 한 번만 사용할 수 있습니다.")) {
      void onPatch({ hintQuestionId: questionId });
    }
  }

  async function complete() {
    if (!areScoresComplete(exam.scores)) return;
    if (memo !== exam.memo) await onPatch({ memo });
    await onPatch({ status: "COMPLETED" });
  }

  const timerState = remaining === 0 ? "ended" : remaining <= settings.warningSeconds ? "warning" : "";

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">f(x)</div>
          <div>
            <h1>대수 수학개념 도슨트</h1>
            <p>평가 항목은 변경 즉시 Google Sheet에 저장됩니다.</p>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={onBack}>학생 목록</button>
      </header>

      <section className="card exam-header">
        <div>
          <p>{exam.className} · {exam.number}번</p>
          <h2>{exam.name}</h2>
          <p>{exam.status === "COMPLETED" ? "평가 완료 · 결과 수정 가능" : "평가 진행 중"}</p>
        </div>
        <div className={`timer ${timerState}`} role="timer" aria-label="남은 평가 시간">
          <strong>{formatTime(remaining)}</strong>
          <span>{remaining === 0 ? "평가 시간 종료" : "남은 시간"}</span>
        </div>
      </section>

      {error ? <div className="notice error">{error}</div> : null}
      {busy ? <div className="notice info">Google Sheet에 저장 중...</div> : null}

      <section className="question-list">
        {assignedQuestions.map((question, index) => (
          <QuestionCard
            key={question.id}
            index={index}
            question={question}
            score={exam.scores[index]}
            hintQuestionId={exam.hintQuestionId}
            busy={busy}
            onMark={mark}
            onHint={useHint}
          />
        ))}
      </section>

      <section className="card exam-footer">
        <div className="field">
          <label htmlFor="memo">교사 메모</label>
          <textarea
            id="memo"
            className="textarea"
            maxLength={1000}
            placeholder="관찰 내용이나 후속 확인 사항을 기록하세요."
            value={memo}
            onChange={(event) => setMemo(event.target.value)}
          />
        </div>
        <div className="footer-actions">
          <button className="button secondary" type="button" disabled={busy || memo === exam.memo} onClick={() => onPatch({ memo })}>
            메모 저장
          </button>
          <button
            className="button"
            type="button"
            disabled={busy || !areScoresComplete(exam.scores)}
            onClick={complete}
          >
            {exam.status === "COMPLETED" ? "평가 결과 저장" : "평가 완료"}
          </button>
        </div>
      </section>
    </main>
  );
}

function getRemaining(startedAt: string, durationSeconds: number): number {
  const elapsed = Math.floor((Date.now() - new Date(startedAt).getTime()) / 1000);
  return Math.max(0, durationSeconds - elapsed);
}

function formatTime(seconds: number): string {
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}

function beep(frequency: number) {
  try {
    const AudioContextClass = window.AudioContext;
    const context = new AudioContextClass();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.08;
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.35);
  } catch {
    // Visual timer state remains available when audio is blocked by the browser.
  }
}
