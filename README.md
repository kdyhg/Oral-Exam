# 대수 수학개념 도슨트

복도에서 교사 1명과 학생 1명이 진행하는 6분 구술 수행평가 운영 도구입니다.

학생이 자기선택형 문항을 누르면 평가가 즉시 시작되고, 무작위형 문항 2개가 고정됩니다. 교사는 세 문항 각각의 `정답 여부 O/X`와 `유창성 O/X`, Hint 1회, 메모를 기록할 수 있습니다. 모든 기록은 지정된 Google Sheet에 저장됩니다.

## 주요 기능

- 반별 진행률과 학생별 미평가·진행 중·완료 상태
- 자기선택형 문항 선택 즉시 6분 타이머 시작
- 서로 다른 무작위형 문항 2개 배정 및 새로고침 후 복원
- 종료 1분 전 경고와 종료 알림
- 전체 평가에서 Hint 1회 사용 및 대상 문항·시각 기록
- 문항별 정답 여부와 유창성 O/X 즉시 저장
- 교사용 PIN과 HTTP-only 세션 쿠키
- 모바일·태블릿 중심 반응형 화면

## Google Sheet 준비

1. Google Cloud에서 프로젝트와 서비스 계정을 만들고 **Google Sheets API**를 활성화합니다.
2. 서비스 계정 JSON 키를 발급합니다.
3. 대상 [Google Sheet](https://docs.google.com/spreadsheets/d/1YszwXbr-wVJBYK0PVYEXCvnPnGzbyNDqUOgCA84O4k0/edit)에 서비스 계정 이메일을 **편집자**로 공유합니다.
4. `.env.example`을 참고하여 `.env.local`을 만듭니다.

```dotenv
GOOGLE_SHEET_ID=1YszwXbr-wVJBYK0PVYEXCvnPnGzbyNDqUOgCA84O4k0
GOOGLE_SERVICE_ACCOUNT_EMAIL=service-account@example.iam.gserviceaccount.com
GOOGLE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
APP_PIN=교사용-PIN
SESSION_SECRET=충분히-긴-무작위-문자열
```

`SESSION_SECRET`은 다음 명령으로 만들 수 있습니다.

```powershell
[Convert]::ToBase64String((1..48 | ForEach-Object { Get-Random -Maximum 256 }))
```

## Sheet 초기화

초기화 도구는 첨부 명렬 파일을 직접 읽어 `학생명렬` 탭을 만듭니다. 학생 이름은 소스 코드나 Git 저장소에 저장하지 않습니다.

```powershell
npm install
npm run setup:sheet -- --roster "C:\경로\2026학년도 2학년 1학기 명렬 2026.06.05.xlsx"
```

외부 연결 없이 명렬과 문항 수만 검사하려면 `--check`를 추가합니다.

```powershell
npm run setup:sheet -- --check --roster "C:\경로\2026학년도 2학년 1학기 명렬 2026.06.05.xlsx"
```

기존의 관계없는 탭은 보존합니다. 다음 탭을 생성하거나 갱신합니다.

- `학생명렬`: 이름이 존재하는 학생만 등록
- `문항목록`: 자기선택형 3문항과 무작위형 9문항
- `평가기록`: 앱이 평가 결과를 추가·수정
- `진행현황`: 반별 완료·미평가·평가 결과 요약
- `설정`: 평가 시간과 경고 시간

기존 `평가기록` 탭에 데이터가 있으면 초기화 도구가 삭제하지 않습니다.

## 로컬 실행과 검증

```powershell
npm run dev
npm run lint
npm test
npm run build
```

## Vercel 배포

1. 이 GitHub 저장소를 Vercel 프로젝트로 가져옵니다.
2. `.env.local`의 다섯 환경변수를 Vercel 프로젝트의 Production 환경에 등록합니다.
3. 기본 브랜치를 배포합니다.

CLI가 로그인되어 있다면 다음 명령으로도 배포할 수 있습니다.

```powershell
npx vercel link
npx vercel --prod
```

서비스 계정 키, PIN, 세션 비밀값은 Git에 커밋하지 마세요.
