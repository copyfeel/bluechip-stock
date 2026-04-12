import sys
import math
import csv
import os
import datetime
from flask import Flask, jsonify, request
from flask_cors import CORS
import yfinance as yf
import pandas as pd
import numpy as np
import requests
import re
from bs4 import BeautifulSoup

try:
    import FinanceDataReader as fdr
    FDR_AVAILABLE = True
except ImportError:
    FDR_AVAILABLE = False

app = Flask(__name__)
CORS(app)

# ========== 종목 목록 관리 ==========
STOCK_MAP = {}  # 전체 종목 (runtime 로드)
CACHE_FILE = os.path.join(os.path.dirname(__file__), 'stock_map.csv')
CACHE_DAYS = 7

# KOSPI/KOSDAQ 주요 종목 한글명 → 종목코드 매핑 (폴백용)
# 주의: suffix .KS (KOSPI) 또는 .KQ (KOSDAQ)를 포함하여 저장
FALLBACK_MAP = {
    # KOSPI 대형주 (.KS)
    "삼성전자": "005930.KS", "삼성전자우": "005935.KS",
    "sk하이닉스": "000660.KS", "SK하이닉스": "000660.KS",
    "lg에너지솔루션": "373220.KS", "LG에너지솔루션": "373220.KS",
    "삼성바이오로직스": "207940.KS",
    "현대차": "005380.KS", "현대자동차": "005380.KS",
    "기아": "000270.KS", "기아차": "000270.KS",
    "셀트리온": "068270.KS",
    "네이버": "035420.KS", "NAVER": "035420.KS",
    "삼성sdi": "006400.KS", "삼성SDI": "006400.KS",
    "lg화학": "051910.KS", "LG화학": "051910.KS",
    "포스코홀딩스": "005490.KS", "POSCO홀딩스": "005490.KS",
    "kb금융": "105560.KS", "KB금융": "105560.KS",
    "신한지주": "055550.KS",
    "하나금융지주": "086790.KS",
    "lg전자": "066570.KS", "LG전자": "066570.KS",
    "현대모비스": "012330.KS",
    "sk이노베이션": "096770.KS", "SK이노베이션": "096770.KS",
    "sk텔레콤": "017670.KS", "SK텔레콤": "017670.KS",
    "kt": "030200.KS", "KT": "030200.KS",
    "한국전력": "015760.KS",
    "삼성물산": "028260.KS",
    "두산에너빌리티": "034020.KS",
    "포스코퓨처엠": "003670.KS",
    "롯데케미칼": "011170.KS",
    "삼성화재": "000810.KS",
    "현대건설": "000720.KS",
    "고려아연": "010130.KS",
    "한화에어로스페이스": "012450.KS",
    "lg": "003550.KS", "LG": "003550.KS",
    "sk": "034730.KS", "SK": "034730.KS",
    "우리금융지주": "316140.KS",
    "삼성생명": "032830.KS",
    "한국금융지주": "071050.KS",
    "코웨이": "021240.KS",
    "오리온": "271560.KS",
    "cj제일제당": "097950.KS", "CJ제일제당": "097950.KS",
    "아모레퍼시픽": "090430.KS",
    "lg생활건강": "051900.KS", "LG생활건강": "051900.KS",
    "기업은행": "024110.KS",
    "ks한국금융": "018880.KS",
    "두산밥캣": "241560.KS",
    "현대중공업": "329180.KS",
    "한국조선해양": "009540.KS",
    "삼성엔지니어링": "028050.KS",
    "gs건설": "006360.KS", "GS건설": "006360.KS",
    "대우건설": "047040.KS",
    "롯데쇼핑": "023530.KS",
    "신세계": "004170.KS",
    "이마트": "139480.KS",
    "현대백화점": "069960.KS",
    "롯데지주": "004990.KS",
    "현대글로비스": "086280.KS",
    "삼성전기": "009150.KS",
    "lg이노텍": "011070.KS", "LG이노텍": "011070.KS",
    "삼성중공업": "010140.KS",
    "대한항공": "003490.KS",
    "아시아나항공": "020560.KS",
    "한진칼": "180640.KS",
    "에스원": "012750.KS",
    "현대오토에버": "307950.KS",
    "한화": "000880.KS",
    "한화솔루션": "009830.KS",
    "oci": "010060.KS", "OCI": "010060.KS",
    "포스코dxc": "022100.KS",
    "현대해상": "001450.KS",
    "메리츠금융지주": "138040.KS",
    "한국타이어앤테크놀로지": "161390.KS",

    # KOSDAQ (.KQ)
    "카카오": "035720.KQ",
    "크래프톤": "259960.KQ",
    "카카오뱅크": "323410.KQ",
    "카카오페이": "377300.KQ",
    "넷마블": "251270.KQ",
    "엔씨소프트": "036570.KQ",
    "넥슨게임즈": "225570.KQ",
    "하이브": "352820.KQ",
    "sm엔터테인먼트": "041510.KQ", "SM엔터테인먼트": "041510.KQ",
    "jyp엔터테인먼트": "035900.KQ", "JYP엔터테인먼트": "035900.KQ",
    "카카오엔터테인먼트": "035720.KQ",
    "sk바이오팜": "326030.KQ", "SK바이오팜": "326030.KQ",
    "에코프로비엠": "247540.KQ",
    "에코프로": "086520.KQ",
    "sk스퀘어": "402340.KQ", "SK스퀘어": "402340.KQ",
    "케이카": "381970.KQ",
}

def load_stock_map():
    """서버 시작 시 종목 목록 로드 (CSV 캐시 또는 FinanceDataReader)"""
    global STOCK_MAP

    # 1. 캐시 파일이 있고 최신이면 로드
    if os.path.exists(CACHE_FILE):
        try:
            mtime = datetime.datetime.fromtimestamp(os.path.getmtime(CACHE_FILE))
            if (datetime.datetime.now() - mtime).days < CACHE_DAYS:
                with open(CACHE_FILE, encoding='utf-8') as f:
                    reader = csv.DictReader(f)
                    STOCK_MAP = {row['name']: row['code'] for row in reader}
                print(f"[INFO] 종목 목록 로드 완료: {len(STOCK_MAP)}개 (캐시)")
                return
        except Exception as e:
            print(f"[WARN] 캐시 로드 실패: {e}")

    # 2. FinanceDataReader 사용 가능 확인
    if not FDR_AVAILABLE:
        print("[WARN] finance-datareader 미설치, FALLBACK_MAP 사용")
        STOCK_MAP = dict(FALLBACK_MAP)
        return

    # 3. FinanceDataReader로 종목 목록 로드 (suffix 포함)
    try:
        print("[INFO] FinanceDataReader로 종목 목록 다운로드 중...")
        result = {}
        for market, suffix in [('KOSPI', '.KS'), ('KOSDAQ', '.KQ')]:
            try:
                df = fdr.StockListing(market)
                for _, row in df.iterrows():
                    name = str(row['Name']).strip()
                    code = str(row['Code']).strip().zfill(6)
                    if name and code and len(code) == 6:
                        result[name] = f"{code}{suffix}"
                print(f"[INFO] {market}: {len(df)}개 로드")
            except Exception as e:
                print(f"[WARN] {market} 로드 실패: {e}")

        if result:
            # FALLBACK_MAP 병합 (FDR에서 누락된 경우 보완)
            for k, v in FALLBACK_MAP.items():
                if k not in result:
                    result[k] = v
            # CSV 캐시 저장
            try:
                with open(CACHE_FILE, 'w', encoding='utf-8', newline='') as f:
                    writer = csv.DictWriter(f, fieldnames=['name', 'code'])
                    writer.writeheader()
                    for name, code in result.items():
                        writer.writerow({'name': name, 'code': code})
            except Exception as e:
                print(f"[WARN] CSV 저장 실패: {e}")
            STOCK_MAP = result
            print(f"[INFO] 총 {len(STOCK_MAP)}개 종목 로드 완료")
        else:
            print("[WARN] FDR 데이터 없음, FALLBACK_MAP 사용")
            STOCK_MAP = dict(FALLBACK_MAP)
    except Exception as e:
        print(f"[WARN] FDR 실패, FALLBACK_MAP 사용: {e}")
        STOCK_MAP = dict(FALLBACK_MAP)

def resolve_ticker(query):
    """한글명/종목코드를 종목코드로 변환 (suffix 포함)"""
    # 이미 suffix 포함된 경우 (.KS/.KQ)
    if re.match(r'^\d{6}\.(KS|KQ)$', query):
        return query

    # 6자리 코드만 있는 경우 → .KS 기본 (사용자 직접 입력)
    if re.match(r'^\d{6}$', query):
        return query + '.KS'

    normalized = query.strip()
    search_map = STOCK_MAP if STOCK_MAP else FALLBACK_MAP

    # 정확 일치 → suffix 포함된 코드 그대로 반환
    if normalized in search_map:
        return search_map[normalized]

    # 소문자 일치
    lower = normalized.lower()
    for k, v in search_map.items():
        if k.lower() == lower:
            return v

    # 앞부분 부분 일치
    for k, v in search_map.items():
        if k.lower().startswith(lower):
            return v

    # 한글이 포함된 경우 → 못 찾음
    if re.search(r'[가-힣]', query):
        return None

    return query

def get_korean_name(symbol):
    try:
        code = re.sub(r'[^0-9]', '', symbol)
        if not code: return None
        url = f"https://finance.naver.com/item/main.naver?code={code}"
        res = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=5)
        soup = BeautifulSoup(res.text, 'html.parser')
        name_tag = soup.select_one('.wrap_company h2 a')
        if name_tag:
            return name_tag.text.strip()
    except Exception as e:
        print("Korean name fetch error:", e)
    return None

def safe_get(df, keys, date):
    if df is None or df.empty:
        return None
    # 정확한 날짜가 없으면 90일 이내 가장 가까운 날짜 사용 (balance sheet 날짜 불일치 대응)
    if date not in df.columns:
        candidates = sorted(df.columns, key=lambda d: abs((d - date).days))
        if not candidates or abs((candidates[0] - date).days) > 90:
            return None
        date = candidates[0]
    for k in keys:
        if k in df.index:
            val = df.loc[k, date]
            if pd.isna(val) or math.isinf(val):
                continue
            return float(val)
    return None

@app.route('/api/health')
def health():
    return jsonify({"status": "ok"})

@app.route('/api/search')
def search_stock():
    """자동완성용 종목 검색"""
    q = request.args.get('q', '').strip()
    if not q or len(q) < 1:
        return jsonify([])

    search_map = STOCK_MAP if STOCK_MAP else FALLBACK_MAP
    lower = q.lower()

    results = [
        {"name": k, "code": v}
        for k, v in search_map.items()
        if q in k or k.lower().startswith(lower)
    ][:10]  # 최대 10개

    return jsonify(results)

@app.route('/api/stock')
def get_stock():
    query_symbol = request.args.get('symbol')
    if not query_symbol:
        return jsonify({"error": "No symbol provided"}), 400

    # 한글명 -> 종목코드 변환
    resolved_symbol = resolve_ticker(query_symbol)
    if resolved_symbol is None:
        return jsonify({"error": f"'{query_symbol}' 종목을 찾을 수 없습니다. 지원하는 종목: 삼성전자, 현대차, 카카오, 네이버, SK하이닉스 등"}), 404
    print(f"[DEBUG] resolved: {resolved_symbol}")

    try:
        t = yf.Ticker(resolved_symbol)

        # t.info 실패해도 재무 데이터는 계속 처리 (yfinance 신버전 일부 종목 예외)
        info = {}
        try:
            info = t.info or {}
        except Exception as e:
            print(f"[WARN] t.info failed: {e}")

        financials = None
        balance = None
        try:
            financials = t.financials
        except Exception as e:
            print(f"[WARN] t.financials failed: {e}")
        try:
            balance = t.balance_sheet
        except Exception as e:
            print(f"[WARN] t.balance_sheet failed: {e}")

        # 디버그: 실제 yfinance 컬럼명 출력
        if financials is not None and not financials.empty:
            print(f"[DEBUG] financials index: {list(financials.index)}")
        if balance is not None and not balance.empty:
            print(f"[DEBUG] balance index: {list(balance.index)}")

        years_data = []
        if financials is not None and not financials.empty:
            dates = sorted(financials.columns, reverse=True)
            for i in range(min(5, len(dates))):
                date = dates[i]
                year_label = str(date.year)

                net_income = safe_get(financials, [
                    'Net Income', 'Net Income Common Stockholders',
                    'Net Income From Continuing Operations'
                ], date)
                revenue = safe_get(financials, ['Total Revenue', 'Operating Revenue'], date)
                op_income = safe_get(financials, ['Operating Income'], date)

                liab = safe_get(balance, [
                    'Total Liabilities Net Minority Interest', 'Total Liabilities',
                    'Total Liabilities And Minority Interest'
                ], date)
                eq = safe_get(balance, [
                    'Stockholders Equity', 'Total Stockholder Equity',
                    'Common Stockholders Equity', 'Total Equity Gross Minority Interest'
                ], date)
                retained_earn = safe_get(balance, [
                    'Retained Earnings', 'Retained Earnings (Deficit)'
                ], date)
                cs = safe_get(balance, ['Common Stock', 'Capital Stock'], date)

                debt_ratio    = (liab / eq) if liab and eq and eq != 0 else None
                reserve_ratio = (retained_earn / cs) if retained_earn and cs and cs != 0 else None
                op_margin     = (op_income / revenue) if op_income and revenue and revenue != 0 else None
                roe           = (net_income / eq) if net_income and eq and eq != 0 else None

                rev_growth = None
                if i + 1 < len(dates):
                    prev_date = dates[i+1]
                    prev_rev = safe_get(financials, ['Total Revenue', 'Operating Revenue'], prev_date)
                    if revenue is not None and prev_rev is not None and prev_rev != 0:
                        rev_growth = (revenue - prev_rev) / prev_rev

                years_data.append({
                    "yearLabel": year_label,
                    "netIncome": net_income,
                    "debtRatio": debt_ratio,
                    "reserveRatio": reserve_ratio,
                    "revGrowth": rev_growth,
                    "opMargin": op_margin,
                    "roe": roe
                })

        kor_name = get_korean_name(resolved_symbol)

        return jsonify({
            "symbol": resolved_symbol,
            "name": kor_name or info.get('shortName') or info.get('longName') or resolved_symbol,
            "per": info.get('trailingPE'),
            "divYield": info.get('dividendYield'),
            "yearsData": years_data
        })
    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

load_stock_map()

if __name__ == '__main__':
    port = int(os.environ.get('PORT', 8001))
    app.run(host='0.0.0.0', port=port, debug=False)
