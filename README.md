# 대수 수학개념 도슨트

복도에서 교사 1명과 학생 1명이 진행하는 6분 구술 수행평가 운영 도구입니다.

학생이 자기선택형 문항을 고르면 무작위형 문항 2개와 타이머가 즉시 시작됩니다. 평가 중 입력은 해당 브라우저에만 자동 저장되며, 교사가 `평가 완료`를 누를 때 학생 한 명의 최종 결과를 Google Sheet에 한 번 저장합니다.

## 주요 기능

- 반별 진행률과 학생별 미평가·진행 중·완료 상태
- 자기선택형 1문항과 서로 다른 무작위형 2문항
- 6분 타이머, 종료 1분 전 경고, 종료 알림
- 세 문항별 정답 여부 O/X와 학생별 유창성 O/X
- 저장 직후 100점 만점 점수 결과 화면 표시
- 전체 평가에서 Hint 1회 및 대상 문항·시각 기록
- Hint를 사용하지 않아도 평가 완료 가능
- 새로고침 및 학생 목록 이동 후에도 같은 기기에서 초안 복구
- 완료 버튼을 누를 때만 Google Sheet에 단일 저장
- 학생별 고정 행과 revision 충돌 검사로 다중 교사 동시 평가 지원
- 모든 성공한 저장본을 `평가이력` 탭에 보존
- `점수현황` 탭에서 공식 완료 기록 기준 세부 점수와 총점 확인
- `점수통계` 탭에서 반별 평균, 점수대별 인원, 완료율 확인
- 평가 취소, 수정 취소, 전체 초안 삭제, 24시간 후 초안 자동 만료
- 완료 학생의 공식 기록 초기화 및 RESET 이력 보존
- 교사용 PIN과 HTTP-only 세션 쿠키
- PC·태블릿 3열 문제 화면과 휴대폰 세로 화면

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

## Sheet 초기화 및 마이그레이션

초기화 도구는 첨부 명렬 파일을 직접 읽어 `학생명렬` 탭을 만듭니다. 학생 이름은 소스 코드나 Git 저장소에 저장하지 않습니다.

실행할 때 기존 `평가기록`은 날짜가 붙은 백업 탭에 먼저 보존됩니다. 이후 활성 학생 238명의 고정 행과 `revision` 열을 만들고, 기존 중복 기록은 가장 최신 기록을 공식 기록으로 사용합니다. 모든 기존 기록은 백업에 남으며 최초 마이그레이션 기록은 `평가이력`에도 보존됩니다.

기존 `평가기록`에 문항별 유창성 3개가 있으면 학생별 유창성 하나로 변환합니다. 세 값이 모두 O면 O, 하나라도 X면 X, 그 외에는 빈칸으로 옮깁니다.

```powershell
npm install
npm run setup:sheet -- --roster "C:\경로\2026학년도 2학년 1학기 명렬 2026.06.05.xlsx"
```

외부 연결 없이 명렬과 문항 수만 검사하려면 `--check`를 추가합니다.

```powershell
npm run setup:sheet -- --check --roster "C:\경로\2026학년도 2학년 1학기 명렬 2026.06.05.xlsx"
```

기존의 관계없는 탭은 보존합니다.

- `학생명렬`: 이름이 존재하는 학생만 등록
- `문항목록`: 자기선택형 3문항과 무작위형 9문항
- `평가기록`: 완료된 학생별 최종 결과
- `평가이력`: 생성·수정·강제 덮어쓰기된 모든 저장본
- `점수현황`: 학생별 유창성·선택형·무작위형 세부 점수와 총점
- `점수통계`: 반별 평균, 100·90·80·70·60점 인원과 추가 통계
- `진행현황`: 반별 완료·미평가·평가 결과 요약
- `설정`: 평가 시간과 경고 시간

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

서비스 계정 키, PIN, 세션 비밀값은 Git에 커밋하지 마세요.
