"use client";

import { MathText } from "@/components/math-text";
import type { Question, Student } from "@/lib/types";

export function QuestionChooser({
  student,
  questions,
  busy,
  onBack,
  onChoose,
}: {
  student: Student;
  questions: Question[];
  busy: boolean;
  onBack: () => void;
  onChoose: (questionId: string) => void;
}) {
  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">f(x)</div>
          <div>
            <h1>{student.className} {student.number}번 {student.name}</h1>
            <p>문항을 선택하면 즉시 6분 평가가 시작됩니다.</p>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={onBack}>학생 목록</button>
      </header>
      <section className="card chooser">
        <p className="eyebrow">Student Choice</p>
        <h2>자기선택형 문항을 고르세요.</h2>
        <p>선택과 동시에 무작위형 2문항이 배정되고 타이머가 시작됩니다.</p>
        <div className="choice-list">
          {questions.map((question) => (
            <button
              className="choice"
              key={question.id}
              type="button"
              disabled={busy}
              onClick={() => onChoose(question.id)}
            >
              <strong>{question.title}</strong>
              <span className="question-text"><MathText>{question.prompt}</MathText></span>
            </button>
          ))}
        </div>
      </section>
    </main>
  );
}
