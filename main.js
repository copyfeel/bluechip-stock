// Railway 백엔드 URL (나중에 수정할 예정)                                                                     
const API_BASE_URL = 'https://bluechip-stock-production.up.railway.app';
const analyzeBtn = document.getElementById('analyzeBtn');
const handsomeListBtn = document.getElementById('handsomeListBtn');
const watchlistBtn = document.getElementById('watchlistBtn');
// const apiKeyInput = document.getElementById('apiKey'); // 이제 필요 없음
const tickersInput = document.getElementById('tickers');
const clearBtn = document.getElementById('clearBtn');
const loadingDiv = document.getElementById('loading');
const resultsGrid = document.getElementById('resultsGrid');

// 슬라이딩 패널용 데이터 캐시
const stockDataCache = {};

// 차트 인스턴스 관리
const chartInstances = {};

// 모달 창 열기/닫기
window.openCriteriaModal = () => {
  document.getElementById('criteriaModal').classList.remove('hidden');
};

window.closeCriteriaModal = () => {
  document.getElementById('criteriaModal').classList.add('hidden');
};

// 슬라이딩 패널 열기/닫기
window.openSlidePanel = (symbol) => {
  const cached = stockDataCache[symbol];
  if (!cached) return;
  const content = document.getElementById('slidePanelContent');
  content.innerHTML = '';
  const card = document.createElement('div');
  card.id = `panel-card-${cached.symbol}`;
  card.className = 'stock-card' + (getHandsomeList().includes(cached.symbol) ? ' is-handsome' : '') + (getWatchlist().includes(cached.symbol) ? ' is-watchlist' : '');
  card.innerHTML = buildCardHTML(cached.symbol, cached.name, cached.data);
  content.appendChild(card);
  document.getElementById('slidePanel').classList.add('open');
  document.getElementById('slideOverlay').classList.add('open');
};

window.closeSlidePanel = () => {
  document.getElementById('slidePanel').classList.remove('open');
  document.getElementById('slideOverlay').classList.remove('open');
};

// 탭 전환
window.switchTab = (symbol, tab) => {
  const financeTab = document.getElementById(`tab-finance-${symbol}`);
  const chartTab = document.getElementById(`tab-chart-${symbol}`);
  const tabBtns = document.querySelectorAll(`[onclick*="switchTab('${symbol}"]`);

  tabBtns.forEach(btn => btn.classList.remove('active'));

  if (tab === 'finance') {
    financeTab.classList.remove('hidden');
    chartTab.classList.add('hidden');
    tabBtns[0].classList.add('active');
  } else {
    financeTab.classList.add('hidden');
    chartTab.classList.remove('hidden');
    tabBtns[1].classList.add('active');
    // 차트가 처음 로드되면 로드
    if (!chartInstances[symbol]) {
      loadChart(symbol, '1d');
    }
  }
};

// 차트 데이터 로드 및 렌더링
window.loadChart = async (symbol, interval = '1d') => {
  try {
    const res = await fetch(`${API_BASE_URL}/api/chart?symbol=${encodeURIComponent(symbol)}&interval=${interval}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    const container = document.getElementById(`chart-${symbol}`);
    if (!container) return;

    container.innerHTML = '';

    // Lightweight Charts 초기화
    const chart = LightweightCharts.createChart(container, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#222222'
      },
      grid: {
        vertLines: { color: '#e8e8e8' },
        horzLines: { color: '#e8e8e8' }
      },
      crosshair: { mode: LightweightCharts.CrosshairMode.Normal },
      rightPriceScale: {
        borderColor: '#cccccc',
        textColor: '#666666'
      },
      timeScale: {
        borderColor: '#cccccc',
        timeVisible: true,
        secondsVisible: false,
        fixLeftEdge: true,
        fixRightEdge: true
      },
      width: container.offsetWidth,
      height: container.offsetHeight || 450
    });

    // 캔들 시리즈
    const candleSeries = chart.addCandlestickSeries({
      upColor: '#ef5350',
      downColor: '#1565c0',
      borderVisible: false,
      wickUpColor: '#ef5350',
      wickDownColor: '#1565c0'
    });
    candleSeries.setData(data.candles);
    chart.timeScale().fitContent();

    // MA 라인 추가
    const MA_COLORS = {
      '5': '#ff9800',
      '20': '#e91e63',
      '60': '#2196f3',
      '120': '#9c27b0',
      '240': '#00bcd4'
    };
    const maLines = {};
    for (const [period, color] of Object.entries(MA_COLORS)) {
      if (data.ma[period] && data.ma[period].length > 0) {
        const line = chart.addLineSeries({
          color,
          lineWidth: 1.5,
          priceLineVisible: false,
          title: `MA${period}`,
          visible: false
        });
        line.setData(data.ma[period]);
        maLines[period] = { series: line, visible: false };
      }
    }

    // 거래량 차트 (별도)
    const volContainer = document.getElementById(`volume-${symbol}`);
    volContainer.innerHTML = '';
    const volChart = LightweightCharts.createChart(volContainer, {
      layout: {
        background: { color: '#ffffff' },
        textColor: '#888888'
      },
      grid: {
        vertLines: { color: '#e8e8e8' },
        horzLines: { color: '#e8e8e8' }
      },
      width: volContainer.offsetWidth,
      height: volContainer.offsetHeight || 200,
      rightPriceScale: {
        borderColor: '#cccccc',
        textColor: '#666666'
      },
      timeScale: {
        borderColor: '#cccccc',
        fixLeftEdge: true,
        fixRightEdge: true
      }
    });
    const volSeries = volChart.addHistogramSeries({
      color: '#26a69a'
    });
    volSeries.setData(data.volume);
    volChart.timeScale().fitContent();

    // 두 차트 동기화
    chart.timeScale().subscribeVisibleTimeRangeChange((newVisibleTimeRange) => {
      volChart.timeScale().setVisibleRange(newVisibleTimeRange);
    });

    // 차트 인스턴스 저장
    chartInstances[symbol] = {
      chart,
      candleSeries,
      maLines,
      volChart,
      volSeries,
      data
    };

    // 최신 데이터로 이동
    chart.timeScale().scrollToRealTime();

    // 리사이즈 대응
    const ro = new ResizeObserver(() => {
      if (container.offsetWidth > 0) {
        chart.resize(container.offsetWidth, container.offsetHeight || 450);
      }
      if (volContainer.offsetWidth > 0) {
        volChart.resize(volContainer.offsetWidth, volContainer.offsetHeight || 120);
      }
    });
    ro.observe(container);

    // 기간 버튼 업데이트
    const intervalBtns = document.querySelectorAll(`[onclick*="loadChart('${symbol}"]`);
    intervalBtns.forEach(btn => {
      const intervalValue = btn.getAttribute('onclick').match(/'([^']+)'\s*\)/)[1];
      if (intervalValue === interval) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    });

  } catch (err) {
    console.error('차트 로드 오류:', err);
    const container = document.getElementById(`chart-${symbol}`);
    if (container) {
      container.innerHTML = `<div style="color: var(--danger); padding: 1rem; text-align: center;">차트 데이터를 불러올 수 없습니다.<br><small style="opacity:0.7">${err.message}</small></div>`;
    }
  }
};

// MA 라인 토글
window.toggleMA = (symbol, period, visible) => {
  const instance = chartInstances[symbol];
  if (!instance || !instance.maLines[period]) return;

  const line = instance.maLines[period].series;
  if (visible) {
    line.applyOptions({ visible: true });
    instance.maLines[period].visible = true;
  } else {
    line.applyOptions({ visible: false });
    instance.maLines[period].visible = false;
  }
};

window.clearInput = () => {
  tickersInput.value = '';
  tickersInput.focus();
  clearBtn.style.display = 'none';
};

// 입력값이 있으면 X 버튼 표시
tickersInput.addEventListener('input', () => {
  clearBtn.style.display = tickersInput.value.trim() ? 'block' : 'none';
});

const getHandsomeList = () => JSON.parse(localStorage.getItem('handsome_list') || '[]');
const getWatchlist = () => JSON.parse(localStorage.getItem('watchlist') || '[]');

const saveToHandsomeList = (symbol) => {
  const list = getHandsomeList();
  if(!list.includes(symbol)) {
    list.push(symbol);
    localStorage.setItem('handsome_list', JSON.stringify(list));
    alert(`${symbol} 종목이 미남종목으로 저장되었습니다!`);
  }
};
const removeFromHandsomeList = (symbol) => {
  let list = getHandsomeList();
  list = list.filter(s => s !== symbol);
  localStorage.setItem('handsome_list', JSON.stringify(list));
  alert(`${symbol} 종목이 미남종목에서 삭제되었습니다.`);
  if (currentMode === 'HANDSOME') {
    runAnalysis('HANDSOME');
  }
};

window.toggleHandsome = (symbol, isAdd) => {
  if (isAdd) {
    saveToHandsomeList(symbol);
    const btn = document.getElementById(`btn-${symbol}`);
    if (btn) btn.outerHTML = `<button id="btn-${symbol}" class="action-btn remove-btn" onclick="toggleHandsome('${symbol}', false)">🗑 미남종목 삭제</button>`;
    const card = document.getElementById(`card-${symbol}`);
    if (card) card.classList.add('is-handsome');
  } else {
    removeFromHandsomeList(symbol);
    const btn = document.getElementById(`btn-${symbol}`);
    if (btn && currentMode !== 'HANDSOME') {
      btn.outerHTML = `<button id="btn-${symbol}" class="action-btn" onclick="toggleHandsome('${symbol}', true)">💖 미남종목으로 저장</button>`;
    }
    const card = document.getElementById(`card-${symbol}`);
    if (card) card.classList.remove('is-handsome');
  }
};

window.toggleWatchlist = (symbol, isChecked) => {
  let list = getWatchlist();
  if (isChecked) {
    if (!list.includes(symbol)) list.push(symbol);
  } else {
    list = list.filter(s => s !== symbol);
  }
  localStorage.setItem('watchlist', JSON.stringify(list));
  const card = document.getElementById(`card-${symbol}`);
  if (card) {
    isChecked ? card.classList.add('is-watchlist') : card.classList.remove('is-watchlist');
  }
};

let currentMode = 'ALL';

const formatNumber = (num, toBillion = true) => {
  if (num === null || num === undefined || isNaN(num)) return 'N/A';
  if (toBillion) {
    const billion = num / 100000000;
    return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 }).format(billion) + '억';
  }
  return new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(num);
};

const formatPercent = (dec) => {
  if (dec === null || dec === undefined || isNaN(dec) || !isFinite(dec)) return 'N/A';
  return (dec * 100).toFixed(2) + '%';
};

const cellClass = (value, passFn) => {
  if (value === null || value === undefined || isNaN(value)) return '';
  return passFn(value) ? 'cell-pass' : 'cell-fail';
};

const badgeClass = (value, passFn) => {
  if (value === null || value === undefined || isNaN(value)) return '';
  return passFn(value) ? 'badge-pass' : 'badge-fail';
};

// ========== 자동완성 ==========
const autocompleteDiv = document.getElementById('autocomplete');
let autocompleteTimeout;

const debounce = (fn, delay) => {
  return (...args) => {
    clearTimeout(autocompleteTimeout);
    autocompleteTimeout = setTimeout(() => fn(...args), delay);
  };
};

const hideDropdown = () => {
  autocompleteDiv.classList.add('hidden');
  autocompleteDiv.innerHTML = '';
};

const showDropdown = (items, onSelect) => {
  if (items.length === 0) {
    hideDropdown();
    return;
  }
  autocompleteDiv.innerHTML = items.map(item => `
    <div class="autocomplete-item" onclick="document.getElementById('tickers').value = document.getElementById('tickers').value.slice(0, document.getElementById('tickers').value.lastIndexOf(',') + 1) + ' ${item.name}'; hideAutocomplete();">
      <span>${item.name}</span>
      <span class="item-code">${item.code}</span>
    </div>
  `).join('');
  autocompleteDiv.classList.remove('hidden');
};

const hideAutocomplete = () => {
  hideDropdown();
};
window.hideAutocomplete = hideAutocomplete;

// 입력란 자동완성 이벤트
tickersInput.addEventListener('input', debounce(async () => {
  const raw = tickersInput.value;
  if (!raw.trim()) {
    hideDropdown();
    return;
  }
  const parts = raw.split(',');
  const last = parts[parts.length - 1].trim();
  if (last.length < 1) {
    hideDropdown();
    return;
  }
  try {
    const res = await fetch(`${API_BASE_URL}/api/search?q=${encodeURIComponent(last)}`);
    const items = await res.json();
    if (items.length > 0) {
      showDropdown(items);
    } else {
      hideDropdown();
    }
  } catch (e) {
    hideDropdown();
  }
}, 300));

// 드롭다운 바깥 클릭 시 닫기
document.addEventListener('click', (e) => {
  if (e.target !== tickersInput && e.target.parentElement !== autocompleteDiv) {
    hideDropdown();
  }
});

const fetchAPI = async (symbol) => {
  const url = `${API_BASE_URL}/api/stock?symbol=${encodeURIComponent(symbol)}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`서버 오류: ${response.status} ${response.statusText}`);
  }
  const data = await response.json();
  if (data.error) {
    throw new Error(data.error);
  }
  return data;
};

const runAnalysis = async (mode) => {
  currentMode = mode;
  let tickersStr = tickersInput.value.trim();

  let symbols = [];
  if (mode === 'HANDSOME') {
    const list = getHandsomeList();
    if (list.length === 0) {
      alert('현재 저장된 미남종목이 없습니다. 먼저 종목을 분석하고 저장해주세요.');
      return;
    }
    symbols = list;
  } else if (mode === 'WATCHLIST') {
    const list = getWatchlist();
    if (list.length === 0) {
      alert('현재 저장된 관심종목이 없습니다. 먼저 종목을 분석하고 체크해주세요.');
      return;
    }
    symbols = list;
  } else {
    if (!tickersStr) {
      alert('분석할 종목 코드를 입력해주세요. (예: 005930)');
      return;
    }
    symbols = tickersStr.split(',').map(s => {
      let sym = s.trim();
      if (/^\d{6}$/.test(sym)) sym += '.KS';
      return sym;
    });
  }

  resultsGrid.innerHTML = '';
  loadingDiv.classList.remove('hidden');
  analyzeBtn.disabled = true;
  handsomeListBtn.disabled = true;
  watchlistBtn.disabled = true;
  
  try {
    for (const [index, symbol] of symbols.entries()) {
      loadingDiv.innerText = `${symbol} 데이터 로드 중 (yfinance)... (진행: ${index + 1}/${symbols.length})`;

      try {
        const data = await fetchAPI(symbol);
        const resolvedSymbol = data.symbol || symbol;
        const displayName = data.name || resolvedSymbol;
        if (mode === 'WATCHLIST' || mode === 'HANDSOME') {
          renderListItem(resolvedSymbol, displayName, data);
        } else {
          render5YearCard(resolvedSymbol, displayName, data);
        }
      } catch (err) {
        resultsGrid.innerHTML += `<div class="error-msg" style="grid-column: 1 / -1; padding: 1rem;">${symbol} 분석 오류: ${err.message}</div>`;
      }
    }
  } catch (error) {
    resultsGrid.innerHTML += `<div class="error-msg" style="grid-column: 1 / -1;">서버 통신 오류 발생: ${error.message}</div>`;
  } finally {
    loadingDiv.classList.add('hidden');
    analyzeBtn.disabled = false;
    handsomeListBtn.disabled = false;
    watchlistBtn.disabled = false;
  }
};

analyzeBtn.addEventListener('click', () => runAnalysis('ALL'));
watchlistBtn.addEventListener('click', () => runAnalysis('WATCHLIST'));
handsomeListBtn.addEventListener('click', () => runAnalysis('HANDSOME'));

function renderListItem(symbol, name, data) {
  stockDataCache[symbol] = { symbol, name, data };
  const item = document.createElement('div');
  item.className = 'stock-list-item';
  item.innerHTML = `
    <span class="item-name">${name}</span>
    <span class="item-symbol">${symbol}</span>
    <span class="item-arrow">›</span>
  `;
  item.onclick = () => openSlidePanel(symbol);
  resultsGrid.appendChild(item);
}

function buildCardHTML(symbol, name, data) {
  const yearsData = data.yearsData || [];
  const handsomeList = getHandsomeList();
  const isHandsome = handsomeList.includes(symbol);
  const watchlist = getWatchlist();
  const isWatchlist = watchlist.includes(symbol);

  let html = `
    <div class="stock-header">
      <div class="stock-title" style="display:flex; align-items:center; gap:0.5rem;">
        <input type="checkbox" class="watchlist-checkbox" id="watch-${symbol}" ${isWatchlist ? 'checked' : ''} onchange="toggleWatchlist('${symbol}', this.checked)" />
        ${name}
      </div>
      <div class="stock-ticker">${symbol}</div>
    </div>

    <div class="card-tabs">
      <button class="tab-btn active" onclick="switchTab('${symbol}', 'finance')">📊 재무분석</button>
      <button class="tab-btn" onclick="switchTab('${symbol}', 'chart')">📈 차트</button>
    </div>

    <div id="tab-finance-${symbol}" class="tab-content">
  `;

  if (yearsData.length === 0) {
    html += `<div style="color:var(--danger); font-size:0.9rem; margin-bottom: 1rem;">
      * yfinance 지원 안함: 해당 종목의 재무 제표가 존재하지 않습니다.
    </div>`;
  } else {
    let per = data.per;
    let divYield = data.divYield;
    
    html += `
      <div style="margin-bottom: 1rem; color: var(--accent); font-weight: 600;">
        <span>단일 지표 확인 (최신/TTM)</span> |
        <span class="${badgeClass(per, v => v <= 20)}"> PER: ${formatNumber(per, false)} </span> |
        <span class="${badgeClass(divYield, v => v >= 0.02 && v <= 0.05)}"> 배당수익률: ${formatPercent(divYield)}</span> |
        <span> 최대주주 지분율: 데이터 미지원</span>
      </div>
      <table class="data-table">
        <thead>
          <tr>
            <th>구분</th>
            ${yearsData.map(y => `<th>${y.yearLabel}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>당기순이익</td>
            ${yearsData.map(y => `<td class="${cellClass(y.netIncome, v => v > 0)}">${formatNumber(y.netIncome)}</td>`).join('')}
          </tr>
          <tr>
            <td>부채비율</td>
            ${yearsData.map(y => `<td class="${cellClass(y.debtRatio, v => v <= 1.0)}">${formatPercent(y.debtRatio)}</td>`).join('')}
          </tr>
          <tr>
            <td>유보비율</td>
            ${yearsData.map(y => `<td class="${cellClass(y.reserveRatio, v => v >= 5.0)}">${formatPercent(y.reserveRatio)}</td>`).join('')}
          </tr>
          <tr>
            <td>매출성장율</td>
            ${yearsData.map(y => `<td class="${cellClass(y.revGrowth, v => v >= 0.05)}">${formatPercent(y.revGrowth)}</td>`).join('')}
          </tr>
          <tr>
            <td>영업이익율</td>
            ${yearsData.map(y => `<td class="${cellClass(y.opMargin, v => v >= 0.1)}">${formatPercent(y.opMargin)}</td>`).join('')}
          </tr>
          <tr>
            <td>ROE</td>
            ${yearsData.map(y => `<td class="${cellClass(y.roe, v => v >= 0.15)}">${formatPercent(y.roe)}</td>`).join('')}
          </tr>
        </tbody>
      </table>
    `;
  }

  html += `
      <div class="btn-group">
        ${isHandsome
          ? `<button id="btn-${symbol}" class="action-btn remove-btn" onclick="toggleHandsome('${symbol}', false)">🗑 미남종목 삭제</button>`
          : `<button id="btn-${symbol}" class="action-btn" onclick="toggleHandsome('${symbol}', true)">💖 미남종목으로 저장</button>`
        }
      </div>
    </div>

    <div id="tab-chart-${symbol}" class="tab-content hidden">
      <div class="interval-tabs">
        <button class="interval-btn active" onclick="loadChart('${symbol}', '1d')">일</button>
        <button class="interval-btn" onclick="loadChart('${symbol}', '1wk')">주</button>
        <button class="interval-btn" onclick="loadChart('${symbol}', '1mo')">월</button>
        <button class="interval-btn" onclick="loadChart('${symbol}', '3mo')">년</button>
      </div>
      <div class="ma-toggles">
        <label><input type="checkbox" class="ma-check" data-period="5" onchange="toggleMA('${symbol}', 5, this.checked)"> MA5</label>
        <label><input type="checkbox" class="ma-check" data-period="20" onchange="toggleMA('${symbol}', 20, this.checked)"> MA20</label>
        <label><input type="checkbox" class="ma-check" data-period="60" onchange="toggleMA('${symbol}', 60, this.checked)"> MA60</label>
        <label><input type="checkbox" class="ma-check" data-period="120" onchange="toggleMA('${symbol}', 120, this.checked)"> MA120</label>
        <label><input type="checkbox" class="ma-check" data-period="240" onchange="toggleMA('${symbol}', 240, this.checked)"> MA240</label>
      </div>
      <div id="chart-${symbol}" class="chart-container"></div>
      <div id="volume-${symbol}" class="volume-container"></div>
    </div>
  `;

  return html;
}

function render5YearCard(symbol, name, data) {
  const handsomeList = getHandsomeList();
  const isHandsome = handsomeList.includes(symbol);
  const watchlist = getWatchlist();
  const isWatchlist = watchlist.includes(symbol);

  const card = document.createElement('div');
  card.id = `card-${symbol}`;
  card.className = 'stock-card' + (isHandsome ? ' is-handsome' : '') + (isWatchlist ? ' is-watchlist' : '');
  card.innerHTML = buildCardHTML(symbol, name, data);
  resultsGrid.appendChild(card);
}
