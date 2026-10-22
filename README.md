# BuildingBridgeGame
A game for building bridge with truss structure.

현재 게임 파일은 `BridgeV7/`에 있습니다.

메인 화면의 **변경 기록**은 `BridgeV7/changelog.json`에서 편집합니다. `type`이 `major`이면 `major`만, `minor`이면 `major`와 `minor`, `patch`이면 세 버전 키를 모두 입력하세요. 각 기록에는 `description`과 `changes` 문자열 배열을 넣습니다. 날짜가 필요하면 `date: "2026-10-23"`을 추가할 수 있습니다. 같은 상위 버전끼리 묶고 각 그룹은 JSON에 처음 등장한 순서로 표시하며, 기록 창을 다시 열면 파일을 새로 읽습니다. 시작 화면에 표시하는 버전은 `project-settings.json`의 `display_version`에서 별도로 관리합니다.

Gemini 온라인 AI의 실행·키 설정·배포 명령어는 [gemini-worker/README.md](gemini-worker/README.md)를 참고하세요. AI 서버는 게임 폴더와 분리되어 있으며, 게임의 AI 도우미는 Gemini 전용입니다.

방문자가 AI 서버 주소를 직접 입력하지 않게 하려면 `BridgeV7/project-settings.json`의 `geminiWorkerUrl`에 배포한 Worker의 HTTPS 주소를 입력하세요. API 키를 넣는 칸이 아닙니다. 브라우저에 저장한 개인 서버 주소는 유지됩니다. 빈 문자열이면 사용자가 서버 주소를 입력해야 합니다. 파일을 수정한 뒤에는 게임만 다시 게시하면 되며 Worker를 재배포할 필요는 없습니다.

개발 중인 변경 기록은 `"TBU": true`를 추가합니다. 메이저·마이너·패치 모두 지원하며 해당 버전의 설명과 변경 목록 대신 준비 중 카드를 표시합니다. 이때 `description`과 `changes`는 생략할 수 있습니다. `false`로 바꾸거나 TBU를 생략하면 기존 내역을 표시하며, 상위 버전이 개발 중이어도 하위 기록은 그대로 유지됩니다.
