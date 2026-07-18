# Phase 4 — Supabase 백엔드 연결 가이드

로그인·프로필·리더보드 UI와 클라이언트 연결은 이미 구현되어 있다. 환경변수 두 개가 없으면 관련 UI가 숨겨지고 게임은 로컬 개인 기록만 사용하는 기존 모드로 동작한다.

## 현재 구현 범위

- Google OAuth 및 이메일 매직 링크 로그인
- 공개 리더보드 표시 이름 변경
- 결과 화면의 점수 제출 및 상위 10명 조회
- 로그아웃, 프로필·리더보드 기록 직접 삭제
- RLS와 `SECURITY DEFINER` RPC를 이용한 서버 측 점수 재계산
- 분당 제출 제한과 기본 수치 범위 검사

## 1. Supabase 프로젝트 만들기

1. Supabase에서 새 프로젝트를 만든다.
2. Project Settings의 API 화면에서 다음 값을 확인한다.
   - Project URL
   - publishable/anon public key
3. SQL Editor에서 [`supabase/migrations/0001_leaderboard.sql`](../supabase/migrations/0001_leaderboard.sql)을 전부 실행한다.
4. Table Editor에서 `profiles`, `scores`가 생겼는지 확인한다.

서비스 역할 키(`service_role`)는 브라우저나 Vercel의 `VITE_*` 변수에 절대 넣지 않는다. 이 앱에는 공개용 publishable/anon 키만 필요하며 실제 권한은 RLS와 RPC가 제한한다.

## 2. 로그인 공급자 설정

### 이메일 매직 링크

Supabase Authentication → Providers에서 Email을 활성화한다. Authentication → URL Configuration에는 다음을 등록한다.

- Site URL: `https://ding-melbourne.vercel.app`
- Redirect URLs:
  - `https://ding-melbourne.vercel.app/**`
  - `http://localhost:5173/**`

### Google 로그인

1. Google Auth Platform에서 Web application OAuth client를 만든다.
2. Authorized JavaScript origins에 운영 URL과 로컬 URL을 추가한다.
3. Authorized redirect URIs에는 Supabase Google Provider 화면에 표시되는 callback URL을 정확히 추가한다. 일반적으로 `https://<project-ref>.supabase.co/auth/v1/callback` 형태다.
4. Google Client ID와 Client Secret을 Supabase Authentication → Providers → Google에 저장한다.

앱 코드는 `signInWithOAuth({ provider: 'google' })`의 브라우저 리다이렉트 흐름을 사용한다. 앱의 복귀 URL은 Supabase Redirect URL 허용 목록에 있어야 한다.

## 3. 로컬 연결

`.env.example`을 `.env.local`로 복사하고 공개 값을 입력한다.

```dotenv
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_PUBLISHABLE_OR_ANON_KEY
```

그다음 서버를 다시 시작한다.

```bash
npm run dev
```

설정 화면에 Sign in 영역이 나타나야 한다. 환경변수는 Vite 빌드 시점에 포함되므로 실행 중 파일만 바꿔서는 반영되지 않는다.

## 4. Vercel 운영 연결

Vercel의 `ding-melbourne` 프로젝트 → Settings → Environment Variables에 두 변수를 Production, Preview, Development 환경용으로 추가한다.

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

환경변수 변경은 기존 배포에 소급되지 않으므로 반드시 새 Production Deployment를 만든다. 대시보드에서 Redeploy하거나 `main`에 새 커밋을 push하면 된다.

## 5. 연결 검수

다음 순서 전체가 통과해야 완료다.

1. 로그아웃 상태에서 Sign in 모달을 연다.
2. 잘못된/차단된 요청은 모달 내부 오류 메시지로 표시되고 모달이 닫히지 않는지 확인한다.
3. 이메일 매직 링크로 돌아오거나 Google 로그인을 완료한다.
4. Driver profile에서 2–24자 표시 이름을 저장한다.
5. 한 게임을 끝내고 결과 화면에서 내 기록과 리더보드를 확인한다.
6. 새로고침 후 로그인과 표시 이름이 유지되는지 확인한다.
7. 로그아웃 후 게임이 계속 로컬 모드로 동작하는지 확인한다.
8. 테스트 계정에서 Delete account data를 실행하고 `profiles`와 `scores`의 해당 행이 사라지는지 확인한다.

## 보안 경계와 다음 작업

- 브라우저는 `scores`에 직접 INSERT할 수 없고 `submit_score()`만 호출한다.
- 현재 서버는 점수를 재계산하지만 실제 키 입력을 재생 검증하지는 않는다. 공개 경쟁을 시작하기 전에는 서명된 런 토큰과 입력 이벤트 다이제스트를 추가한다.
- 현재 삭제 기능은 이 앱이 보관한 프로필·점수와 로컬 세션을 지운다. Supabase Auth 사용자 자체를 완전히 제거하려면 service-role을 보관하는 별도 Edge Function과 재인증 절차가 필요하다.
- 운영 전 표시 이름 금칙어·신고·관리자 숨김 기능을 추가한다.

멀티플레이 확장은 [`MULTIPLAYER.md`](MULTIPLAYER.md)에 정리되어 있다.
