import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";

import { google, type sheets_v4 } from "googleapis";

const STATISTICS_SHEET = "점수통계";
const SCORE_STATISTICS_HEADERS = [
  "반",
  "전체",
  "완료",
  "미평가",
  "완료율",
  "평균",
  "최고점",
  "최저점",
  "100점",
  "90점",
  "80점",
  "70점",
  "60점",
  "유창성 O",
  "선택형 O",
  "무작위 2개 O",
  "Hint 사용",
];

function requiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} 환경변수가 필요합니다.`);
  return value;
}

function literalText(value: unknown): string {
  return `'${String(value ?? "")}`;
}

function scoreStatisticsRows(): (string | number | boolean)[][] {
  const classRows = Array.from({ length: 10 }, (_, index) => {
    const row = index + 2;
    return scoreStatisticsClassRow(literalText(`2-${index + 1}`), row);
  });
  return [
    SCORE_STATISTICS_HEADERS,
    ...classRows,
    scoreStatisticsTotalRow(12),
  ];
}

function scoreStatisticsClassRow(className: string, row: number): (string | number | boolean)[] {
  return [
    className,
    `=COUNTIF('점수현황'!$B$2:$B$239,$A${row})`,
    `=COUNTIFS('점수현황'!$B$2:$B$239,$A${row},'점수현황'!$E$2:$E$239,"COMPLETED")`,
    `=B${row}-C${row}`,
    `=IF(B${row}=0,"",C${row}/B${row})`,
    `=IF(C${row}=0,"",ROUND(AVERAGEIFS('점수현황'!$N$2:$N$239,'점수현황'!$B$2:$B$239,$A${row},'점수현황'!$E$2:$E$239,"COMPLETED"),1))`,
    `=IF(C${row}=0,"",MAXIFS('점수현황'!$N$2:$N$239,'점수현황'!$B$2:$B$239,$A${row},'점수현황'!$E$2:$E$239,"COMPLETED"))`,
    `=IF(C${row}=0,"",MINIFS('점수현황'!$N$2:$N$239,'점수현황'!$B$2:$B$239,$A${row},'점수현황'!$E$2:$E$239,"COMPLETED"))`,
    scoreCountFormula(row, 100),
    scoreCountFormula(row, 90),
    scoreCountFormula(row, 80),
    scoreCountFormula(row, 70),
    scoreCountFormula(row, 60),
    `=COUNTIFS('점수현황'!$B$2:$B$239,$A${row},'점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$F$2:$F$239,"O")`,
    `=COUNTIFS('점수현황'!$B$2:$B$239,$A${row},'점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$H$2:$H$239,"O")`,
    `=COUNTIFS('점수현황'!$B$2:$B$239,$A${row},'점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$L$2:$L$239,2)`,
    `=COUNTIFS('평가기록'!$C$2:$C$239,$A${row},'평가기록'!$K$2:$K$239,"?*")`,
  ];
}

function scoreStatisticsTotalRow(row: number): (string | number | boolean)[] {
  return [
    literalText("전체"),
    `=COUNTA('점수현황'!$A$2:$A$239)`,
    `=COUNTIF('점수현황'!$E$2:$E$239,"COMPLETED")`,
    `=B${row}-C${row}`,
    `=IF(B${row}=0,"",C${row}/B${row})`,
    `=IF(C${row}=0,"",ROUND(AVERAGEIF('점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$N$2:$N$239),1))`,
    `=IF(C${row}=0,"",MAXIFS('점수현황'!$N$2:$N$239,'점수현황'!$E$2:$E$239,"COMPLETED"))`,
    `=IF(C${row}=0,"",MINIFS('점수현황'!$N$2:$N$239,'점수현황'!$E$2:$E$239,"COMPLETED"))`,
    totalScoreCountFormula(100),
    totalScoreCountFormula(90),
    totalScoreCountFormula(80),
    totalScoreCountFormula(70),
    totalScoreCountFormula(60),
    `=COUNTIFS('점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$F$2:$F$239,"O")`,
    `=COUNTIFS('점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$H$2:$H$239,"O")`,
    `=COUNTIFS('점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$L$2:$L$239,2)`,
    `=COUNTIF('평가기록'!$K$2:$K$239,"?*")`,
  ];
}

function scoreCountFormula(row: number, score: number): string {
  return `=COUNTIFS('점수현황'!$B$2:$B$239,$A${row},'점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$N$2:$N$239,${score})`;
}

function totalScoreCountFormula(score: number): string {
  return `=COUNTIFS('점수현황'!$E$2:$E$239,"COMPLETED",'점수현황'!$N$2:$N$239,${score})`;
}

function progressRows(): (string | number | boolean)[][] {
  const rows = Array.from({ length: 10 }, (_, index) => {
    const row = index + 2;
    const className = `2-${index + 1}`;
    return [
      literalText(className),
      `=COUNTIF('학생명렬'!B:B,A${row})`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!R:R,"COMPLETED")`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!R:R,"IN_PROGRESS")`,
      `=B${row}-C${row}-D${row}`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!M:M,"O")+COUNTIFS('평가기록'!C:C,A${row},'평가기록'!N:N,"O")+COUNTIFS('평가기록'!C:C,A${row},'평가기록'!O:O,"O")`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!P:P,"O")`,
      `=COUNTIFS('평가기록'!C:C,A${row},'평가기록'!K:K,"?*")`,
    ];
  });
  return [
    ["반", "전체", "완료", "진행 중", "미평가", "정답 O", "유창성 O", "Hint 사용"],
    ...rows,
  ];
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

async function main(): Promise<void> {
  if (existsSync(".env.local")) loadEnvFile(".env.local");
  const spreadsheetId = requiredEnv("GOOGLE_SHEET_ID");
  const auth = new google.auth.JWT({
    email: requiredEnv("GOOGLE_SERVICE_ACCOUNT_EMAIL"),
    key: requiredEnv("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n"),
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  const sheets = google.sheets({ version: "v4", auth });

  const metadata = await sheets.spreadsheets.get({ spreadsheetId, fields: "sheets.properties" });
  const existing = new Map(
    metadata.data.sheets?.map((sheet) => [
      sheet.properties?.title ?? "",
      sheet.properties?.sheetId ?? 0,
    ]),
  );
  let statisticsSheetId = existing.get(STATISTICS_SHEET);
  if (statisticsSheetId === undefined) {
    const response = await sheets.spreadsheets.batchUpdate({
      spreadsheetId,
      requestBody: { requests: [{ addSheet: { properties: { title: STATISTICS_SHEET } } }] },
    });
    statisticsSheetId = response.data.replies?.[0]?.addSheet?.properties?.sheetId ?? undefined;
  }
  if (statisticsSheetId === undefined) throw new Error("점수통계 Sheet를 생성하지 못했습니다.");

  await replaceValues(sheets, spreadsheetId, STATISTICS_SHEET, scoreStatisticsRows());
  await replaceValues(sheets, spreadsheetId, "진행현황", progressRows());
  await sheets.spreadsheets.batchUpdate({
    spreadsheetId,
    requestBody: {
      requests: [
        {
          updateSheetProperties: {
            properties: { sheetId: statisticsSheetId, gridProperties: { frozenRowCount: 1 } },
            fields: "gridProperties.frozenRowCount",
          },
        },
        {
          repeatCell: {
            range: { sheetId: statisticsSheetId, startRowIndex: 0, endRowIndex: 1 },
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
          setBasicFilter: {
            filter: {
              range: {
                sheetId: statisticsSheetId,
                startRowIndex: 0,
                endRowIndex: 12,
                startColumnIndex: 0,
                endColumnIndex: SCORE_STATISTICS_HEADERS.length,
              },
            },
          },
        },
        {
          updateDimensionProperties: {
            range: { sheetId: statisticsSheetId, dimension: "COLUMNS", startIndex: 0, endIndex: SCORE_STATISTICS_HEADERS.length },
            properties: { pixelSize: 104 },
            fields: "pixelSize",
          },
        },
        {
          repeatCell: {
            range: { sheetId: statisticsSheetId, startRowIndex: 1, startColumnIndex: 4, endColumnIndex: 5 },
            cell: { userEnteredFormat: { numberFormat: { type: "PERCENT", pattern: "0.0%" } } },
            fields: "userEnteredFormat.numberFormat",
          },
        },
        {
          repeatCell: {
            range: { sheetId: statisticsSheetId, startRowIndex: 1, startColumnIndex: 5, endColumnIndex: 8 },
            cell: { userEnteredFormat: { numberFormat: { type: "NUMBER", pattern: "0.0" } } },
            fields: "userEnteredFormat.numberFormat",
          },
        },
        {
          repeatCell: {
            range: { sheetId: statisticsSheetId, startRowIndex: 11, endRowIndex: 12, startColumnIndex: 0, endColumnIndex: SCORE_STATISTICS_HEADERS.length },
            cell: {
              userEnteredFormat: {
                backgroundColor: { red: 0.91, green: 0.96, blue: 1 },
                textFormat: { bold: true },
              },
            },
            fields: "userEnteredFormat(backgroundColor,textFormat)",
          },
        },
      ],
    },
  });

  console.log("점수통계와 진행현황 수식을 갱신했습니다.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
