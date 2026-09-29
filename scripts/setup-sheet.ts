import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import ExcelJS from "exceljs";
import { google, type sheets_v4 } from "googleapis";

import { LEVEL_LABELS } from "../src/lib/labels";
import { QUESTION_BANK } from "../src/lib/question-bank";
import { ROUNDS, recordSheetName, roundLabel, type Round } from "../src/lib/rounds";
import {
  HISTORY_HEADERS,
  HISTORY_SHEET,
  QUESTIONS_SHEET,
  RECORD_COLUMN_COUNT,
  RECORD_HEADERS,
  ROSTER_SHEET,
  SCORE_SHEET,
  SETTINGS_SHEET,
  STATISTICS_SHEET,
  a1,
  blankRecordRow,
  cellText,
  hasRecordHeader,
  type SheetCell,
} from "../src/lib/sheet-schema";
import { classNames, parseRosterGrid, type RosterStudent } from "./roster";

// 이번 설정에서 준비할 차수입니다. 2차를 열 때 ROUNDS의 open 값만 바꾸면 기록 탭이 추가됩니다.
const OPEN_ROUNDS: Round[] = ROUNDS.filter((round) => round.open).map((round) => round.id);
const FIRST_ROUND: Round = 1;
const DURATION_SECONDS = 240;
const WARNING_SECONDS = 60;

const SCORE_HEADERS = [
  "studentId",
  "반",
  "번호",
  "이름",
  "1차 상태",
  "1차 난이도",
  "1차 다시뽑기",
  "1차 결과",
  "1차 점수",
  "1차 종료시각",
];
const STATISTICS_HEADERS = [
  "반",
  "전체",
  "완료",
  "미평가",
  "완료율",
  "평균",
  "최고점",
  "최저점",
  "50점",
  "47점",
  "44점",
  "41점",
  "38점",
  "30점",
  "상 선택",
  "중 선택",
  "하 선택",
  "준비문제",
  "다시뽑기",
];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function rosterPath(): string {
  const index = process.argv.indexOf("--roster");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) throw new Error("--roster 뒤에 명렬 xlsx 경로를 지정해 주세요.");
  return value;
}

async function readRoster(path: string): Promise<RosterStudent[]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet("전체 명렬");
  if (!sheet) throw new Error("'전체 명렬' 시트를 찾을 수 없습니다.");
  const grid: string[][] = [];
  for (let row = 1; row <= sheet.rowCount; row += 1) {
    const values: string[] = [];
    for (let column = 1; column <= sheet.columnCount; column += 1) {
      values.push(sheet.getCell(row, column).text);
    }
    grid.push(values);
  }
  return parseRosterGrid(grid);
}

// USER_ENTERED 입력에서 "2-1" 같은 반 이름이 날짜로 바뀌지 않게 합니다.
function literalText(value: unknown): string {
  return `'${String(value ?? "")}`;
}

async function ensureSheets(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  titles: string[],
): Promise<Map<string, number>> {
  const read = async () => {
    const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
    return new Map(
      metadata.data.sheets?.map((sheet) => [
        sheet.properties?.title ?? "",
        sheet.properties?.sheetId ?? -1,
      ]),
    );
  };
  const existing = await read();
  const missing = titles.filter((title) => !existing.has(title));
  if (!missing.length) return existing;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: missing.map((title) => ({ addSheet: { properties: { title } } })) },
  });
  return read();
}

async function readValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  range: string,
): Promise<unknown[][]> {
  const response = await sheets.spreadsheets.values.get({ spreadsheetId, range });
  return response.data.values ?? [];
}

async function replaceValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  values: SheetCell[][],
  valueInputOption: "RAW" | "USER_ENTERED" = "RAW",
): Promise<void> {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: a1(sheetName, "A:Z") });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: a1(sheetName, "A1"),
    valueInputOption,
    requestBody: { values },
  });
}

/**
 * 기존 평가 기록은 학번 기준으로 그대로 보존하고, 새 명렬의 활성 학생마다 고정 행을 만듭니다.
 * 명렬에서 빠진 학생의 완료 기록이 있으면 데이터 손실을 막기 위해 중단합니다.
 */
function buildRecordRows(existingValues: unknown[][], students: RosterStudent[]): SheetCell[][] {
  const header = existingValues[0] ?? [];
  if (existingValues.length > 1 && !hasRecordHeader(header)) {
    throw new Error("기존 평가기록 탭의 형식이 달라 덮어쓸 수 없습니다. 탭 이름을 바꾼 뒤 다시 실행해 주세요.");
  }
  const existing = new Map(
    existingValues
      .slice(1)
      .filter((row) => cellText(row, 1))
      .map((row) => [cellText(row, 1), row]),
  );
  const activeIds = new Set(students.map((student) => student.studentId));
  const orphaned = [...existing.entries()].filter(
    ([studentId, row]) => !activeIds.has(studentId) && cellText(row, 0),
  );
  if (orphaned.length) {
    throw new Error(
      `평가 기록이 있는 학생이 새 명렬의 평가 대상에서 빠졌습니다: ${orphaned.map(([id]) => id).join(", ")}`,
    );
  }
  return [
    RECORD_HEADERS,
    ...students.map((student) => {
      const row = existing.get(student.studentId);
      if (!row) return blankRecordRow(student, 0);
      return Array.from({ length: RECORD_COLUMN_COUNT }, (_, index) => {
        const value = row[index];
        return typeof value === "number" || typeof value === "boolean" ? value : String(value ?? "");
      });
    }),
  ];
}

function scoreRows(students: RosterStudent[]): SheetCell[][] {
  const record = (column: string, row: number) => `'${recordSheetName(FIRST_ROUND)}'!${column}${row}`;
  return [
    SCORE_HEADERS,
    ...students.map((student, index) => {
      const row = index + 2;
      const done = `${record("O", row)}="COMPLETED"`;
      return [
        literalText(student.studentId),
        literalText(student.className),
        student.number,
        literalText(student.name),
        `=IF(${done},"완료","미평가")`,
        `=IF(${done},${record("F", row)},"")`,
        `=IF(${done},IF(${record("H", row)}<>"","사용",""),"")`,
        `=IF(${done},${record("L", row)},"")`,
        `=IF(${done},${record("M", row)},"")`,
        `=IF(${done},${record("K", row)},"")`,
      ];
    }),
  ];
}

function statisticsRows(students: RosterStudent[]): SheetCell[][] {
  const last = students.length + 1;
  const col = (letter: string) => `'${SCORE_SHEET}'!$${letter}$2:$${letter}$${last}`;
  const redraws = `'${recordSheetName(FIRST_ROUND)}'!$H$2:$H$${last}`;
  const recordClass = `'${recordSheetName(FIRST_ROUND)}'!$C$2:$C$${last}`;
  const recordStatus = `'${recordSheetName(FIRST_ROUND)}'!$O$2:$O$${last}`;

  const row = (label: string, rowNumber: number, classFilter: string | null): SheetCell[] => {
    const scoped = (criteria: string) =>
      classFilter
        ? `COUNTIFS(${col("B")},$A${rowNumber},${col("E")},"완료",${criteria})`
        : `COUNTIFS(${col("E")},"완료",${criteria})`;
    const scoreCount = (score: number) => `=${scoped(`${col("I")},${score}`)}`;
    const levelCount = (level: string) => `=${scoped(`${col("F")},"${level}"`)}`;
    const classArgs = classFilter ? `,${col("B")},$A${rowNumber}` : "";
    return [
      literalText(label),
      classFilter ? `=COUNTIF(${col("B")},$A${rowNumber})` : `=COUNTA(${col("A")})`,
      classFilter ? `=COUNTIFS(${col("B")},$A${rowNumber},${col("E")},"완료")` : `=COUNTIF(${col("E")},"완료")`,
      `=B${rowNumber}-C${rowNumber}`,
      `=IF(B${rowNumber}=0,"",C${rowNumber}/B${rowNumber})`,
      `=IF(C${rowNumber}=0,"",ROUND(AVERAGEIFS(${col("I")},${col("E")},"완료"${classArgs}),1))`,
      `=IF(C${rowNumber}=0,"",MAXIFS(${col("I")},${col("E")},"완료"${classArgs}))`,
      `=IF(C${rowNumber}=0,"",MINIFS(${col("I")},${col("E")},"완료"${classArgs}))`,
      ...[50, 47, 44, 41, 38, 30].map(scoreCount),
      ...(["HIGH", "MID", "LOW", "OWN"] as const).map((level) => levelCount(LEVEL_LABELS[level])),
      classFilter
        ? `=COUNTIFS(${recordClass},$A${rowNumber},${recordStatus},"COMPLETED",${redraws},"?*")`
        : `=COUNTIFS(${recordStatus},"COMPLETED",${redraws},"?*")`,
    ];
  };

  const classes = classNames(students);
  return [
    STATISTICS_HEADERS,
    ...classes.map((className, index) => row(className, index + 2, className)),
    row("전체", classes.length + 2, null),
  ];
}

async function formatSheets(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  ids: Map<string, number>,
  titles: string[],
  statisticsRowCount: number,
): Promise<void> {
  const requests: sheets_v4.Schema$Request[] = [];
  for (const title of titles) {
    const sheetId = ids.get(title);
    if (sheetId === undefined) continue;
    requests.push(
      {
        updateSheetProperties: {
          properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
          fields: "gridProperties.frozenRowCount",
        },
      },
      {
        repeatCell: {
          range: { sheetId, startRowIndex: 0, endRowIndex: 1 },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.09, green: 0.2, blue: 0.36 },
              textFormat: { foregroundColor: { red: 1, green: 1, blue: 1 }, bold: true },
              horizontalAlignment: "CENTER",
            },
          },
          fields: "userEnteredFormat",
        },
      },
    );
  }
  const questionSheetId = ids.get(QUESTIONS_SHEET);
  if (questionSheetId !== undefined) {
    requests.push(
      {
        updateDimensionProperties: {
          range: { sheetId: questionSheetId, dimension: "COLUMNS", startIndex: 4, endIndex: 5 },
          properties: { pixelSize: 640 },
          fields: "pixelSize",
        },
      },
      {
        repeatCell: {
          range: { sheetId: questionSheetId, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
          cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
        },
      },
    );
  }
  const statisticsSheetId = ids.get(STATISTICS_SHEET);
  if (statisticsSheetId !== undefined) {
    requests.push(
      {
        repeatCell: {
          range: { sheetId: statisticsSheetId, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
          cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0.0%" } } },
          fields: "userEnteredFormat.numberFormat",
        },
      },
      {
        repeatCell: {
          range: {
            sheetId: statisticsSheetId,
            startRowIndex: statisticsRowCount - 1,
            endRowIndex: statisticsRowCount,
          },
          cell: {
            userEnteredFormat: {
              backgroundColor: { red: 0.91, green: 0.96, blue: 1 },
              textFormat: { bold: true },
            },
          },
          fields: "userEnteredFormat(backgroundColor,textFormat)",
        },
      },
    );
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) loadEnvFile(".env.local");
  const roster = await readRoster(rosterPath());
  const active = roster.filter((student) => student.active);
  const questions = QUESTION_BANK.filter((question) => OPEN_ROUNDS.includes(question.round));
  const summary = classNames(active)
    .map((className) => `${className} ${active.filter((student) => student.className === className).length}명`)
    .join(", ");
  console.log(`명렬: 전체 ${roster.length}명, 평가 대상 ${active.length}명, 제외(자퇴·전출·휴학) ${roster.length - active.length}명`);
  console.log(`반별 평가 대상: ${summary}`);
  console.log(`문항: ${questions.length}개 (${OPEN_ROUNDS.map((round) => roundLabel(round)).join(", ")})`);
  if (!active.length) throw new Error("평가 대상 학생이 없습니다.");
  if (process.argv.includes("--check")) return;

  const spreadsheetId = requiredEnv("GOOGLE_SHEET_ID");
  const auth = new google.auth.JWT({
    email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const recordSheets = OPEN_ROUNDS.map(recordSheetName);
  const titles = [
    ROSTER_SHEET,
    QUESTIONS_SHEET,
    ...recordSheets,
    HISTORY_SHEET,
    SCORE_SHEET,
    STATISTICS_SHEET,
    SETTINGS_SHEET,
  ];
  const ids = await ensureSheets(sheets, spreadsheetId, titles);

  // 기록 탭은 명렬 검증을 통과한 뒤에만 다시 씁니다.
  const recordRowsBySheet = new Map<string, SheetCell[][]>();
  for (const title of recordSheets) {
    const existing = await readValues(sheets, spreadsheetId, a1(title, "A1:Q"));
    recordRowsBySheet.set(title, buildRecordRows(existing, active));
  }

  await replaceValues(sheets, spreadsheetId, ROSTER_SHEET, [
    ["studentId", "반", "번호", "이름", "활성"],
    ...roster.map((student) => [
      student.studentId,
      student.className,
      student.number,
      student.name,
      student.active,
    ]),
  ]);
  await replaceValues(sheets, spreadsheetId, QUESTIONS_SHEET, [
    ["문항ID", "차수", "난이도", "제목", "문항"],
    ...questions.map((question) => [
      question.id,
      roundLabel(question.round),
      LEVEL_LABELS[question.difficulty],
      question.title,
      question.prompt,
    ]),
  ]);
  await replaceValues(sheets, spreadsheetId, SETTINGS_SHEET, [
    ["설정", "값", "설명"],
    ["durationSeconds", DURATION_SECONDS, "평가 제한 시간(초) · 다시 뽑으면 새로 시작"],
    ["warningSeconds", WARNING_SECONDS, "종료 전 경고 시간(초)"],
  ]);
  for (const [title, rows] of recordRowsBySheet) {
    await replaceValues(sheets, spreadsheetId, title, rows);
  }

  const history = await readValues(sheets, spreadsheetId, a1(HISTORY_SHEET, "A1:A2"));
  if (!history.length) {
    await replaceValues(sheets, spreadsheetId, HISTORY_SHEET, [HISTORY_HEADERS]);
  }

  await replaceValues(sheets, spreadsheetId, SCORE_SHEET, scoreRows(active), "USER_ENTERED");
  const statistics = statisticsRows(active);
  await replaceValues(sheets, spreadsheetId, STATISTICS_SHEET, statistics, "USER_ENTERED");
  await formatSheets(sheets, spreadsheetId, ids, titles, statistics.length);

  console.log(`설정 완료: https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});

