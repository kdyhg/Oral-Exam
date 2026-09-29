"use client";

import { useMemo, useState } from "react";

import type { BootstrapData, Student } from "@/lib/types";

export function Dashboard({
  data,
  roundLabel,
  draftCount,
  error,
  selectedClass,
  resettingStudentId,
  onClearDrafts,
  onSelectClass,
  onResetStudent,
  onSelectStudent,
  onChangeRound,
  onLogout,
}: {
  data: BootstrapData;
  roundLabel: string;
  draftCount: number;
  error: string;
  selectedClass: string;
  resettingStudentId: string | null;
  onClearDrafts: () => void;
  onSelectClass: (className: string) => void;
  onResetStudent: (student: Student) => void;
  onSelectStudent: (student: Student) => void;
  onChangeRound: () => void;
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

  return (
    <main className="page">
      <header className="bar">
        <h1 className="title">미적분 도슨트 {roundLabel}</h1>
        <div className="actions">
          {draftCount ? (
            <button className="button" type="button" onClick={onClearDrafts}>
              초안 삭제 {draftCount}
            </button>
          ) : null}
          <button className="button" type="button" onClick={onChangeRound}>차수 선택</button>
          <button className="button" type="button" onClick={onLogout}>로그아웃</button>
        </div>
      </header>

      <nav className="class-tabs" aria-label="반 선택">
        {data.progress.map((progress) => (
          <button
            className="class-tab"
            key={progress.className}
            type="button"
            aria-pressed={selectedClass === progress.className}
            onClick={() => onSelectClass(progress.className)}
          >
            <span>{progress.className}</span>
            <small>{progress.completed}/{progress.total}</small>
          </button>
        ))}
      </nav>

      {error ? <p className="notice" role="alert">{error}</p> : null}

      <input
        className="input search"
        type="search"
        placeholder="이름 또는 학번"
        aria-label="학생 검색"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
      />

      {students.length ? (
        <ul className="student-list">
          {students.map((student) => {
            const exam = examByStudent.get(student.studentId);
            const completed = exam?.status === "COMPLETED";
            return (
              <li className="student-row" key={student.studentId}>
                <button className="student" type="button" onClick={() => onSelectStudent(student)}>
                  <span className="num">{student.number}</span>
                  <span className="name">{student.name}</span>
                  <span className={`state ${completed ? "done" : exam ? "active" : ""}`}>
                    {completed ? `${exam.score ?? "-"}점` : exam ? "진행 중" : ""}
                  </span>
                </button>
                {completed ? (
                  <button
                    className="reset"
                    type="button"
                    disabled={Boolean(resettingStudentId)}
                    aria-label={`${student.number}번 ${student.name} 기록 초기화`}
                    onClick={() => onResetStudent(student)}
                  >
                    {resettingStudentId === student.studentId ? "초기화 중" : "초기화"}
                  </button>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="empty">검색 결과가 없습니다.</p>
      )}
    </main>
  );
}

