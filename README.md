# 웹서비스설계 과제 2 · 신청 승인 서비스

## 서비스 소개

신청 승인 서비스는 학생이 행사 참가를 신청하고, 담당 운영자가 신청을 승인하거나 승인 취소할 수 있는 웹서비스이다. 신청·대기 취소·직접 승인·승인 취소·대기열 자동 승급·변경 이력 기능을 구현했다.

## 구현 완료 여부

| 항목 | 결과 |
| --- | --- |
| 신청 | 완료 |
| 대기 취소 | 완료 |
| 담당 운영자 승인 | 완료 |
| 승인 취소 | 완료 |
| FIFO 자동 승급 | 완료 |
| 변경 이력 저장 | 완료 |
| 트랜잭션 및 전체 롤백 | 완료 |
| T01~T32 필수 테스트 | 전체 통과 |
| 기본 테스트 | 4/4 통과 |
| U01~U05 화면 검증 | 완료 |

## 실행 환경

- Windows PowerShell
- Node.js 24.22.3 · npm
- Express 5.3.0
- SQLite (`node:sqlite`)
- JWT (`jsonwebtoken`)

`starter`를 프로젝트 루트로 사용한다. 해당 폴더에서 다음 명령을 실행한다.

```powershell
npm.cmd ci
npm.cmd test
npm.cmd run test:assignment
npm.cmd start
```

기본 접속 주소는 [http://127.0.0.1:3000](http://127.0.0.1:3000)이다. 서버는 `Ctrl+C`로 종료한다. 포트가 사용 중이면 기존 서버를 종료하거나 PowerShell에서 `$env:PORT = '3001'`로 다른 포트를 지정한 뒤 서버를 시작한다.

### 연습 계정

| 아이디 | 이름 | 역할 |
| --- | --- | --- |
| `alice` | 민지 | 학생 |
| `bob` | 준호 | 학생 |
| `charlie` | 서연 | 학생 |
| `manager1` | 운영자 A | 행사 1 담당, 정원 2명 |
| `manager2` | 운영자 B | 행사 2 담당, 정원 1명 |

로그인 화면의 계정 버튼으로 가상 계정의 입력값을 채울 수 있다. 역할별로 브라우저 탭을 나누어 화면을 확인할 수 있다.

### DB 초기화와 재실행

서버를 종료한 뒤 `npm.cmd run db:reset`을 실행하고 `RESET`을 입력하면 신청과 변경 이력이 초기화되고 가상 계정과 행사가 다시 생성된다. 이전 배포본 DB를 사용했다면 이 초기화 절차를 거친 뒤 새 코드를 실행한다. 상태와 이력의 영속성을 확인할 때는 DB를 초기화하지 않고 서버를 종료·재실행한 뒤 다시 로그인한다.

## 변경 파일

| 위치 | 구현 및 기록 내용 |
| --- | --- |
| [src/application-service.js](src/application-service.js) | `apply`, `cancel`, `approve`, `revoke` 업무 규칙을 구현했다. 로그인 사용자 권한, 신청 상태, 정원, 중복, 승인 취소 사유를 검사하고, 상태 변경과 이력 저장을 한 트랜잭션으로 처리한다. 오류 시 전체를 롤백한다. |
| [src/repository.js](src/repository.js) | 같은 행사의 `PENDING` 신청을 `created_at ASC, id ASC` 순서로 조회해 첫 한 건을 반환하는 `firstPending`을 추가했다. |
| [docs/evidence/](docs/evidence/) | 필수 자동 테스트와 U01~U05 화면 검증에 사용한 실제 캡처를 기록했다. |

제공 코드의 로그인·JWT 인증, DB 스키마와 초기 데이터, API 라우팅과 입력 형식 검사, 조회 권한, 기본 화면과 기존 SQL 조회·저장 함수를 사용했다. 과제에서 구현한 부분은 네 변경 함수의 업무 규칙과 트랜잭션, FIFO 조회다. `tests/`의 테스트 파일과 기대값은 수정하지 않았다.

## 검증 결과

| 검증 | 결과 |
| --- | --- |
| `npm.cmd test` | 기본 테스트 4개 중 4개 통과 |
| `npm.cmd run test:assignment` | T01~T32 전체 통과 |
| 실패 테스트 | 0개 |
| U01~U05 화면 검증 | 완료 |

T28~T30의 `TEST_INJECTED_FAILURE`는 임시 DB에 이력 저장 오류를 의도적으로 주입했을 때 출력되는 로그다. 세 테스트는 HTTP 500과 요청 전후 신청 상태 및 변경 이력의 일치를 확인해 전체 롤백을 검증했다. [자동 테스트 결과 캡처](docs/evidence/01-test-results-T01-T32.png)

| 화면 검증 | 결과 및 증거 |
| --- | --- |
| U01 | 민지의 행사 1 대기 신청과 운영자 A의 승인을 확인했다. 승인 후 학생 탭을 다시 조회한 장면은 캡처에 없다. [대기 신청](docs/evidence/02-U01-alice-pending.png) · [운영자 승인](docs/evidence/03-U01-manager-approve.png) |
| U02 | 민지가 행사 2 대기 신청을 취소했고, 오래된 운영자 화면의 승인 요청은 `409 INVALID_STATE`로 거부됐다. [취소 전](docs/evidence/04-U02-before-cancel.png) · [취소 및 이력](docs/evidence/05-U02-student-cancelled.png) · [승인 거부](docs/evidence/06-U02-old-manager-rejected.png) |
| U03 | 서버 재실행 후 재로그인했을 때 취소 상태와 변경 이력이 유지됐다. [재실행 후 상태 및 이력](docs/evidence/07-U03-restart-persistence.png) |
| U04 | 민지 승인 취소 후 준호가 자동 승인됐고 서연은 대기 상태를 유지했다. `AUTO_APPROVE` 이력이 원인 `REVOKE` 이력 ID를 참조했다. [대기 순서](docs/evidence/08-U04-three-pending.png) · [민지 승인](docs/evidence/09-U04-alice-approved.png) · [자동 승급](docs/evidence/10-U04-auto-promotion-result.png) · [이력 연결](docs/evidence/11-U04-auto-approve-history.png) |
| U05 | 대기자가 없는 승인 취소 후 `REVOKED`, 승인 0명을 확인했다. 응답의 `promoted=null`은 T17에서 검증했다. [최종 상태](docs/evidence/12-U05-final.png) |

## 알려진 문제와 한계

- 로컬 환경에서 검증했다. 공개 서버 배포는 수행하지 않았다.
- 선택 심화 동시성 테스트는 이번 필수 검증 결과에 포함하지 않았다.
- 브라우저 탭 간 변경 사항은 자동 반영되지 않는다. 상태와 이력을 확인하려면 화면에서 ‘최신 정보 새로고침’을 사용한다.

## AI 활용

- AI 사용 도구는 ChatGPT Codex이다.
- 적용한 소스는 `src/application-service.js`와 `src/repository.js`이다.
- 업무 규칙 분석, 신청·대기 취소·승인·승인 취소 구현, FIFO 자동 승급과 트랜잭션 처리 검토, 테스트 실행과 오류 분석에 활용했다.
- 작성자는 Windows 환경 설정, npm 설치, 테스트와 서버 실행, U01~U05 화면 검증, 증거 캡처 및 최종 결과 확인을 직접 수행했다.
- 참고 자료는 [과제 안내문](../01_과제2_안내문.pdf), [API 계약](docs/API.md), [제공 테스트](tests/assignment.test.js), [Node.js SQLite 공식 문서](https://nodejs.org/docs/latest-v24.x/api/sqlite.html), [Express 공식 문서](https://expressjs.com/en/5x/api/)이다.

## 제출 정보

- **GitHub URL과 보고서 기준 커밋 SHA**
  - GitHub URL [sehwa-song/web-service-assignment-2](https://github.com/sehwa-song/web-service-assignment-2)
  - 보고서 기준 커밋 SHA `efd40932cab285de79b55da17a8637a97af46b97`
- 보고서 [docs/report.pdf](docs/report.pdf)
- 편집용 보고서 [docs/report-working.docx](docs/report-working.docx)
- 검증 증거 [docs/evidence/](docs/evidence/)

GitHub URL과 최종 커밋 SHA는 LMS 온라인 작성란에 기입한다. 보고서 PDF는 저장소와 LMS에 같은 버전으로 제출한다.

## 제외 파일

다음 파일이나 데이터는 제출 대상에서 제외한다.

- `node_modules/`
- `data/app.sqlite`
- `data/jwt-secret.txt`
- 실제 `.env` 파일
- JWT 토큰
- 개인 정보가 포함된 별도 파일
