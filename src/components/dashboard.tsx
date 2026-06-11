"use client";

import { useMemo, useState } from "react";

import type { BootstrapData, Student } from "@/lib/types";

export function Dashboard({
  data,
  onSelectStudent,
  onLogout,
}: {
  data: BootstrapData;
  onSelectStudent: (student: Student) => void;
  onLogout: () => void;
}) {
  const [selectedClass, setSelectedClass] = useState(data.progress[0]?.className ?? "2-1");
  const [query, setQuery] = useState("");
  const examByStudent = useMemo(
    () => new Map(data.exams.map((exam) => [exam.studentId, exam])),
    [data.exams],
  );
  const students = data.students.filter(
    (student) =>
      student.active &&
      student.className === selectedClass &&
      (!query || student.name.includes(query) || student.studentId.includes(query)),
  );
  const classProgress = data.progress.find((item) => item.className === selectedClass);

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand">
          <div className="brand-mark">f(x)</div>
          <div>
            <h1>대수 수학개념 도슨트</h1>
            <p>2026학년도 2학년 1학기 · 구술 수행평가</p>
          </div>
        </div>
        <button className="button secondary" type="button" onClick={onLogout}>로그아웃</button>
      </header>

      <section className="progress-grid" aria-label="반별 평가 진행률">
        {data.progress.map((progress) => (
          <button
            className={`card progress-card ${selectedClass === progress.className ? "active" : ""}`}
            key={progress.className}
            type="button"
            onClick={() => setSelectedClass(progress.className)}
          >
            <strong>{progress.className}</strong>
            <span>{progress.completed}/{progress.total}</span>
            <small>완료 · 진행 중 {progress.inProgress}명</small>
          </button>
        ))}
      </section>

      <section className="card roster-card">
        <div className="roster-toolbar">
          <div>
            <h2>{selectedClass} 학생 선택</h2>
            <p>미평가 {Math.max(0, (classProgress?.total ?? 0) - (classProgress?.completed ?? 0) - (classProgress?.inProgress ?? 0))}명</p>
          </div>
          <input
            className="input"
            type="search"
            placeholder="이름 또는 학번 검색"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
        </div>
        {students.length ? (
          <div className="student-grid">
            {students.map((student) => {
              const exam = examByStudent.get(student.studentId);
              return (
                <button className="student" key={student.studentId} type="button" onClick={() => onSelectStudent(student)}>
                  <span className="student-number">{student.number}</span>
                  <span className="student-name">{student.name}</span>
                  <span className={`status-dot ${exam?.status === "COMPLETED" ? "completed" : exam ? "in-progress" : ""}`} />
                </button>
              );
            })}
          </div>
        ) : (
          <div className="empty">검색 조건에 맞는 학생이 없습니다.</div>
        )}
      </section>
    </main>
  );
}
