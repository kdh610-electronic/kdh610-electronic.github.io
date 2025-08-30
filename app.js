/***** 설정 *****/
// Alpha Vantage 무료 플랜: 보통 분당 5회, 일 100회 제한.
// -> 요청을 큐로 모아 1.5초 간격으로 처리(약 분당 40회 가능하지만 여기선 페이지당 4회만 실행)
// -> 로컬스토리지 캐시(6시간)로 재호출 최소화
const API_KEY = "4L2KP1QEQ5C01C8Y"; // 형의 키
const SYMBOLS = [
  "AAPL","MSFT","TSLA","NVDA",
  "GOOG","AMZN","META","NFLX",
  "AMD","INTC","IBM","ORCL"
]; // 12종목 (필요시 바꿔)
const PAGE_SIZE = 4; // 페이지당 4개
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간
const REQUEST_INTERVAL_MS = 1500; // 1.5초 간격(안전하게)

/***** 상태 *****/
let currentPage = 1;
let currentTF = "DAILY";
const charts = new Map(); // symbol -> Chart instance
const queue = []; // 요청 큐
let queueTimer = null;

/***** 유틸 *****/
const el = (sel) => document.querySelector(sel);
const byId = (id) => document.getElementById(id);
function sleep(ms){ return new Promise(r=>setTimeout(r, ms)); }
function cacheKey(symbol, tf){ return `av:${symbol}:${tf}`; }
function setCache(symbol, tf, payload){
  localStorage.setItem(cacheKey(symbol, tf), JSON.stringify({ t: Date.now(), payload }));
}
function getCache(symbol, tf){
  const raw = localStorage.getItem(cacheKey(symbol, tf));
  if(!raw) return null;
  try{
    const obj = JSON.parse(raw);
    if(Date.now() - obj.t < CACHE_TTL_MS) return obj.payload;
  }catch{}
  return null;
}
function paginate(arr, page, size){
  const start = (page-1)*size;
  return arr.slice(start, start+size);
}
function formatNumber(n){
  if (n === undefined || n === null || isNaN(n)) return "-";
  return Number(n).toLocaleString(undefined, { maximumFractionDigits: 4 });
}

/***** Alpha Vantage 호출 *****/
function apiUrl(symbol, tf){
  const fn = tf === "DAILY" ? "TIME_SERIES_DAILY"
          : tf === "WEEKLY" ? "TIME_SERIES_WEEKLY"
          : "TIME_SERIES_MONTHLY";
  return `https://www.alphavantage.co/query?function=${fn}&symbol=${symbol}&apikey=${API_KEY}&outputsize=compact`;
}

async function fetchSeries(symbol, tf){
  // 캐시 먼저
  const cached = getCache(symbol, tf);
  if(cached) return cached;

  const res = await fetch(apiUrl(symbol, tf));
  const json = await res.json();

  const key = Object.keys(json).find(k => k.includes("Time Series"));
  if(!key) throw new Error(`데이터 불러오기 실패(${symbol}): ${JSON.stringify(json).slice(0,100)}`);

  const series = json[key]; // { 'YYYY-MM-DD': { '1. open': '...', '4. close': '...' } }
  const entries = Object.entries(series).sort((a,b)=> new Date(a[0]) - new Date(b[0]));
  const labels = entries.map(([d]) => d);
  const closes = entries.map(([, ohlc]) => parseFloat(ohlc["4. close"]));

  // 가장 최근 거래일을 전일 종가로 표기(시점 기준 최신)
  const lastIdx = closes.length - 1;
  const prevClose = closes[lastIdx];
  const prevDate = labels[lastIdx];

  const payload = { labels, closes, prevClose, prevDate };
  setCache(symbol, tf, payload);
  return payload;
}

/***** 요청 큐(스로틀) *****/
function enqueueRequest(fn){
  return new Promise((resolve, reject)=>{
    queue.push({ fn, resolve, reject });
    pumpQueue();
  });
}
function pumpQueue(){
  if(queueTimer) return;
  queueTimer = setInterval(async ()=>{
    if(queue.length === 0) {
      clearInterval(queueTimer);
      queueTimer = null;
      return;
    }
    const { fn, resolve, reject } = queue.shift();
    try {
      const result = await fn();
      resolve(result);
    } catch (e) {
      reject(e);
    }
  }, REQUEST_INTERVAL_MS);
}

/***** 차트 렌더링 *****/
function createCard(symbol){
  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.innerHTML = `
    <div class="card-header">
      <div class="card-title">${symbol}</div>
      <div class="meta"><span class="price" id="p-${symbol}">-</span> <span id="d-${symbol}"></span></div>
    </div>
    <div id="state-${symbol}" class="loading">불러오는 중…</div>
    <canvas id="cv-${symbol}" style="display:none"></canvas>
  `;
  return wrap;
}

async function drawSymbol(symbol){
  const stateEl = byId(`state-${symbol}`);
  const canvas = byId(`cv-${symbol}`);
  const priceEl = byId(`p-${symbol}`);
  const dateEl = byId(`d-${symbol}`);

  stateEl.textContent = "불러오는 중…";
  canvas.style.display = "none";

  try{
    const { labels, closes, prevClose, prevDate } = await enqueueRequest(()=> fetchSeries(symbol, currentTF));

    priceEl.textContent = `$ ${formatNumber(prevClose)}`;
    dateEl.textContent = `(${prevDate})`;
    stateEl.style.display = "none";
    canvas.style.display = "block";

    // 기존 차트 제거
    if(charts.has(symbol)){
      charts.get(symbol).destroy();
      charts.delete(symbol);
    }

    const ctx = canvas.getContext("2d");
    const chart = new Chart(ctx, {
      type: "line",
      data: {
        labels,
        datasets: [{
          label: `${symbol} - ${currentTF}`,
          data: closes,
          borderWidth: 2,
          pointRadius: 0,
          tension: 0.2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: { ticks: { maxTicksLimit: 8 } },
          y: { beginAtZero: false }
        },
        plugins: {
          legend: { display: false },
          tooltip: { mode: "index", intersect: false }
        }
      }
    });
    charts.set(symbol, chart);
  }catch(err){
    stateEl.className = "error";
    stateEl.textContent = `에러: ${err.message}`;
  }
}

/***** 페이지 렌더링 *****/
function renderPage(){
  // 기존 차트 정리(보이는 것만 다시 그림)
  charts.forEach(ch => ch.destroy());
  charts.clear();

  const grid = el("#grid");
  grid.innerHTML = "";

  const symbols = paginate(SYMBOLS, currentPage, PAGE_SIZE);
  symbols.forEach(sym => {
    const card = createCard(sym);
    grid.appendChild(card);
  });
  // 순차로 그리기
  (async () => {
    for(const sym of symbols){
      await drawSymbol(sym);
    }
  })();
}

/***** 이벤트 바인딩 *****/
function bindEvents(){
  // 페이지 버튼
  document.querySelectorAll(".page-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".page-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      currentPage = Number(btn.dataset.page);
      renderPage();
    });
  });

  // 봉 간격 변경
  byId("tf").addEventListener("change", (e)=>{
    currentTF = e.target.value;
    renderPage();
  });
}

/***** 초기화 *****/
function init(){
  bindEvents();
  renderPage(); // page 1, DAILY
}
document.addEventListener("DOMContentLoaded", init);
