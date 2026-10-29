# review-report.md — 검토 보고서 (오류·장애 기록)

이 문서는 **각 구현 단계(태스크)에서 발생한 오류·장애와 그 해결 과정을 기록**하는 보고서입니다.

- 목적: 나중에 기능을 **수정·업데이트할 때 이 기록을 참고하여 같은 실수를 반복하지 않기** 위함.
- [review.md](review.md)(리뷰 체크리스트)와는 **다릅니다.**
  - `review.md` = 리뷰할 때 점검하는 **기준(체크리스트)**
  - `review-report.md` = 실제로 **겪은 오류·장애의 기록(로그)**
- 작성 규칙: 오류/장애가 발생할 때마다 아래 형식으로 **항목을 추가**합니다. 기존 항목은 지우지 않고 계속 누적합니다.

---

## 기록 형식 (복사해서 사용)

```
### [날짜] 태스크N - <한 줄 제목>

- **단계/위치**: (어느 태스크·화면·파일에서)
- **증상**: (어떤 오류/장애가 보였는가)
- **원인**: (왜 발생했는가)
- **해결**: (어떻게 고쳤는가)
- **재발 방지**: (다음에 같은 실수를 피하려면 무엇을 기억할 것인가)
- **관련 파일/커밋**: (해당 파일, 커밋 해시 등)
```

---

## 기록 (최신순)

<!-- 새 항목을 이 아래에 추가하세요 -->

### [2026-10-29] 전체 - 구현 전 PRD(수용 기준) 대조를 안 해 누락 발생

- **단계/위치**: 태스크 1~3 전반, spec.md 13장(AC)·12장(데이터 구조) 대비
- **증상**: review.md(코드 체크리스트)로만 검토하고 spec.md 수용 기준을 한 줄씩 대조하지 않아, (1) AC1-5(새로고침 유실 방지) 미구현 (2) Firestore 구조 누락: `className`, `problem.source`, `design.description`, `sensors`/`outputs` 분리, `makecode.shareId`, 이미지 Storage 업로드(`imageUrls`) (3) Gemini 기능이 PRD에 아예 없음.
- **원인**: "코드 리뷰(review.md)"와 "PRD 수용 기준 대조"를 같은 것으로 착각. 둘은 다른 관문.
- **해결**: localStorage 자동저장(AC1-5), Storage 업로드/필드 보완, sensors·outputs 분리 구현. spec.md에 Gemini 기능(기능 4)·AC4 추가.
- **재발 방지**: 각 태스크 완료 시 **review.md(코드) + spec.md 13장(수용 기준)을 둘 다** 체크할 것. 새 기능을 추가하면 **먼저 PRD(spec.md)에 반영**한 뒤 구현할 것.
- **관련 파일/커밋**: `app.js`, `firebase-db.js`, `index.html`, `spec.md`

### [2026-10-29] 태스크3 - Gemini 모델명 지원 종료로 404 (gemini-2.0-flash / 2.5-flash)

- **단계/위치**: 태스크3 통합 테스트, `config.js`/`gemini.js`의 모델명
- **증상**: 실제 키로 호출 시 404. 본문: "models/gemini-2.0-flash is no longer available ... use models/gemini-3.8-flash". gemini-2.5-flash도 "no longer available to new users".
- **원인**: 코드 작성 시점의 모델명이 이미 구버전이었음. 모델은 수시로 지원 종료됨.
- **해결**: 사용 가능 모델 목록(`/v1beta/models`)을 조회해 `gemini-3.8-flash`로 변경. 503(과부하) 재시도 안내 문구 추가.
- **재발 방지**: 모델명을 하드코딩만 하지 말고 (1) 지원 종료 대비해 `config.js`에서 쉽게 바꿀 수 있게 두고 (2) 404(모델 없음) 에러를 사용자 안내로 매핑하고 (3) 필요 시 `/models` 목록으로 유효 모델을 확인할 것. 안정 별칭 `gemini-flash-latest`도 대안.
- **관련 파일/커밋**: `config.js`, `config.example.js`, `gemini.js`, `app.js`

### [2026-10-29] 태스크3 - Firestore 저장 시 permission-denied (보안 규칙)

- **단계/위치**: 태스크3, `firebase-db.js`의 `db.collection("projects").add(...)`
- **증상**: 저장 시 `permission-denied` ("Missing or insufficient permissions").
- **원인**: Firestore 보안 규칙이 기본 잠금 상태라 클라이언트 쓰기가 거부됨. (코드 문제 아님 — DB 연결·SDK는 정상)
- **해결**: Firebase 콘솔 > Firestore Database > 규칙에서 쓰기를 허용해야 함. 수업용 예시 규칙:
  ```
  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /projects/{doc} {
        allow create: if true;      // 누구나 새 설계 저장 허용
        allow read, update, delete: if false;
      }
    }
  }
  ```
  (코드로는 permission-denied를 "저장 권한이 없어요…" 안내로 매핑해 두었음.)
- **재발 방지**: Firebase 연동 시 **보안 규칙 설정이 코드 못지않게 중요**함을 기억. 배포 전 규칙을 명시적으로 점검하고, permission-denied를 사용자 친화 메시지로 처리할 것.
- **관련 파일/커밋**: `firebase-db.js`, `app.js`

### [2026-10-29] 태스크2 - 선택 파일 `config.js` 자동 로드로 404 콘솔 에러 발생

- **단계/위치**: 태스크2, `index.html`의 `<script src="config.js">`
- **증상**: config.js를 만들지 않은 기본 상태에서 콘솔에 404(Not Found) 에러가 떴다.
- **원인**: 존재하지 않을 수 있는 선택 파일을 `<script src>`로 무조건 로드해서. `onerror` 핸들러로는 네트워크 404 자체를 막지 못함.
- **해결**: config.js 자동 로드 `<script>`를 주석 처리하고, API 키는 화면 입력을 기본으로 변경. 파일로 쓰려는 경우에만 주석을 풀도록 안내(config.example.js).
- **재발 방지**: "있을 수도/없을 수도 있는" 선택 파일을 `<script src>`/`<link>`로 정적 로드하지 말 것. 필요하면 조건부 동적 삽입을 쓰고, 기본 경로는 404가 나지 않게 할 것.
- **관련 파일/커밋**: `index.html`, `config.example.js`

### [2026-10-29] 태스크2 - (주의) 클라이언트에서 Gemini API 키 노출

- **단계/위치**: 태스크2, `gemini.js`의 브라우저 `fetch` 호출
- **증상**: 오류는 아니나, 브라우저에서 API 키로 직접 호출하면 키가 네트워크 탭/소스에 노출됨.
- **원인**: 백엔드 없이 클라이언트에서 직접 Gemini를 호출하는 프로토타입 구조.
- **해결(현재)**: 키를 커밋하지 않도록 `.gitignore`에 `config.js` 추가, 화면 입력 키는 메모리에만 보관.
- **재발 방지**: 실제 배포 시에는 태스크3의 Firebase Functions 등 **백엔드 프록시로 키를 숨기고** 클라이언트에는 키를 두지 말 것.
- **관련 파일/커밋**: `gemini.js`, `.gitignore`, `config.example.js`

### [2026-10-29] 태스크1 - `hidden` 속성이 `.btn`에 덮여 "이전" 버튼이 1단계에서도 보임

- **단계/위치**: 태스크1 UI, `styles.css` / `index.html`의 footer `#prev-btn`
- **증상**: 1단계에서 숨겨져야 할 "← 이전" 버튼이 화면에 그대로 표시됨.
- **원인**: JS로 `el.hidden = true`를 설정해도, CSS의 `.btn { display: inline-block }`이 브라우저 기본 `[hidden] { display: none }`보다 우선순위가 높아 숨김이 무시됨.
- **해결**: 전역 규칙 `[hidden] { display: none !important; }`를 추가.
- **재발 방지**: `display` 값을 지정하는 클래스(.btn 등)를 `hidden` 속성으로 숨기려 할 때는, `[hidden]`에 `!important`를 주거나 요소별로 `.class[hidden]{display:none}`를 명시할 것. JS의 `hidden` 토글만 믿지 말 것.
- **관련 파일/커밋**: `styles.css`(상단 전역 규칙), `app.js`(goToStep의 prev-btn 토글)
