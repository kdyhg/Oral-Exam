"use client";

import { useMemo, useState } from "react";

import type { BootstrapData, Student } from "@/lib/types";

export function Dashboard({
  data,
  draftCount,
  error,
  selectedClass,
  resettingStudentId,
  onClearDrafts,
  onSelectClass,
  onResetStudent,
  onSelectStudent,
  onLogout,
}: {
  data: BootstrapData;
  draftCount: number;
  error: string;
  selectedClass: string;
  resettingStudentId: string | null;
  onClearDrafts: () => void;
  onSelectClass: (className: string) => void;
  onResetStudent: (student: Student) => void;
  onSelectStudent: (student: Student) => void;
  onLogout: () => void;
}) {
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
        <div className="topbar-actions">
          <button className="button secondary" type="button" disabled={!draftCount} onClick={onClearDrafts}>
            모든 초안 삭제{draftCount ? ` (${draftCount})` : ""}
          </button>
          <button className="button secondary" type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <section className="progress-grid" aria-label="반별 평가 진행률">
        {data.progress.map((progress) => (
          <button
            className={`card progress-card ${selectedClass === progress.className ? "active" : ""}`}
            key={progress.className}
            type="button"
            onClick={() => onSelectClass(progress.className)}
          >
            <strong>{progress.className}</strong>
            <span>{progress.completed}/{progress.total}</span>
            <small>완료 · 진행 중 {progress.inProgress}명</small>
          </button>
        ))}
      </section>

      {error ? <div className="notice error">{error}</div> : null}

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
                <div className="student-card" key={student.studentId}>
                  <button
                    className="student"
                    type="button"
                    onClick={() => onSelectStudent(student)}
                  >
                    <span className="student-number">{student.number}</span>
                    <span className="student-name">{student.name}</span>
                    <span className={`status-dot ${exam?.status === "COMPLETED" ? "completed" : exam ? "in-progress" : ""}`} />
                  </button>
                  {exam?.status === "COMPLETED" ? (
                    <button
                      className="student-reset"
                      type="button"
                      disabled={Boolean(resettingStudentId)}
                      aria-label={`${student.className} ${student.number}번 ${student.name} 기록 초기화`}
                      onClick={() => onResetStudent(student)}
                    >
                      {resettingStudentId === student.studentId ? "초기화 중" : "기록 초기화"}
                    </button>
                  ) : null}
                </div>
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
