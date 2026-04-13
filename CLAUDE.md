# KOSPI & KOSDAQ 미남종목 탐색기 - 프로젝트 문서

**최종 수정일**: 2026-04-13  
**상태**: 배포 완료 (Netlify + Railway)

---

## 프로젝트 개요

한국 증시(KOSPI, KOSDAQ)에서 **10가지 깐깐한 투자 기준**으로 우량 종목을 선정하는 웹 애플리케이션. 
사용자가 종목을 검색하고 5년치 재무 데이터를 분석해 "미남종목(좋은 주식)"을 직접 발굴할 수 있습니다.

---

## 프로젝트 구조

```
bluechip-stock/
├── index.html              # 메인 HTML (모달, 슬라이딩 패널 포함)
├── main.js                 # 핵심 로직 (API 호출, 렌더링, 상태관리)
├── style.css               # 다크 테마 + 반응형 스타일
├── server.py               # Flask 백엔드 (yfinance 데이터 조회)
├── requirements.txt        # Python 의존성
├── runtime.txt             # Python 3.11.10 지정
├── Procfile                # Railway 앱 시작 명령
└── CLAUDE.md               # 프로젝트 문서 (이 파일)

라이브 URL:
- Frontend: https://minam-stock.netlify.app (Netlify)
- Backend: https://bluechip-stock-production.up.railway.app (Railway)
```

---

## 완료된 작업 순서 (2026-03-XX ~ 2026-04-13)

### Phase 1: 핵심 기능 구현
| 날짜 | 작업 | 커밋 |
|------|------|------|
| 초기 | UI/CSS 다크 테마 설정 | - |
| 초기 | Flask 백엔드 + yfinance 통합 | - |
| - | 한글 종목명 검색 기능 (자동완성) | - |

### Phase 2: KOSDAQ 검색 버그 수정
| 날짜 | 작업 | 근본원인 | 해결책 |
|------|------|---------|--------|
| 03-XX | KOSDAQ 한글검색 실패 | pykrx의 KRX API 403 차단 | FinanceDataReader로 교체 |
| - | 변경사항 | `requirements.txt` + `server.py` | `finance-datareader` 설치, `load_stock_map()` 재작성 |

**결과**: KOSPI 950개 + KOSDAQ 1,823개 종목 정상 로드

### Phase 3: 배포 환경 구축
| 작업 | 도구 | 설정 내용 |
|------|------|---------|
| Frontend 배포 | Netlify | Git → Vite 빌드 → dist/ 배포 |
| Backend 배포 | Railway | GitHub → Docker 빌드 → 자동 재배포 |
| Python 버전 | Railway | `runtime.txt: 3.11.10` (pandas 호환성) |
| 앱 시작 | Railway | `Procfile: web: python server.py` |
| 바인딩 | Flask | `app.run(host='0.0.0.0', port=PORT)` |
| 헬스체크 | Flask | `/api/health` 엔드포인트 추가 |

**문제 해결**:
- pandas 0.14 wheel 빌드 실패 → 0.2.0으로 업그레이드
- Flask 127.0.0.1만 듣는 문제 → `host='0.0.0.0'` 추가
- Railway 앱 수면 → yfinance 버전 최신화 + `/api/health` 엔드포인트 추가

### Phase 4: UI 개선
| 작업 | 변경 내용 |
|------|---------|
| 타이틀 | '📉 KOSPI 우량주식 탐색기' → '**KOSPI & KOSDAQ**<br/>**미남종목**' |
| 입력란 | X 버튼 추가 (입력값 일괄 삭제) |
| 버튼 텍스트 | '분석 시작하기' → '분석시작', '저장된 미남종목 리스트' → '💎미남종목' |
| 기준 섹션 | 제목: '✅미남종목 선정기준', 내용 간결화 |

### Phase 5: 관심종목 기능
| 작업 | 구현 |
|------|-----|
| 체크박스 | 각 카드 종목명 앞 추가 |
| localStorage | `watchlist` key로 저장 |
| 카드 스타일 | 체크 시 노란 테두리 (`.is-watchlist`) |
| 버튼 | '⭐관심종목' 버튼 추가 (미남종목 버튼과 동일 크기) |
| 재분석 | '⭐관심종목' 클릭 → 저장된 종목만 재분석 |

### Phase 6: 모달 + 슬라이딩 패널
| 작업 | 기능 |
|------|-----|
| 선정기준 모달 | criteria-panel 제거 → 링크 버튼 클릭 → 정중앙 모달 표시 |
| 슬라이딩 패널 | WATCHLIST/HANDSOME 모드에서 리스트만 표시 → 클릭 시 우측 패널에서 full 카드 |
| 데이터 캐시 | `stockDataCache` 전역으로 종목별 데이터 저장 |
| 리팩토링 | `buildCardHTML()` 분리로 모달/패널에서 재사용 |

---

## 주요 API 엔드포인트

### 백엔드 (server.py)

| 엔드포인트 | 메서드 | 설명 |
|----------|--------|-----|
| `/api/health` | GET | Railway 수면 방지용 헬스체크 |
| `/api/search?q=` | GET | 한글명/종목코드 자동완성 검색 |
| `/api/stock?symbol=` | GET | 종목 5년 재무 데이터 조회 (yfinance) |

### 프론트엔드 (main.js)

**주요 함수**:
- `runAnalysis(mode)` — 종목 분석 ('ALL', 'WATCHLIST', 'HANDSOME')
- `render5YearCard()` — 분석 결과 전체 카드 렌더링
- `renderListItem()` — 리스트용 종목 항목 (패널용)
- `openCriteriaModal()` / `closeCriteriaModal()` — 기준 모달
- `openSlidePanel()` / `closeSlidePanel()` — 슬라이딩 패널
- `toggleWatchlist()` — 관심종목 추가/삭제
- `toggleHandsome()` — 미남종목 추가/삭제

**저장소**:
- `localStorage.watchlist` — 관심종목 리스트 (JSON)
- `localStorage.handsome_list` — 미남종목 리스트 (JSON)
- `stockDataCache` — 패널용 종목 데이터 (메모리)

---

## 데이터 분석 결과 항목

### 현재 표시 중인 지표

| 지표 | 출처 | 기준값 |
|------|------|--------|
| **PER** | yfinance (trailingPE) | ≤ 20 (Pass) |
| **배당수익률** | yfinance (dividendYield) | 2~5% (Pass) |
| **당기순이익** | Balance Sheet | > 0 (Pass) |
| **부채비율** | 총부채/총자본 | ≤ 100% (Pass) |
| **유보비율** | 이익잉여금/자본금 | ≥ 500% (Pass) |
| **매출성장율** | (당기매출 - 전년매출) / 전년매출 | ≥ 5% (Pass) |
| **영업이익율** | 영업이익/총매출 | ≥ 10% (Pass) |
| **ROE** | 당기순이익/총자본 | ≥ 15% (Pass) |

### 향후 추가 가능 지표

- **EPS (주당순이익)** — 각 종목 수익성 비교
- **PBR (주가순자산비율)** — 저평가 종목 발굴
- **부채상환능력 (Flow Ratio)** — 단기 유동성 분석
- **EBITDA** — 영업 현금흐름 건강도
- **배당금 성장률** — 배당 안정성
- **PEG Ratio** — 성장률 대비 밸류에이션
- **최대주주 지분율** — 지배구조 (현재 데이터 미지원)

---

## Workflow (개발 → 배포)

### 1. 로컬 개발
```bash
# 가상환경 활성화
source venv/bin/activate

# 백엔드 서버 실행 (포트 8001)
python server.py

# 프론트엔드 개발 서버 (Vite, 포트 5173)
npm run dev

# 브라우저: http://localhost:5173
```

### 2. 코드 수정 후 배포
```bash
# 변경사항 커밋
git add .
git commit -m "feat/fix: 설명"

# GitHub에 push (자동 배포 시작)
git push origin main

# 배포 상태 확인
# - Netlify: https://app.netlify.com → Deployments 탭
# - Railway: https://railway.app → Deployments 탭
# (약 2~3분 소요)
```

### 3. 배포 후 테스트
```bash
# 모바일 테스트
# 1. Netlify URL 복사: https://minam-stock.netlify.app
# 2. 모바일 브라우저에서 접속
# 3. 종목 검색 → 분석 → 관심종목 저장 → 패널 열기 등 테스트

# Railway 헬스체크
# https://bluechip-stock-production.up.railway.app/api/health
# → {"status":"ok"} 표시 확인
```

---

## 보완/추가 가능 기능 및 디자인

### 우선순위: HIGH

#### 1. 필터링 & 정렬 기능
**설명**: 분석 결과를 특정 기준으로 정렬/필터링

```
예시:
- PER 낮은 순 정렬
- 배당수익률 높은 순 정렬
- 영업이익율 ≥ 15% 필터
- ROE ≥ 20% 필터
```

**구현 방식**:
- `resultsGrid`의 카드들을 동적 정렬
- 필터 버튼 UI 추가 (차트 아이콘)
- `Array.sort()` + `Array.filter()` 활용

**파일**: `main.js` + `index.html`

---

#### 2. 비교 기능 (Comparison)
**설명**: 선택한 여러 종목을 테이블로 나란히 비교

```
UI:
- 각 카드에 "비교에 추가" 체크박스
- "비교 결과 보기" 버튼
- 비교 패널: 여러 종목의 PER, ROE, 배당율 등을 가로로 나열
```

**파일**: `main.js` + `style.css` + `index.html`

---

### 우선순위: MEDIUM

#### 3. 차트/그래프
**설명**: 5년 추이를 시각화 (Chart.js 또는 Recharts)

```
예시:
- 당기순이익 추이 (막대 그래프)
- ROE 추이 (꺾은선 그래프)
- 부채비율 추이 (면적 그래프)
```

**라이브러리**: Chart.js (경량)  
**파일**: `main.js` + `style.css` + `index.html`

---

#### 4. 즐겨찾기 / 관심도 레벨
**설명**: 관심종목을 "관심", "주목", "매수 추천" 등 3단계로 분류

```
현재: watchlist (O/X만 가능)
개선: 관심도 레벨 (1/2/3 또는 별점)
```

**파일**: `main.js` + `style.css`

---

#### 5. 종목 뉴스 / 공시 연동
**설명**: 각 종목의 최근 뉴스 또는 공시 정보 표시

**API**:
- Naver Finance API
- 한국거래소(KRX) 공시 API
- NewsAPI

**파일**: `server.py` (새 엔드포인트) + `main.js` (렌더링)

---

### 우선순위: LOW

#### 6. 포트폴리오 구성 시뮬레이션
**설명**: 선택 종목들로 포트폴리오를 만들고 백테스트

```
입력: 각 종목별 투자 비율
출력: 포트폴리오 수익률, 변동성, 샤프지수
```

**파일**: `server.py` (계산) + `main.js` (UI)

---

#### 7. 다크/라이트 모드 토글
**설명**: 현재 다크 모드 고정 → 라이트 모드 옵션 추가

**파일**: `style.css` (변수화) + `main.js` (토글 로직)

---

#### 8. 알림 / 조건부 매매
**설명**: 특정 조건(PER ≤ 15) 충족 시 알림

**구현**: localStorage + 정기 체크 (또는 서버 배치작업)  
**파일**: `main.js` + `server.py`

---

#### 9. 글로벌 확장 (해외 주식)
**설명**: KOSPI/KOSDAQ 외 미국, 일본, 홍콩 등도 분석

**라이브러리**: yfinance (이미 지원)  
**파일**: `server.py` (엔드포인트) + `index.html` (탭)

---

## 디자인 개선

### 현재 상태
- ✅ 다크 테마 + 네온 accent (#00e5ff)
- ✅ 모바일 반응형 (CSS Grid → Flex)
- ✅ 모달 + 슬라이딩 패널
- ✅ Pass/Fail 녹색/빨강 하이라이트

### 추천 개선

#### 1. 애니메이션 강화
```css
/* 카드 등장 애니메이션 */
@keyframes slideUp { ... }

/* 슬라이딩 패널 등장 (현재 있음, 더 부드럽게) */
transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
```

**파일**: `style.css`

---

#### 2. 로딩 상태 UI 개선
**현재**: "종목명 데이터 로드 중..." (텍스트만)

**개선안**:
- 스켈레톤 로더 (카드 모양 placeholder)
- 진행률 표시 (2/5 등)
- 로딩 스피너 애니메이션

**파일**: `main.js` + `style.css` + `index.html`

---

#### 3. 모바일 최적화
**현재 이슈**:
- 테이블이 넓어서 가로스크롤 필요
- 슬라이딩 패널 너비 92% (여전히 넓을 수 있음)

**개선안**:
- 모바일에서 테이블 → 카드형 레이아웃
- 슬라이딩 패널 전체 너비 사용
- 폰트 크기 적응형

**파일**: `style.css` (@media query)

---

#### 4. 색상 확장
**현재**: 
- Accent: #00e5ff (청록)
- Pass: #00e676 (초록)
- Fail: #ff5252 (빨강)

**추가**:
- 경고: #ffd600 (노랑) — 이미 관심종목용
- 정보: #4fc3f7 (하늘)
- 중립: #9ba1b0 (회색) — 이미 text-muted

---

## 성능 최적화

### 현재 병목
1. **yfinance 응답 시간** — 종목당 5~15초
   - 해결: 병렬 요청 (Promise.all) 고려
   
2. **데이터 캐싱** — 현재 메모리만 (새로고침 시 초기화)
   - 해결: IndexedDB 또는 Service Worker 고려

3. **번들 크기** — Vite 최적화 필요
   - 확인: `npm run build` → 크기 체크

### 개선 계획

```js
// Promise.all로 병렬 요청
const results = await Promise.all(symbols.map(s => fetchAPI(s)));

// IndexedDB 캐싱 (선택)
if (isCached(symbol)) return cache.get(symbol);
```

**파일**: `main.js`

---

## 알려진 제약사항

1. **yfinance 데이터 지원 불안정**
   - 일부 소형주는 데이터 없음 (FALLBACK_MAP에만 존재)
   - 해결: 사용자 피드백 + 수동 추가

2. **최대주주 지분율 미지원**
   - yfinance에서 제공 안 함
   - 해결: 별도 크롤링 (BeautifulSoup) 또는 API

3. **실시간 가격 미지원**
   - yfinance는 지연된 데이터 (1일~)
   - 용도: 장기 투자자 중심 (단기 트레이더 부적합)

4. **Railway Hobby Plan 수면**
   - 30분 미사용 시 자동 절전 (응답 지연)
   - 해결: UptimeRobot 핑 (무료) 또는 Paid Plan

---

## 환경 변수 (필요시)

### Railway (필수 없음 - 자동)
```
PORT=XXXX (자동 할당)
```

### Netlify (필수 없음)
```
VITE_API_URL=https://bluechip-stock-production.up.railway.app (선택)
```

---

## 개발 참고사항

### 코드 스타일
- ES6+ (화살표 함수, const/let 선호)
- 함수형 프로그래밍 (map, filter, reduce)
- localStorage JSON (직렬화 필수)

### 브라우저 호환성
- Chrome/Safari/Firefox (최신 2개 버전)
- 모바일: iOS Safari 13+, Android Chrome 최신
- IE 미지원 (CSS Grid, fetch API)

### 테스트
- 수동 테스트 (UI 상호작용)
- 자동 테스트 미구현 (향후 추가 권장: Jest, Cypress)

---

## 향후 업데이트 시 유의사항

이 파일은 각 기능 추가/변경 시 **자동 업데이트**되어야 합니다.

**체크리스트**:
- [ ] 새 엔드포인트 추가 → "주요 API 엔드포인트" 섹션 업데이트
- [ ] 새 기능 구현 → "완료된 작업 순서" 행 추가
- [ ] UI 변경 → "UI 개선" 섹션 업데이트
- [ ] 디자인 개선 → "디자인 개선" 섹션 업데이트
- [ ] 버그 수정 → 해당 섹션에 추가 (선택)

---

**작성자**: Claude Code  
**마지막 수정**: 2026-04-13  
**상태**: 진행 중 (추가 기능 개발 단계)
