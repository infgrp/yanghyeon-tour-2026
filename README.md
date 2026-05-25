# 양현고 현장체험학습 안전 관리 앱

현장체험학습에서 학생 안전을 지키기 위해 동분서주하시는 선생님들께 조금이나마 도움이 되었으면 하는 마음으로 만든 웹 앱입니다.  
수십 명의 학생을 인솔하며 점호를 챙기고, 사건사고에 대응하고, 학부모와 소통해야 하는 선생님들의 수고를 덜어드릴 수 있기를 바랍니다.

---

## 주요 기능

| 대상 | 기능 |
|------|------|
| **관리자** | 학생·교사 계정 관리, 점호 세션 생성/마감, 전체 현황 대시보드, 버스/숙소/일정 데이터 관리 |
| **교사** | 실시간 점호 진행, 승차 현황 모니터링, 학생 검색, 사건사고 등록, 점호 이력 조회·CSV 내보내기 |
| **학생** | QR 코드로 자가 체크인, 일정·숙소·비상연락처 조회, 분실물 신고 |
| **학부모** | 로그인 없이 자녀의 점호 현황 조회 (`/parent`) |

### 세부 기능 목록

- **실시간 점호** — QR 스캔 또는 교사 직접 탭으로 체크인, 마감 5분 전 미응답 학생에게 푸시 알림
- **호차별 탑승률 배너** — 승차점호 진행 중 교사 화면에 호차별 진행률 실시간 표시
- **사건사고 기록** — 인시던트 내용 등록 및 관리 (교사·관리자만 조회)
- **분실물 게시판** — 분실·습득 신고, 상태 변경(습득 처리 → 반환 완료)
- **공지 채팅** — 관리자→교사→학생 일방향 공지 채널
- **점호 이력 리포트** — 날짜별 완료율 조회, CSV 다운로드
- **학부모 조회 포털** — 학년·반·번호 입력 시 자녀의 점호 현황 표시 (개인정보 최소화)

---

## 기술 스택

- **프론트엔드**: Next.js 14 (App Router), TypeScript, Tailwind CSS, shadcn/ui
- **데이터베이스**: Firebase Firestore (실시간 구독)
- **인증**: Firebase Authentication (이메일/비밀번호)
- **푸시 알림**: Firebase Cloud Messaging (FCM)
- **배포**: Vercel (자동 CI/CD)
- **PWA**: 홈 화면 추가, 오프라인 대응

---

## 1단계: Firebase 프로젝트 설정

### 1-1. Firebase 콘솔에서 프로젝트 생성

1. [Firebase Console](https://console.firebase.google.com) 접속
2. **프로젝트 추가** → 프로젝트 이름 입력 (예: `yanghyeon-tour-2026`)
3. Google Analytics 설정은 선택 사항

### 1-2. 앱 등록

1. 프로젝트 홈 → **웹 앱 추가** (`</>` 아이콘 클릭)
2. 앱 닉네임 입력 후 **앱 등록**
3. 표시되는 `firebaseConfig` 값을 메모해 둡니다 (아래 환경 변수 설정에서 사용)

```js
// 이런 형태입니다
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "your-project.firebaseapp.com",
  projectId: "your-project",
  storageBucket: "your-project.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123",
  measurementId: "G-XXXXXXX"   // 선택
};
```

### 1-3. Authentication 활성화

1. Firebase Console → **Authentication** → **시작하기**
2. **로그인 방법** → **이메일/비밀번호** 활성화

### 1-4. Firestore 데이터베이스 생성

1. Firebase Console → **Firestore Database** → **데이터베이스 만들기**
2. **프로덕션 모드**로 시작
3. 리전: `asia-northeast3` (서울) 권장

### 1-5. FCM (푸시 알림) 설정

1. Firebase Console → **프로젝트 설정** → **클라우드 메시징** 탭
2. **웹 푸시 인증서** → **키 쌍 생성** 클릭
3. 생성된 **VAPID 키 (공개 키)** 를 메모 (환경 변수 `NEXT_PUBLIC_VAPID_KEY`)

### 1-6. 서비스 계정 키 발급 (서버 측 관리 작업용)

1. Firebase Console → **프로젝트 설정** → **서비스 계정** 탭
2. **새 비공개 키 생성** → JSON 파일 다운로드
3. 이 JSON 파일 내용이 `FIREBASE_SERVICE_ACCOUNT_JSON` 환경 변수가 됩니다

> **보안 주의**: 이 JSON 파일은 절대 GitHub에 올리지 마세요.

---

## 2단계: Firestore 보안 규칙 배포

데이터 접근 권한을 제어하는 규칙을 Firebase에 배포합니다.

### 2-1. Firebase CLI 설치

```bash
npm install -g firebase-tools
firebase login
```

### 2-2. 프로젝트 연결

```bash
cd safe_tour_app
firebase use --add
# 목록에서 생성한 프로젝트 선택
```

### 2-3. 보안 규칙 배포

```bash
firebase deploy --only firestore:rules
```

규칙 내용(`firestore.rules`)은 다음 권한 구조를 따릅니다:

| 컬렉션 | 학생 | 교사 | 관리자 |
|--------|------|------|--------|
| `students` | 본인 문서만 읽기 | 전체 읽기 | 전체 읽기/쓰기 |
| `checkins` | 읽기·생성 | 읽기·삭제 | 전체 |
| `incidents` | 접근 불가 | 읽기·생성 | 전체 |
| `lost_items` | 읽기·생성, 본인 삭제 | 전체 | 전체 |
| `settings` | 읽기 | 읽기 | 전체 |

---

## 3단계: Firestore 초기 데이터 입력

### 필수 컬렉션 구조

Firestore Console에서 직접 생성하거나, `/admin/upload` 페이지에서 엑셀 업로드로 일괄 등록합니다.

#### `students` 컬렉션 (학생 명부)

| 필드 | 타입 | 예시 | 설명 |
|------|------|------|------|
| `이름` | string | `홍길동` | 학생 이름 |
| `학년` | number | `2` | 학년 |
| `반` | number | `3` | 반 |
| `번호` | number | `15` | 출석번호 |
| `호차` | number | `2` | 배정된 버스 호차 |
| `호실` | string | `201` | 숙소 호실 |
| `전화번호` | string | `010-1234-5678` | 학생 연락처 |
| `보호자전화번호` | string | `010-9876-5432` | 학부모 연락처 |
| `uid` | string | _(비워 둠)_ | 가입 후 자동 입력됨 |

#### `settings/global` 문서 (필수)

Firestore Console에서 `settings` 컬렉션 → `global` 문서를 만들고 아래 필드를 추가합니다:

| 필드 | 타입 | 예시 | 설명 |
|------|------|------|------|
| `teacherSignupCode` | string | `TEACHER2026` | 교사 가입 시 입력하는 코드 |
| `studentLoginEnabled` | boolean | `true` | 학생 로그인 허용 여부 |

#### `buses` 컬렉션 (버스 정보, 선택)

| 필드 | 타입 | 예시 |
|------|------|------|
| `호차` | number | `1` |
| `기사이름` | string | `김기사` |
| `차량번호` | string | `12가 3456` |
| `연락처` | string | `010-0000-0000` |

#### `schedule` 컬렉션 (여행 일정, 선택)

| 필드 | 타입 | 예시 |
|------|------|------|
| `title` | string | `경복궁 방문` |
| `date` | string | `2026-05-20` |
| `time` | string | `09:00` |
| `location` | string | `경복궁` |
| `description` | string | `조별 자유 관람` |

---

## 4단계: Vercel 배포

### 4-1. GitHub에 코드 올리기

```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/사용자명/저장소명.git
git push -u origin main
```

### 4-2. Vercel 프로젝트 생성

1. [Vercel](https://vercel.com) 로그인 → **Add New Project**
2. GitHub 저장소 선택
3. Framework: **Next.js** (자동 감지)
4. **Deploy** 클릭 (환경 변수는 다음 단계에서 추가)

### 4-3. 환경 변수 설정

Vercel 프로젝트 → **Settings** → **Environment Variables** 에서 아래 변수를 모두 추가합니다.

#### 클라이언트 측 (NEXT_PUBLIC_ 접두사)

| 변수명 | 값 출처 | 설명 |
|--------|---------|------|
| `NEXT_PUBLIC_FIREBASE_API_KEY` | firebaseConfig.apiKey | Firebase API 키 |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | firebaseConfig.authDomain | 인증 도메인 |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | firebaseConfig.projectId | 프로젝트 ID |
| `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET` | firebaseConfig.storageBucket | 스토리지 버킷 |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | firebaseConfig.messagingSenderId | FCM 발신자 ID |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | firebaseConfig.appId | 앱 ID |
| `NEXT_PUBLIC_VAPID_KEY` | FCM 웹 푸시 공개 키 | 푸시 알림용 VAPID 키 |

#### 서버 측 (API Routes 전용)

| 변수명 | 값 출처 | 설명 |
|--------|---------|------|
| `FIREBASE_SERVICE_ACCOUNT_JSON` | 서비스 계정 JSON 전체 | Firebase Admin SDK 인증 |

`FIREBASE_SERVICE_ACCOUNT_JSON` 값은 서비스 계정 JSON 파일 내용을 **한 줄로** 붙여넣습니다:

```
{"type":"service_account","project_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n", ...}
```

### 4-4. 재배포

환경 변수 추가 후 **Deployments** → **Redeploy** 또는 코드를 `git push` 하면 자동 배포됩니다.

---

## 5단계: 관리자 계정 설정

Vercel 배포 완료 후 최초 1회 진행합니다.

1. 배포된 URL로 접속 → **회원가입** (교사 가입 코드 입력하여 교사 계정 생성)
2. Firebase Console → **Authentication** → 가입된 계정의 UID 복사
3. Firebase Console → **Firestore** → `users` 컬렉션 → 해당 UID 문서 열기
4. `role` 필드 값을 `teacher` → `admin` 으로 변경
5. 이후 해당 계정으로 `/admin` 페이지 접속 가능

---

## 6단계: 학생 데이터 업로드

1. 관리자 계정으로 로그인 → `/admin/upload` 페이지 접속
2. 엑셀 파일(.xlsx) 양식에 맞게 학생 명부 작성 후 업로드
3. 업로드 완료 후 `/admin` → **학생** 탭에서 등록 확인

---

## 로컬 개발 환경

```bash
# 의존성 설치
npm install

# 환경 변수 파일 생성
cp .env.example .env.local
# .env.local 에 위 환경 변수들을 채워 넣습니다

# 개발 서버 시작
npm run dev
# http://localhost:3000 접속
```

### 보안 규칙 변경 후 배포

```bash
firebase deploy --only firestore:rules
```

### 코드 변경 후 Vercel 배포

```bash
git add .
git commit -m "변경 내용 설명"
git push
# Vercel이 자동으로 빌드·배포합니다
```

---

## 화면 구조

```
/               접속 시 역할에 따라 자동 이동
/login          로그인 / 회원가입
/parent         학부모 점호 현황 조회 (로그인 불필요)
/student        학생 메인 (QR 체크인, 일정, 분실물)
/teacher        교사 메인 (점호, 학생 관리)
/teacher/checkin  실시간 점호 진행
/teacher/boarding 호차별 승차 현황
/teacher/report   점호 이력 리포트
/teacher/search   학생 검색
/teacher/incident 사건사고 등록
/teacher/rooms    숙소 배정 조회
/admin          관리자 대시보드
/admin/upload   학생 명부 엑셀 업로드
/chat           공지 채팅
/schedule       여행 일정
/contacts       비상연락처
/lost-items     분실물 게시판
```

---

## 자주 묻는 질문

**Q. 교사가 비밀번호를 잊어버렸어요.**  
A. 로그인 화면 → **비밀번호 찾기** 클릭 후 이메일로 재설정 링크를 받습니다.  
관리자가 대신 처리할 경우: `/admin` → **교사** 탭 → 해당 교사 → **비밀번호 초기화** 버튼.

**Q. 학생이 QR 코드를 스캔했는데 체크인이 안 돼요.**  
A. 진행 중인 점호 세션이 있는지 확인하세요. 세션이 없으면 체크인이 불가합니다.

**Q. 푸시 알림이 오지 않아요.**  
A. 학생이 앱 접속 후 브라우저의 알림 권한을 **허용**해야 합니다.  
iOS Safari에서는 홈 화면에 추가(PWA)한 경우에만 푸시가 동작합니다.

**Q. Firestore 보안 규칙을 수정했는데 반영이 안 돼요.**  
A. `firebase deploy --only firestore:rules` 명령으로 다시 배포해야 합니다.  
Vercel 배포와 별개입니다.

---

## 라이선스

이 프로젝트는 양현고등학교 내부 사용을 목적으로 개발되었습니다.
