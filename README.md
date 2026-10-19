# Personal Design Portfolio

기존 ATLASON 기반 화면의 3개 패널과 확대·축소 전환을 유지하고, 제공된 Figma 파일의 작업물 5개로 콘텐츠를 교체했습니다. 기존 `portfolio-tokens.css`는 보존했습니다.

현재 분류는 **WebSite: 뚜레쥬르·케이벨로**, **Works: 콤부차·laka·카밀**입니다. 각 카드에서 전체 작업 이미지를 새 탭으로 엽니다.

| 작업 | 경로 | 분류 |
| --- | --- | --- |
| 티젠 콤부차 | `/works/kombucha/` | Promotion |
| laka | `/works/laka/` | Detail Page |
| 카밀 | `/works/kamill/` | Detail Page |
| 뚜레쥬르 | `/works/tous/` | Web Design |
| 케이벨로 | `/works/kvelo/` | Web Design |

이름·연락처·경력·제작 기간·성과 수치는 제공되지 않아 추가하지 않았습니다. 원본 스튜디오의 연락처와 소개도 현재 페이지에서 제거했습니다. 소개에 사용한 모델 사진은 작업물 이미지이며 작성자의 인물 사진이 아닙니다.

## 실행

이 폴더에서 다음 명령을 실행합니다. 별도 패키지 설치는 필요하지 않습니다.

```powershell
python serve.py
```

브라우저에서 **http://127.0.0.1:4173** 을 엽니다. 종료는 터미널에서 `Ctrl+C`입니다. JavaScript 모듈과 페이지 전환을 사용하므로 HTML 파일을 직접 더블클릭하는 방식 대신 로컬 서버를 사용합니다.

Windows에서는 `start-portfolio.cmd`를 더블클릭하면 서버를 실행하고 브라우저를 자동으로 엽니다. 열린 서버 창을 유지해야 사이트가 동작합니다.

## 구성

- `index.html`: 3개 페이지 미리보기와 확대/축소 내비게이션을 포함한 홈.
- `atlason/`, `works/`, `more/`: 소개, 작업 목록·아카이브·프로젝트 상세, 분야별 콘텐츠.
- `portfolio-tokens.css`: 기존 개인 포트폴리오 토큰. 내용은 보존했습니다.
- `portfolio-reference.css`: 원본의 색·폰트·간격과 기존 토큰의 연결, 포커스·모션 감소 스타일.
- `portfolio-content.css`: 교체한 이미지·소개·프로젝트 상세의 스타일.
- `portfolio-projects.json`: 작업물 5개의 제목·분류·소개·원본 Figma 노드.
- `assets/portfolio/`: Figma 디자인 컨텍스트에서 받은 실제 이미지 24개.
- `assets/portfolio/full/`: 프레임 경계에 맞춰 내보낸 5개 전체 작업 이미지.
- `portfolio-viewer.css`, `portfolio-viewer.js`: 전체 이미지 뷰어와 오른쪽 상단 고정 X 닫기 버튼.
- `portfolio-enhancements.js`: 본문 건너뛰기, 페이지 전환 후 포커스, 모션 감소 시 일반 페이지 이동·영상 정지.
- `assets/`, `dist/`, `favicon/`: 다운로드한 로컬 리소스.
- `reference-manifest.json`: 다운로드 출처·페이지·리소스·실패 기록.
- `scripts/reference-templates/`: 콘텐츠 교체 전 HTML 템플릿 백업.
- `scripts/apply-portfolio.py`: 백업 템플릿과 작업 정보를 바탕으로 포트폴리오 HTML을 재생성. 직접 수정한 HTML은 덮어써집니다.
- `scripts/clone-reference.py`: 이전 원본 복제 스크립트. 다시 실행하면 개인 콘텐츠가 원본으로 돌아가므로 현재 사이트 수정에는 사용하지 마세요.

프로젝트 카드는 새 탭에서 전체 길이 작업 이미지를 엽니다. 이미지의 비율은 유지되며 세로 스크롤로 끝까지 볼 수 있습니다. 오른쪽 상단 X 버튼 또는 Esc로 탭을 닫습니다. 브라우저가 탭 닫기를 제한하는 직접 접속에서는 작업 목록으로 돌아갑니다. 이전 복제 작업의 미사용 페이지와 리소스는 보존했으나 현재 내비게이션에는 연결하지 않았습니다. 분석 추적 코드는 제외했으며 서비스 워커는 등록하지 않습니다. 온라인 게시나 배포는 수행하지 않았습니다.

## 검증 자료

`qa/`에는 Chrome으로 캡처한 1440px 데스크톱·390px 모바일 화면과 `browser-results.json` 점검 결과를 저장했습니다. 작업물 5개 상세의 이미지 로딩·가로 넘침, 메뉴 이동·뒤로가기·모션 감소 탐색을 검사했습니다. VS Code HTML 검사기로 `index.html`의 오류·경고 0개를 확인했습니다. 전체 스크린리더 검수는 수행하지 않았습니다.
