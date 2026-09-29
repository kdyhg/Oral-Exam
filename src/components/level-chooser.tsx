"use client";

import { questionIdsFor } from "@/lib/exam-rules";
import { EXAM_LEVELS, LEVEL_NAMES } from "@/lib/labels";
import { calculateScore } from "@/lib/scoring";
import type { ExamLevel, Question, Student } from "@/lib/types";

export function LevelChooser({
  student,
  questions,
  onBack,
  onChoose,
}: {
  student: Student;
  questions: Question[];
  onBack: () => void;
  onChoose: (level: ExamLevel) => void;
}) {
  return (
    <main className="page">
      <header className="bar">
        <h1 className="title">{student.className} {student.number}번 {student.name}</h1>
        <button className="button" type="button" onClick={onBack}>학생 목록</button>
      </header>
      <h2 className="section-title">난이도 선택</h2>
      <div className="level-grid">
        {EXAM_LEVELS.map((level) => (
          <button
            className="level"
            key={level}
            type="button"
            disabled={level !== "OWN" && questionIdsFor(questions, level).length === 0}
            onClick={() => onChoose(level)}
          >
            <span className="level-name">{LEVEL_NAMES[level]}</span>
            <span className="level-score">{calculateScore(level, false, "SOLVED")}점</span>
          </button>
        ))}
      </div>
    </main>
  );
}

