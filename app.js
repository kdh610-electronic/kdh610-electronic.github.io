/******** 설정 ********/
// Alpha Vantage 무료 플랜 절약: 1.5초 스로틀 + 6시간 캐시
const API_KEY = "4L2KP1QEQ5C01C8Y"; // 형의 키
const SYMBOLS = [
  "AAPL","MSFT","TSLA","NVDA",
  "GOOG","AMZN","META","NFLX",
  "AMD","INTC","IBM","ORCL"
]; // 12개 (3페이지 x 4)
const PAGE_SIZE = 4;
const CACHE_TTL_MS = 6 * 60 * 60 * 1000; // 6시간
const REQUEST_INTERVAL_MS = 1500; // 1.5초 간격
const MONTHS_WINDOW = 6; // 최근 6개월 차트

/******** 상태 ********/
let currentPage = 1;
const charts = new Map(); // symbol -> Chart

/******** 유틸 ********/
const $ = (sel) => document.querySelector(sel);
function byId(id){ return document.getElementById(id); }
function cacheKey(symbol){ return `av:${symbol}:WEEKLY`; } // 6개월은 WEEKLY로 충분
function setCache(symbol, payload){
  localStorage.setItem(cacheKey(symbol), JSON.stringify({ t: Date.now(), payload }));
}
function getCache(symbol){
  const raw = localStorage.getItem(cacheKey(symbol));
  if(!raw) return null;
  try{
    const obj = JSON.parse(raw);
    if(Date.now() - obj.t < CACHE_TTL_MS) return obj.payload;
  }catch(e){}
  return null;
}
function paginate(arr, page, size){
  const s = (page-1)*size;
  return arr.slice(s, s+size);
}

/******** 요청 큐(스로틀) ********/
const queue = [];
let qTimer = null;
function enqueue(fn){
  return new Promise((resolve, reject)=>{
    queue.push({fn, resolve, reject});
    pump();
  });
}
function pump(){
  if(qTimer) return;
  qTimer = setInterval(async ()=>{
    if(queue.length === 0){
      clearInterval(qTimer); qTimer = null; return;
    }
    const {fn, resolve, reject} = queue.shift();
    try { resolve(await fn()); }
    catch(e){ reject(e); }
  }, REQUEST_INTERVAL_MS);
}

/******** Alpha Vantage 호출 ********/
function apiUrlWeekly(symbol){
  return `https://www.alphavantage.co/query?function=TIME_SERIES_WEEKLY&symbol=${symbol}&apikey=${API_KEY}`;
}

async function fetchWeekly(symbol){
  const cached = getCache(symbol);
  if(cached) return cached;

  const res = await fetch(apiUrlWeekly(symbol));
  const json = await res.json();
  const key = Object.keys(json).find(k=>k.includes("Time Series"));
  if(!key) throw new Error(`불러오기 실패(${symbol}): ${JSON.stringify(json).slice(0,120)}`);
  const series = json[key]; // { 'YYYY-MM-DD': { '4. close': '...' } }

  // 날짜 오름차순 정렬
  const entries = Object.entries(series).sort((a,b)=> new Date(a[0]) - new Date(b[0]));

  // 최근 6개월(약 26주)만 컷
  const cutoff = new Date();
  cutoff.setMonth(cutoff.getMonth() - MONTHS_WINDOW);
  const labels = [];
  const closes = [];
  for(const [date, ohlc] of entries){
    const d = new Date(date);
    if(d >= cutoff){
      labels.push(date);
      closes.push(parseFloat(ohlc["4. close"]));
    }
  }

  const payload = { labels, closes };
  setCache(symbol, payload);
  return payload;
}

/******** 카드/차트 ********/
function createCard(symbol){
  const wrap = document.createElement("div");
  wrap.className = "card";
  wrap.innerHTML = `
    <div class="card-header">
      <div class="card-title">${symbol}</div>
      <div class="meta">최근 6개월 (주봉)</div>
    </div>
    <div id="state-${symbol}" class="loading">불러오는 중…</div>
    <div class="chart-wrap"><canvas id="cv-${symbol}" style="display:none"></canvas></div>

    <table class="news">
      <tr><th>관련 기사</th>
        <td>
          <a target="_blank" href="${googleNews(symbol)}">Google 뉴스</a> ·
          <a target="_blank" href="${naverNews(symbol)}">네이버 뉴스</a> ·
          <a target="_blank" href="${yahooNews(symbol)}">Yahoo Finance</a>
        </td>
      </tr>
    </table>
  `;
  return wrap;
}

function googleNews(sym){
  const q = encodeURIComponent(`${sym} stock`);
  return `https://news.google.com/search?q=${q}&hl=ko&gl=KR&ceid=KR:ko`;
}
function naverNews(sym){
  const q = encodeURIComponent(`${sym} 주가`);
  return `https://search.naver.com/search.naver?where=news&query=${q}`;
}
function yahooNews(sym){
  return `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}/news`;
}

async function drawSymbol(symbol){
  const state = byId(`state-${symbol}`);
  const canvas = byId(`cv-${symbol}`);
  state.textContent = "불러오는 중…";
  canvas.style.display = "none";

  try{
    const { labels, closes } = await enqueue(()=> fetchWeekly(symbol));

    state.style.display = "none";
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
          label: `${symbol} (6M)`,
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
          x: { ticks: { maxTicksLimit: 8 }},
          y: { beginAtZero: false }
        },
        plugins: { legend: { display:false } }
      }
    });
    charts.set(symbol, chart);
  }catch(e){
    state.className = "error";
    state.textContent = `에러: ${e.message}`;
  }
}

/******** 페이지 렌더링 ********/
function renderPage(){
  // 기존 차트 정리
  charts.forEach(ch => ch.destroy());
  charts.clear();

  const grid = $("#grid");
  grid.innerHTML = "";

  const list = paginate(SYMBOLS, currentPage, PAGE_SIZE);
  list.forEach(sym => grid.appendChild(createCard(sym)));

  (async () => {
    for(const sym of list){
      await drawSymbol(sym);
    }
  })();
}

/******** 이벤트 ********/
function bindEvents(){
  document.querySelectorAll(".page-btn").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      document.querySelectorAll(".page-btn").forEach(b=>b.classList.remove("active"));
      btn.classList.add("active");
      currentPage = Number(btn.dataset.page);
      renderPage();
    });
  });
}

/******** 시작 ********/
document.addEventListener("DOMContentLoaded", ()=>{
  bindEvents();
  renderPage();
});
