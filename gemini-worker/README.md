# TRUSS LAB Gemini 연결

게임은 `BridgeV7/`, AI 서버는 이 폴더에서 각각 실행합니다. 게임의 AI 도우미는 Gemini 전용이며, 질문 전송과 연결 확인 시에만 서버에 요청합니다. API 키는 게임 파일에 넣지 않습니다.

## 1. 준비

- Node.js 22 이상, npm, Python(게임용 로컬 서버), Google AI Studio API 키가 필요합니다.
- [AI Studio](https://aistudio.google.com/apikey)에서 키를 발급합니다. 모델 접근 권한과 요금·할당량은 본인 계정에서 확인하세요.
- 기본 모델은 `wrangler.toml`의 `GEMINI_MODEL`입니다. 사용할 수 있는 모델로 이 값만 변경할 수 있습니다.
- Gemini Skill은 개발 도구에 제공하는 개발 지침입니다. 게임 실행에는 필요하지 않습니다. 설치하려면 프로젝트 루트의 터미널에서 다음을 실행합니다. 이 프로젝트가 Skill을 자동 설치하지는 않습니다.

```powershell
npx skills add google-gemini/gemini-skills --skill gemini-api-dev
```

## 2. 로컬 Gemini Worker 실행

PowerShell에서 실행합니다.

```powershell
Set-Location 'C:\Users\이준서\Downloads\BridgeV5_separated\gemini-worker'
npm ci
Copy-Item -LiteralPath '.dev.vars.example' -Destination '.dev.vars'
notepad .dev.vars
```

메모장에서 `YOUR_GEMINI_API_KEY`를 본인의 실제 키로 교체하고 저장하세요. `.dev.vars`는 Git에서 제외됩니다. 이미 이 파일이 있다면 복사 명령은 생략하세요.

```powershell
npm test
npm run check
npm run dev
```

마지막 명령을 실행한 터미널은 열어 둡니다. 서버 주소는 `http://127.0.0.1:8787`입니다. 처음 실행 시 Cloudflare 도구 다운로드가 필요할 수 있습니다. 로컬 개발에는 Cloudflare 로그인과 배포가 필요하지 않습니다.

## 3. 게임 실행

다른 PowerShell 창에서 실행합니다. Worker 폴더와 키 파일이 웹에 노출되지 않도록 **게임 폴더만** 제공합니다.

```powershell
Set-Location 'C:\Users\이준서\Downloads\BridgeV5_separated'
python -m http.server 8765 --bind 127.0.0.1 --directory BridgeV7
```

1. 브라우저에서 `http://127.0.0.1:8765`를 엽니다. 게임의 지원 조건인 화면 폭 1100px 이상을 사용하세요.
2. 게임에 들어가 **AI 도움**을 엽니다.
3. Worker 주소에 `http://127.0.0.1:8787`을 입력합니다.
4. **연결 확인**을 누른 뒤 질문을 전송합니다.

VS Code Live Server의 `http://127.0.0.1:5500/BridgeV7/index.html`로 게임을 실행해도 됩니다. 기본 허용 목록에는 5500·8765 포트의 localhost와 127.0.0.1이 포함되어 있습니다. 다른 포트를 쓴다면 `wrangler.toml`의 `ALLOWED_ORIGINS`에 해당 origin을 추가하세요. Worker 주소는 게임 주소와 별개인 `http://127.0.0.1:8787`입니다.

`npm run dev` 터미널에 `Ready on http://127.0.0.1:8787`이 표시되고 프로세스가 계속 실행 중이어야 합니다. 바로 명령 입력 상태로 돌아오면 서버가 종료된 것입니다. 이때 `npm ci`로 의존성을 복구한 뒤 다시 실행하고, 표시되는 오류를 확인하세요. 런처를 거치지 않고 진단하려면 아래 명령을 사용할 수 있습니다.

```powershell
node .\node_modules\wrangler\wrangler-dist\cli.js dev --ip 127.0.0.1 --port 8787
```

연결 확인은 Worker의 설정 유무만 검사합니다. API 키가 유효한지, 계정 할당량이 남았는지는 실제 질문으로 확인합니다. 현재 교량 상태와 최근 대화 최대 10개가 Google에 전송됩니다. 응답은 일반 텍스트로 표시합니다.

UI 없이 설정 상태를 확인할 수도 있습니다. Origin 헤더가 없으면 요청이 거절됩니다.

```powershell
Invoke-RestMethod -Uri 'http://127.0.0.1:8787/health' -Headers @{ Origin = 'http://127.0.0.1:8765' }
```

실제 Gemini 호출 테스트입니다. 이 명령은 API 사용량을 소비할 수 있습니다.

```powershell
$chatBody = @{
    message = '해석 데이터가 없을 때 무엇부터 확인하면 좋을까요?'
    context = 'analysis_status=no_analysis_data'
    history = @()
} | ConvertTo-Json -Depth 5

Invoke-RestMethod -Uri 'http://127.0.0.1:8787/chat' -Method Post -Headers @{ Origin = 'http://127.0.0.1:8765' } -ContentType 'application/json; charset=utf-8' -Body ([System.Text.Encoding]::UTF8.GetBytes($chatBody))
```

## 4. Cloudflare 배포

`wrangler.toml`의 `ALLOWED_ORIGINS`에 실제 게임 origin을 추가합니다. 경로는 포함하지 않습니다. 예를 들어 GitHub Pages가 `https://ACCOUNT.github.io/REPO/BridgeV7/`라면 origin은 `https://ACCOUNT.github.io`입니다. 여기에 적힌 ACCOUNT는 예시이므로 실제 계정으로 교체하세요.

```toml
ALLOWED_ORIGINS = "http://127.0.0.1:8765,http://localhost:8765,http://127.0.0.1:5500,http://localhost:5500,https://ACCOUNT.github.io"
```

Worker 폴더에서 순서대로 실행합니다.

```powershell
npx wrangler login
npm run check
npm run deploy
npx wrangler secret put GEMINI_API_KEY
```

마지막 명령의 입력창에 API 키를 붙여 넣습니다. 명령행 인수나 게임 파일에 키를 적지 마세요. `.dev.vars`의 키는 배포 환경에 자동 등록되지 않습니다. 첫 배포 직후 Secret 등록 전까지 `/health`는 503을 반환합니다. Secret 명령은 배포된 Worker를 업데이트합니다.

배포 출력의 `https://truss-lab-gemini.<본인 서브도메인>.workers.dev` 주소를 게임에 입력하고 다시 연결을 확인합니다. 이후 코드나 모델·origin 설정을 변경했을 때는 `npm run deploy`를 다시 실행합니다.

## 요청 처리와 제한

- `GET /health`: 준비 상태와 모델 이름, `upstreamChecked: false` 반환. Gemini를 호출하지 않습니다.
- `POST /chat`: `{message, context, history}`를 받아 `{answer, model}` 반환.
- `OPTIONS`: 브라우저의 교차 출처 요청 사전 확인 처리.
- 질문 2,000자, 교량 상태 12,000자, 대화 기록 10개·각 4,000자, 전체 본문 64KiB 제한.
- Gemini 응답 제한 1,600 토큰. 서버는 25초, 브라우저는 35초 후 요청을 중단합니다. 자동 재시도로 중복 과금하지 않습니다.
- Cloudflare 네이티브 제한으로 IP별 분당 약 10회 허용. 같은 네트워크의 사용자는 한도를 공유하며, 지역별 근사 제한이므로 전역 사용량·비용의 엄격한 상한은 아닙니다. 같은 Cloudflare 계정의 다른 Worker가 namespace `1001`을 사용 중이면 고유 번호로 변경하세요.
- origin 허용 목록은 사용자 인증이 아닙니다. 공개 서비스에서 접근 제어가 필요하면 Cloudflare Access나 인증·Turnstile 검증을 별도로 붙이세요. 현재 기틀에는 사용자 인증과 웹 검색 기능이 없습니다.
- 서버에서 Gemini API 키와 모델을 정합니다. 브라우저가 보낸 시스템 지침은 사용하지 않고, 교량 코치 지침을 서버에서 적용합니다.
- 요청 본문, 질문, API 키를 서버 로그에 기록하지 않습니다.

## 오류 확인

| 상태 | 확인할 항목 |
|---|---|
| 403 | 게임 주소와 `ALLOWED_ORIGINS`가 정확히 일치하는지 확인. localhost와 127.0.0.1은 다른 origin입니다. |
| 400 / 413 | 질문·대화 기록 길이와 JSON 형식 확인. 대화 지우기 후 재시도. |
| 429 | Worker 호출 횟수 또는 Gemini 계정의 할당량 초과. 잠시 후 재시도. |
| 503 | API 키·모델·rate limiter 설정 누락 확인. 예시 키로는 실행되지 않습니다. |
| 502 | 실제 키의 유효성, 모델 지원 여부, Google API 사용 권한, Gemini 응답 상태 확인. |
| 504 | Gemini 응답 시간 초과. 질문을 줄여 재시도. |
| 브라우저 연결 실패 | Worker 실행 여부, URL, HTTPS, origin 설정 확인. |

## 검증 범위

`npm test`는 외부 Gemini 요청을 대체해 API 형식·대화 변환·본문 제한·키 비노출·오류 처리를 확인합니다. 실제 키의 유효성과 실제 모델 응답 품질은 검증하지 않습니다.

공식 문서: [Gemini REST API](https://ai.google.dev/api/generate-content), [모델 목록](https://ai.google.dev/gemini-api/docs/models), [Gemini Skills](https://github.com/google-gemini/gemini-skills), [Worker Secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Rate limit binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/).
