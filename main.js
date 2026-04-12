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
        render5YearCard(resolvedSymbol, displayName, data);
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

function render5YearCard(symbol, name, data) {
  const yearsData = data.yearsData || [];
  const handsomeList = getHandsomeList();
  const isHandsome = handsomeList.includes(symbol);
  const watchlist = getWatchlist();
  const isWatchlist = watchlist.includes(symbol);

  const card = document.createElement('div');
  card.id = `card-${symbol}`;
  card.className = 'stock-card' + (isHandsome ? ' is-handsome' : '') + (isWatchlist ? ' is-watchlist' : '');

  let html = `
    <div class="stock-header">
      <div class="stock-title" style="display:flex; align-items:center; gap:0.5rem;">
        <input type="checkbox" class="watchlist-checkbox" id="watch-${symbol}" ${isWatchlist ? 'checked' : ''} onchange="toggleWatchlist('${symbol}', this.checked)" />
        ${name}
      </div>
      <div class="stock-ticker">${symbol}</div>
    </div>
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
  `;

  card.innerHTML = html;
  resultsGrid.appendChild(card);
}
