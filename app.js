/* ========= 기본 설정 ========= */
const DEFAULT_SYMBOL = "AAPL";

const WATCHLISTS = {
  "us-tech": ["AAPL","MSFT","NVDA","AMZN","META","GOOG","TSLA","NFLX","ADBE","CRM","AVGO","AMD"],
  "us-semi": ["NVDA","AMD","AVGO","INTC","TSM","ASML","QCOM","MU","AMAT","LRCX","KLAC","TXN"],
  "kr-large": ["KRX:005930","KRX:000660","KRX:035720","KRX:051910","KRX:207940","KRX:005380","KRX:035420","KRX:105560","KRX:066570","KRX:028260","KRX:068270","KRX:003550"]
};

let currentListKey = "us-tech";
let currentSymbol = DEFAULT_SYMBOL;

/* ========= DOM ========= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ========= 심볼 정규화 ========= */
function normalizeSymbol(input){
  if(!input) return DEFAULT_SYMBOL;
  let s = input.trim();
  if (/^KRX:/i.test(s)) return "KRX:" + s.split(":")[1].toUpperCase();
  if (/^\d{6}$/.test(s)) return "KRX:" + s; // 한국 6자리 코드 -> KRX 접두사
  return s.toUpperCase();
}

/* ========= 빠른 링크 / 뉴스 테이블 ========= */
function linkSet(sym){
  const plain = sym.replace(/^KRX:/,"");
  const isKR = /^KRX:/.test(sym);

  const google = `https://news.google.com/search?q=${encodeURIComponent(sym + " stock")}&hl=ko&gl=KR&ceid=KR:ko`;
  const yahooQuote = isKR
    ? `https://finance.yahoo.com/quote/${encodeURIComponent(plain)}.KS`
    : `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
  const naverQuote = isKR
    ? `https://finance.naver.com/item/main.nhn?code=${encodeURIComponent(plain)}`
    : `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(sym + " 주가")}`;

  return { google, yahooQuote, naverQuote };
}

function buildNewsTable(sym){
  const { google, yahooQuote, naverQuote } = linkSet(sym);
  const rows = [
    { label: "Google News", href: google },
    { label: "Yahoo Finance", href: yahooQuote + "/news" },
    { label: "네이버 뉴스", href: /^KRX:/.test(sym)
        ? `https://finance.naver.com/item/news_news.nhn?code=${encodeURIComponent(sym.replace(/^KRX:/,""))}`
        : `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(sym + " 주가")}`
    }
  ];
  const tbody = $("#newsTableBody");
  tbody.innerHTML = rows
    .map(r => `<tr><td>${r.label}</td><td><a target="_blank" rel="noopener" href="${r.href}">열기</a></td></tr>`)
    .join("");
}

/* ========= TradingView 차트 ========= */
function renderChart(sym){
  $("#chartContainer").innerHTML = "";
  const containerId = "tv_chart_" + Date.now();
  const div = document.createElement("div");
  div.id = containerId;
  div.style.height = "100%";
  $("#chartContainer").appendChild(div);

  new TradingView.widget({
    container_id: containerId,
    symbol: sym,
    interval: "D",
    timeframe: "6M",       // ★ 기본 6개월로 시작
    theme: "dark",
    style: "1",
    locale: "kr",
    autosize: true,
    withdateranges: true,
    hide_top_toolbar: false,
    hide_legend: false,
    studies: ["MASimple@tv-basicstudies"]
  });
}

/* ========= 관심목록 ========= */
function renderWatchlist(){
  const list = WATCHLISTS[currentListKey];
  const ul = $("#watchlist");
  ul.innerHTML = "";
  list.forEach(s=>{
    const li = document.createElement("li");
    li.textContent = s.replace(/^KRX:/,"KRX·");
    if (normalizeSymbol(s) === currentSymbol) li.classList.add("active");
    li.addEventListener("click", ()=> setSymbol(s));
    ul.appendChild(li);
  });
}
function setWatchPage(btn){
  $$(".watch-page").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  currentListKey = btn.dataset.list;
  renderWatchlist();
}

/* ========= 심볼 변경 ========= */
function setSymbol(input){
  const sym = normalizeSymbol(input);
  currentSymbol = sym;

  $("#activeSymbol").textContent = sym;

  // 상단 퀵링크(요약)
  const { google, yahooQuote, naverQuote } = linkSet(sym);
  $("#quickLinks").innerHTML = `
    <a target="_blank" rel="noopener" href="${yahooQuote}">Quote</a>
    <a target="_blank" rel="noopener" href="${google}">News</a>
    <a target="_blank" rel="noopener" href="${naverQuote}">국내</a>
  `;

  // 뉴스 테이블(별도)
  buildNewsTable(sym);

  // 차트
  renderChart(sym);
}

/* ========= 탭 ========= */
function setTab(btn){
  $$(".tab-btn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  $$(".tab-content").forEach(c=>c.classList.remove("active"));
  $("#tab-" + btn.dataset.tab).classList.add("active");
}

/* ========= 외부 위젯들 ========= */
function mountScreener(){
  const mount = $("#screenerMount");
  mount.innerHTML = "";
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";
  script.async = true;
  script.innerHTML = JSON.stringify({
    width: "100%", height: 420, defaultColumn: "overview", defaultScreen: "general",
    market: "america", showToolbar: true, colorTheme: "dark", locale: "kr"
  });
  mount.appendChild(script);
}
function mountCalendar(){
  const mount = $("#calendarMount");
  mount.innerHTML = "";
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
  script.async = true;
  script.innerHTML = JSON.stringify({
    colorTheme: "dark", isTransparent: false, width: "100%", height: 420, locale: "kr", importanceFilter: "-1,0,1"
  });
  mount.appendChild(script);
}

/* ========= 계산기 ========= */
$("#calcBtn")?.addEventListener("click", ()=>{
  const acc = parseFloat($("#accSize").value);
  const rp  = parseFloat($("#riskPct").value);
  const entry = parseFloat($("#entryPrice").value);
  const stop  = parseFloat($("#stopPrice").value);
  const out = $("#posResult");

  if([acc,rp,entry,stop].some(v => !isFinite(v))){
    out.innerHTML = "<div>값을 모두 올바르게 입력해줘.</div>";
    return;
  }
  const riskAmt = acc * (rp/100);
  const perShare = Math.abs(entry - stop);
  if (perShare <= 0){
    out.innerHTML = "<div>손절가는 진입가와 달라야 합니다.</div>";
    return;
  }
  const shares = Math.floor(riskAmt / perShare);
  const posAmt = shares * entry;

  out.innerHTML = `
    <div>허용 리스크 금액: <b>${riskAmt.toLocaleString()}</b></div>
    <div>1주당 리스크: <b>${perShare.toLocaleString()}</b></div>
    <div>매수 수량(최대): <b>${shares.toLocaleString()}</b></div>
    <div>포지션 금액(대략): <b>${posAmt.toLocaleString()}</b></div>
  `;
});

/* ========= 평단 ========= */
$("#avgBtn")?.addEventListener("click", ()=>{
  const p1 = parseFloat($("#p1").value), q1 = parseFloat($("#q1").value);
  const p2 = parseFloat($("#p2").value), q2 = parseFloat($("#q2").value);
  const out = $("#avgResult");
  if([p1,q1,p2,q2].some(v => !isFinite(v) || v<=0)){
    out.textContent = "입력값을 확인해줘.";
    return;
  }
  const avg = (p1*q1 + p2*q2) / (q1+q2);
  out.textContent = "평단가: " + avg.toFixed(4);
});

/* ========= 이벤트 ========= */
$("#applyBtn")?.addEventListener("click", ()=>{
  const raw = $("#symbolInput").value;
  if(!raw) return;
  setSymbol(raw);
});
$("#symbolInput")?.addEventListener("keydown", (e)=>{
  if(e.key === "Enter"){ $("#applyBtn").click(); }
});
$$(".watch-page").forEach(btn=>{
  btn.addEventListener("click", ()=> setWatchPage(btn));
});
$$(".tab-btn").forEach(btn=>{
  btn.addEventListener("click", ()=> setTab(btn));
});

/* ========= 초기화 ========= */
(function init(){
  mountScreener();
  mountCalendar();
  setSymbol(DEFAULT_SYMBOL);
  renderWatchlist();
})();
