import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import ExcelJS from "exceljs";
import { google, type sheets_v4 } from "googleapis";

import { deriveStudentFluency } from "../src/lib/exam-rules";
import type { Mark } from "../src/lib/types";

const TARGET_SHEETS = ["학생명렬", "문항목록", "평가기록", "평가이력", "진행현황", "설정"] as const;

const QUESTIONS = [
  {
    id: "S1",
    type: "SELF",
    title: "자기선택형 1 · 로그함수",
    prompt:
      "함수 $y=\\log_2(x-1)+2$의 그래프는 $y=\\log_2x$의 그래프를 어떻게 이동한 것인지 말하고, 정의역, 치역, 점근선을 구하는 과정을 설명하시오.",
  },
  {
    id: "S2",
    type: "SELF",
    title: "자기선택형 2 · 삼각함수",
    prompt:
      "각 $\\theta$가 제2사분면의 각이고 $\\sin\\theta=\\frac{3}{5}$일 때, $\\cos\\theta$와 $\\tan\\theta$의 값을 부호 판단 과정과 함께 말로 설명하시오.",
  },
  {
    id: "S3",
    type: "SELF",
    title: "자기선택형 3 · 등차수열",
    prompt:
      "첫째항이 $3$이고 공차가 $2$인 등차수열의 일반항 $a_n$을 세우고, $a_{10}$을 구하는 과정을 등차수열의 뜻을 이용하여 설명하시오.",
  },
  {
    id: "R1",
    type: "RANDOM",
    title: "무작위형 1 · 로그부등식",
    prompt:
      "함수 $f(x)=\\log_2(x-1)+1$의 그래프와 직선 $y=3$의 위치 관계를 이용하여 $f(x)\\geq3$을 만족하는 $x$의 범위를 구하는 과정을 설명하시오. 이때 정의역을 먼저 확인해야 하는 이유도 함께 말하시오.",
  },
  {
    id: "R2",
    type: "RANDOM",
    title: "무작위형 2 · 지수방정식",
    prompt:
      "방정식 $4^x-5\\times2^x+4=0$을 풀 때, $2^x$를 하나의 문자로 치환하는 이유를 설명하고, 치환한 식의 해가 원래 방정식의 해로 어떻게 연결되는지 설명하시오.",
  },
  {
    id: "R3",
    type: "RANDOM",
    title: "무작위형 3 · 역함수",
    prompt:
      "함수 $f(x)=2(x-2)+3$의 역함수 식을 구하고, 원래 함수와 역함수의 정의역과 치역이 서로 어떻게 바뀌는지 설명하시오. 또한 $f^{-1}(x)=4$를 만족하는 $x$를 구하는 과정을 설명하시오.",
  },
  {
    id: "R4",
    type: "RANDOM",
    title: "무작위형 4 · 삼각방정식",
    prompt:
      "$0\\leq\\theta<2\\pi$에서 $2\\sin^2\\theta-\\sin\\theta-1=0$을 만족하는 $\\theta$를 모두 구하는 과정을 설명하시오. 이때 $\\sin\\theta$의 가능한 값을 먼저 구하고, 단위원에서 각을 찾는 순서로 말하시오.",
  },
  {
    id: "R5",
    type: "RANDOM",
    title: "무작위형 5 · 사인법칙",
    prompt:
      "삼각형 $ABC$에서 $A=30^\\circ$, $a=4$, $b=4\\sqrt{2}$일 때, 사인법칙을 이용하여 가능한 각 $B$의 값을 모두 찾고, 가능한 삼각형이 몇 개인지 판단하는 과정을 설명하시오.",
  },
  {
    id: "R6",
    type: "RANDOM",
    title: "무작위형 6 · 코사인법칙",
    prompt:
      "삼각형의 세 변의 길이가 $5,7,8$일 때, 가장 큰 각이 예각인지 직각인지 둔각인지 코사인법칙으로 판단하는 과정을 설명하시오.",
  },
  {
    id: "R7",
    type: "RANDOM",
    title: "무작위형 7 · 등차수열의 합",
    prompt:
      "등차수열 $\\{a_n\\}$에서 $a_2+a_5=18$, $a_4=11$일 때, 첫째항과 공차를 구하고 $S_{10}$을 구하는 과정을 설명하시오.",
  },
  {
    id: "R8",
    type: "RANDOM",
    title: "무작위형 8 · 등비수열",
    prompt:
      "등비수열 $\\{a_n\\}$에서 $a_1+a_2+a_3=13$, $a_2+a_3+a_4=39$이고 공비가 양수일 때, 공비와 첫째항, 일반항 $a_n$을 구하는 과정을 설명하시오.",
  },
  {
    id: "R9",
    type: "RANDOM",
    title: "무작위형 9 · 수학적 귀납법",
    prompt:
      "모든 자연수 $n$에 대하여 $1^2+2^2+\\cdots+n^2=\\frac{n(n+1)(2n+1)}{6}$임을 수학적 귀납법으로 증명하는 과정을 설명하시오.",
  },
] as const;

const EXAM_HEADERS = [
  "examId",
  "studentId",
  "반",
  "번호",
  "이름",
  "자기선택형",
  "무작위형1",
  "무작위형2",
  "시작시각",
  "종료시각",
  "Hint문항",
  "Hint시각",
  "문항1_정답",
  "문항2_정답",
  "문항3_정답",
  "학생_유창성",
  "교사메모",
  "상태",
  "수정시각",
  "revision",
];
const HISTORY_HEADERS = ["saveId", "저장시각", "저장유형", ...EXAM_HEADERS];

function mark(value: unknown): "O" | "X" | "" {
  return value === "O" || value === "X" ? value : "";
}

function legacyFluency(row: unknown[]): "O" | "X" | "" {
  return deriveStudentFluency(
    [mark(row[13]), mark(row[15]), mark(row[17])].map((value) => value || null) as Mark[],
  ) ?? "";
}

function migrateLegacyExamRows(rows: unknown[][]): (string | number | boolean)[][] {
  return rows
    .filter((row) => row[0])
    .map((row) => [
      ...row.slice(0, 13),
      row[14] ?? "",
      row[16] ?? "",
      legacyFluency(row),
      row[18] ?? "",
      row[19] ?? "",
      row[20] ?? "",
      1,
    ] as (string | number | boolean)[]);
}

function normalizeExamRows(values: unknown[][]): (string | number | boolean)[][] {
  const header = values[0] ?? [];
  const legacy = String(header[13] ?? "").includes("유창성");
  const versioned = String(header[19] ?? "") === "revision";
  if (legacy) return migrateLegacyExamRows(values.slice(1));
  return values
    .slice(1)
    .filter((row) => row[0] && row[1])
    .map((row) => [
      ...row.slice(0, 19).map(sheetValue),
      versioned ? validRevision(row[19]) : 1,
    ]);
}

function latestRowsByStudent(
  rows: (string | number | boolean)[][],
): Map<string, (string | number | boolean)[]> {
  const latest = new Map<string, (string | number | boolean)[]>();
  for (const row of rows) {
    const studentId = String(row[1] ?? "");
    const current = latest.get(studentId);
    if (!current || newerExamRow(row, current)) latest.set(studentId, row);
  }
  return latest;
}

function newerExamRow(
  candidate: (string | number | boolean)[],
  current: (string | number | boolean)[],
): boolean {
  const candidateRevision = validRevision(candidate[19]);
  const currentRevision = validRevision(current[19]);
  if (candidateRevision !== currentRevision) return candidateRevision > currentRevision;
  return String(candidate[18] ?? "") > String(current[18] ?? "");
}

function fixedExamRow(
  student: (string | number | boolean)[],
  existing: (string | number | boolean)[] | undefined,
): (string | number | boolean)[] {
  if (existing) return existing;
  return [
    "",
    student[0],
    student[1],
    student[2],
    student[3],
    "", "", "", "", "", "", "", "", "", "", "", "", "", "", 0,
  ];
}

function validRevision(value: unknown): number {
  const number = Number(value);
  return Number.isInteger(number) && number >= 0 ? number : 0;
}

function sheetValue(value: unknown): string | number | boolean {
  return typeof value === "string" || typeof value === "number" || typeof value === "boolean"
    ? value
    : String(value ?? "");
}

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function rosterPath(): string {
  const index = process.argv.indexOf("--roster");
  const value = index >= 0 ? process.argv[index + 1] : undefined;
  if (!value) {
    throw new Error('명렬 파일을 지정해 주세요: npm run setup:sheet -- --roster "C:\\...\\명렬.xlsx"');
  }
  return value;
}

async function readRoster(path: string): Promise<(string | number | boolean)[][]> {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.readFile(path);
  const sheet = workbook.getWorksheet("전체 명렬");
  if (!sheet) throw new Error("'전체 명렬' 시트를 찾을 수 없습니다.");

  const students: (string | number | boolean)[][] = [];
  for (let column = 1; column <= 20; column += 2) {
    const className = sheet.getCell(1, column).text.trim();
    for (let row = 3; row <= sheet.rowCount; row += 1) {
      const studentId = sheet.getCell(row, column).text.trim();
      const name = sheet.getCell(row, column + 1).text.trim();
      if (!studentId || !name) continue;
      students.push([studentId, className, Number(studentId.slice(-2)), name, true]);
    }
  }
  students.sort((a, b) => String(a[0]).localeCompare(String(b[0])));
  return students;
}

async function ensureSheets(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
): Promise<Map<string, number>> {
  let metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const existing = new Set(
    metadata.data.sheets?.map((sheet) => sheet.properties?.title).filter(Boolean) as string[],
  );
  const missing = TARGET_SHEETS.filter((title) => !existing.has(title));
  if (missing.length) {
    await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: {
        requests: missing.map((title) => ({ addSheet: { properties: { title } } })),
      },
    });
    metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  }
  return new Map(
    metadata.data.sheets?.map((sheet) => [
      sheet.properties?.title ?? "",
      sheet.properties?.sheetId ?? 0,
    ]),
  );
}

async function replaceValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetName: string,
  values: (string | number | boolean)[][],
): Promise<void> {
  await sheets.spreadsheets.values.clear({ spreadsheetId, range: `${sheetName}!A:Z` });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${sheetName}!A1`,
    valueInputOption: "USER_ENTERED",
    requestBody: { values },
  });
}

async function backupExamValues(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  values: unknown[][],
): Promise<string | null> {
  if (!values.length) return null;
  const stamp = new Date().toISOString().replace(/[-:T]/g, "").replace(/\..+/, "");
  const title = `평가기록_백업_${stamp}_${randomUUID().slice(0, 6)}`;
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: { requests: [{ addSheet: { properties: { title } } }] },
  });
  await sheets.spreadsheets.values.update({
    spreadsheetId,
    range: `${title}!A1`,
    valueInputOption: "RAW",
    requestBody: { values: values.map((row) => row.map(sheetValue)) },
  });
  return title;
}

async function trimSheetRows(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  sheetId: number,
  rowCount: number,
): Promise<void> {
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId, gridProperties: { rowCount: Math.max(1, rowCount) } },
            fields: "gridProperties.rowCount",
          },
        },
      ],
    },
  });
}

async function formatSheets(
  sheets: sheets_v4.Sheets,
  spreadsheetId: string,
  ids: Map<string, number>,
): Promise<void> {
  const requests: sheets_v4.Schema$Request[] = [];
  for (const title of TARGET_SHEETS) {
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
      {
        updateDimensionProperties: {
          range: { sheetId, dimension: "COLUMNS", startIndex: 0, endIndex: 19 },
          properties: { pixelSize: 130 },
          fields: "pixelSize",
        },
      },
    );
  }
  const questionSheetId = ids.get("문항목록");
  if (questionSheetId !== undefined) {
    requests.push(
      {
        updateDimensionProperties: {
          range: { sheetId: questionSheetId, dimension: "COLUMNS", startIndex: 3, endIndex: 4 },
          properties: { pixelSize: 620 },
          fields: "pixelSize",
        },
      },
      {
        repeatCell: {
          range: { sheetId: questionSheetId, startRowIndex: 1, startColumnIndex: 3, endColumnIndex: 4 },
          cell: { userEnteredFormat: { wrapStrategy: "WRAP", verticalAlignment: "TOP" } },
          fields: "userEnteredFormat(wrapStrategy,verticalAlignment)",
        },
      },
    );
  }
  const examSheetId = ids.get("평가기록");
  if (examSheetId !== undefined) {
    requests.push(
      {
        setDataValidation: {
          range: { sheetId: examSheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 12, endColumnIndex: 21 },
        },
      },
      {
        setDataValidation: {
          range: { sheetId: examSheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 12, endColumnIndex: 16 },
          rule: {
            condition: { type: "ONE_OF_LIST", values: [{ userEnteredValue: "O" }, { userEnteredValue: "X" }] },
            strict: true,
            showCustomUi: true,
          },
        },
      },
      {
        setDataValidation: {
          range: { sheetId: examSheetId, startRowIndex: 1, endRowIndex: 1000, startColumnIndex: 17, endColumnIndex: 18 },
          rule: {
            condition: {
              type: "ONE_OF_LIST",
              values: [{ userEnteredValue: "IN_PROGRESS" }, { userEnteredValue: "COMPLETED" }],
            },
            strict: true,
            showCustomUi: true,
          },
        },
      },
      {
        updateDimensionProperties: {
          range: { sheetId: examSheetId, dimension: "COLUMNS", startIndex: 16, endIndex: 17 },
          properties: { pixelSize: 280 },
          fields: "pixelSize",
        },
      },
    );
  }
  await sheets.spreadsheets.batchUpdate({ spreadsheetId, requestBody: { requests } });
}

async function main(): Promise<void> {
  if (existsSync(".env.local")) loadEnvFile(".env.local");
  const students = await readRoster(rosterPath());
  if (students.length !== 238) {
    throw new Error(`학생 수가 예상값 238명과 다릅니다: ${students.length}명`);
  }
  if (process.argv.includes("--check")) {
    console.log(`검사 완료: 학생 ${students.length}명, 문항 ${QUESTIONS.length}개`);
    return;
  }

  const spreadsheetId = requiredEnv("GOOGLE_SHEET_ID");
  const auth = new google.auth.JWT({
    email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });
  const ids = await ensureSheets(sheets, spreadsheetId);

  const examValuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "평가기록!A1:U",
  });
  const examValues = examValuesResponse.data.values ?? [];
  const backupTitle = await backupExamValues(sheets, spreadsheetId, examValues);
  const normalizedExamRows = normalizeExamRows(examValues);
  const latestExamRows = latestRowsByStudent(normalizedExamRows);

  await replaceValues(sheets, spreadsheetId, "학생명렬", [
    ["studentId", "반", "번호", "이름", "활성"],
    ...students,
  ]);
  await replaceValues(sheets, spreadsheetId, "문항목록", [
    ["문항ID", "유형", "제목", "문항"],
    ...QUESTIONS.map((question) => [question.id, question.type, question.title, question.prompt]),
  ]);
  await replaceValues(sheets, spreadsheetId, "설정", [
    ["설정", "값", "설명"],
    ["durationSeconds", 360, "평가 시간(초)"],
    ["warningSeconds", 60, "종료 전 경고 시간(초)"],
  ]);

  await replaceValues(sheets, spreadsheetId, "평가기록", [
    EXAM_HEADERS,
    ...students.map((student) => fixedExamRow(student, latestExamRows.get(String(student[0])))),
  ]);

  const historyValuesResponse = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: "평가이력!A1:W",
  });
  const historyValues = historyValuesResponse.data.values ?? [];
  let historyRowCount = historyValues.length;
  if (!historyValues.length) {
    const migratedAt = new Date().toISOString();
    const initializedHistory = [
      HISTORY_HEADERS,
      ...normalizedExamRows.map((row) => [randomUUID(), migratedAt, "MIGRATION", ...row]),
    ];
    await replaceValues(sheets, spreadsheetId, "평가이력", initializedHistory);
    historyRowCount = initializedHistory.length;
  } else {
    await sheets.spreadsheets.values.update({
      spreadsheetId,
      range: "평가이력!A1:W1",
      valueInputOption: "RAW",
      requestBody: { values: [HISTORY_HEADERS] },
    });
  }

  const progressRows = Array.from({ length: 10 }, (_, index) => {
    const row = index + 2;
    const className = `2-${index + 1}`;
    return [
      className,
      `=COUNTIF('학생명렬'!B:B,A${row})`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!R:R,"COMPLETED")`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!R:R,"IN_PROGRESS")`,
      `=B${row}-C${row}-D${row}`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!M:M,"O")+COUNTIFS('평가기록'!C:C,A${row},'평가기록'!N:N,"O")+COUNTIFS('평가기록'!C:C,A${row},'평가기록'!O:O,"O")`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!P:P,"O")`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!K:K,"<>")`,
    ];
  });
  await replaceValues(sheets, spreadsheetId, "진행현황", [
    ["반", "전체", "완료", "진행 중", "미평가", "정답 O", "유창성 O", "Hint 사용"],
    ...progressRows,
  ]);
  await formatSheets(sheets, spreadsheetId, ids);
  const historySheetId = ids.get("평가이력");
  if (historySheetId !== undefined) {
    await trimSheetRows(sheets, spreadsheetId, historySheetId, historyRowCount);
  }

  console.log(`설정 완료: 학생 ${students.length}명, 문항 ${QUESTIONS.length}개`);
  if (backupTitle) console.log(`기존 평가기록 백업: ${backupTitle}`);
  console.log(`https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
