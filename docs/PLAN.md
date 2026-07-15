# DING! MELBOURNE — Milestone 1 Implementation Record

PRD §18이 요구하는 "코딩 전 산출물"을 저장소에 고정한 문서. 기준 문서는
`Melbourne_Tram_Typing_Game_AI_PRD.pdf` (v0.1, 15 JUL 2026).

## 1. Assumptions

- **범위는 첫 마일스톤만**: 5-stop Route 96 fixture + deterministic state machine.
  전체 GTFS 파이프라인, 로그인, 리더보드, 실시간 트램은 구현하지 않음 (PRD 검수 기준).
- Fixture의 정류장 5곳은 실제 Route 96 경로 위 지점이지만 **좌표·stop number는 근사치**
  (#132 St Kilda Station만 PRD [S9]로 확인됨). Phase 2 GTFS 파이프라인이 교체 예정.
- 사운드는 자체 Web Audio 합성(외부 음원 없음, PRD §12 originality).
- UI 언어는 영어(한국어 번역은 Phase 4 SHOULD).
- 브랜드는 `src/brand.ts` 상수로 격리 (최종명 미정, PRD §4).
- Driver 난이도도 대소문자는 무시하되 구두점·stop number는 요구 (아래 미해결 결정 참조).

## 2. File tree

```
index.html
package.json / tsconfig.json / vite.config.ts
docs/PLAN.md                      # 이 문서
src/
  main.tsx
  brand.ts                        # 브랜드 상수 (PRD §4)
  app/App.tsx                     # 데이터 검증 → Game 또는 DataErrorScreen (AC-09)
  app/Game.tsx                    # reducer 소유, 타이머/pause/bell/포커스 orchestration
  components/
    ConfigScreen.tsx              # route·direction·start stop·mode·difficulty·sound
    CountdownScreen.tsx           # 3-2-1 (재시작 시 1비트, fast-reset)
    Hud.tsx                       # time/stops/accuracy/WPM/streak + sound/pause/exit
    StopConsole.tsx               # prev/current/next + 글자 단위 피드백 + IME/paste 처리
    ResultScreen.tsx              # 지표 + personal best 비교/저장
    DataErrorScreen.tsx           # 명시적 데이터 오류 UI
  game/
    reducer.ts                    # 상태 머신 (순수 함수, 시각은 액션으로 주입)
    normalize.ts                  # 입력 정규화 (PRD §8)
    scoring.ts                    # accuracy/WPM/score 공식
    selectors.ts                  # elapsed/remaining/파생 지표
  map/
    projection.ts                 # lon/lat → SVG, 호길이 기반 pointAt(progress)
    RouteCanvas.tsx               # 노선 path + 정류장 + 트램 마커 + 이동 애니메이션
  data/
    types.ts                      # RouteData 계약 (PRD §10)
    validate.ts                   # 런타임 검증
    generated/route-96.json       # 5-stop fixture (Phase 2에서 GTFS 산출물로 교체)
  storage/local.ts                # ding.*.v1 keys (PRD §14)
  audio/bell.ts                   # 합성 벨/틱
  styles/global.css               # 토큰·레이아웃·reduced-motion (PRD §12)
tests/
  normalize.test.ts  scoring.test.ts  reducer.test.ts  validate.test.ts
```

## 3. Data contracts

### route JSON (PRD §10 준수)

- `schemaVersion`, `sourceUpdatedAt`, `route{id, shortName, longName, color, directions[]}`,
  `stops{...}`.
- `directions[i].shape`: 해당 방향 주행 순서의 `[lon, lat]` polyline.
- `stops[id].answers.{easy,standard,driver}`: 난이도별 허용 답 배열, `[0]`이 화면 표시 target.
- `position.progress`: **directions[0] 기준** 호길이 비율(0..1). 반대 방향은 `1 - p`
  (`stopProgress()` 헬퍼로만 접근).
- 검증 규칙: 방향 ≥2, 방향당 stop ≥2, stop id 존재, progress 방향별 단조 증가,
  answers 비어있지 않음, 좌표 범위 유효. 실패 시 DataErrorScreen (AC-09).

### localStorage (PRD §14)

| key | 내용 |
|---|---|
| `ding.settings.v1` | `{soundOn, difficulty}` |
| `ding.lastConfig.v1` | 마지막 GameConfig |
| `ding.personalBest.v1` | `pbKey(route:direction:mode:difficulty:startStopIndex)` → `{timeMs, stops, accuracy, wpm, score, at}` |

PB 비교: full-route는 timeMs 최소, sprint는 stops 최대(동률 시 wpm).

## 4. State transition table

| From | Action | Guard | To |
|---|---|---|---|
| config | CONFIGURE | — | config (patch; direction 변경 시 startStopIndex=0) |
| config | START | — | countdown |
| countdown | COUNTDOWN_DONE | — | typing (startedAt=at) |
| countdown | EXIT (Esc) | — | config |
| typing | INPUT | 정답 미완성 | typing (keystroke 집계) |
| typing | INPUT | normalize 일치 | ready |
| ready | INPUT (수정) | 불일치화 | typing |
| ready | DEPART (Enter/Space) | 마지막 stop 아님 | moving (stops+1, streak 갱신, 벨) |
| ready | DEPART | 마지막 stop | finished(completed) (AC-04) |
| moving | MOVE_DONE | — | typing (stopIndex+1, input='') |
| typing/ready/moving | TICK·INPUT·DEPART·MOVE_DONE | sprint 60s 경과 | finished(time-up), 입력 잠금 (AC-05) |
| typing/ready | PAUSE (탭 hidden 포함) | — | paused |
| moving | PAUSE | hop 정산 후 | paused (pausedFrom=typing) |
| paused | RESUME | — | pausedFrom 복귀 (pause 시간 시계 제외) |
| finished/paused | RESTART | — | countdown (quick, 카운터 리셋, config 유지) |
| any | EXIT | — | config |
| any | TOGGLE_SOUND | — | 동일 phase (sound만 토글) |
| typing/ready | INVALID_ACTION (paste) | — | 동일 phase (error+1) |

시각(`at`)은 전부 액션 인자로 주입 → reducer는 순수·결정적, 전 전이 단위 테스트됨.

## 5. Implementation plan (진행 상태)

1. ✅ Phase 0 Foundation: repo, tokens, fixture, reducer + 57 unit tests
2. ✅ Phase 1 Playable slice: config → countdown → typing → bell → move → result, 한 방향 5 stops
3. ⬜ Phase 2 Full Route: `scripts/gtfs/` 전처리 파이프라인(Node), Route 96 전 정류장, 양방향 검증
4. ⬜ Phase 3 Polish: 모바일 visualViewport 대응, 결과 카드 공유 이미지, 사운드 다듬기
5. ⬜ Phase 4 Content: Route 35·1, 한국어 UI, landmark metadata
6. ⬜ Phase 5+ Growth/Realtime: PRD 승인 후

## 6. Unresolved decisions (사용자 결정 필요)

1. **최종 브랜드명** — DING! Melbourne / TRAM TYPE / NEXT STOP 중 선택 (현재 작업명 상수).
2. **리더보드 포함 여부** — MVP는 로컬 PB만.
3. **Driver 난이도 대소문자** — 현재 대소문자 무시·구두점 필수. 완전 엄격 모드로 바꿀지.
4. **글자 피드백 vs 정규화 관용의 간극** — 구두점을 통째로 생략 입력하면 최종 매칭은 통과하나
   위치 기반 글자 피드백은 이후 글자를 오타로 표시. Easy alias로 흡수 중. 허용할지 결정.
5. **재시작 카운트다운** — fast-reset을 위해 1비트(0.5s)로 축소함. 3-2-1 유지 여부.
6. **Sprint에서 노선 소진 시** — 현재 종점 도달하면 completed로 종료. 반대 방향 이어달리기 여부.
