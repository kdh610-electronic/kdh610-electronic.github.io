/* ========= 기본 설정 ========= */
const DEFAULT_SYMBOL = "AAPL";

const WATCHLISTS = {
  "us-tech": ["AAPL","MSFT","NVDA","AMZN","META","GOOG","TSLA","NFLX","ADBE","CRM","AVGO","AMD"],
  "us-semi": ["NVDA","AMD","AVGO","INTC","TSM","ASML","QCOM","MU","AMAT","LRCX","KLAC","TXN"],
  "kr-large": ["KRX:005930","KRX:000660","KRX:035720","KRX:051910","KRX:207940","KRX:005380","KRX:035420","KRX:105560","KRX:066570","KRX:028260","KRX:068270","KRX:003550"]
};

let currentListKey = "us-tech";
let currentSymbol = DEFAULT_SYMBOL;
let tvWidget = null;

/* ========= DOM 헬퍼 ========= */
const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* ========= 심볼 정규화 =========
   - 'KRX:005930' 유지
   - '005930' -> 'KRX:005930'
   - 'aapl' -> 'AAPL' */
function normalizeSymbol(input){
  if(!input) return DEFAULT_SYMBOL;
  let s = input.trim();
  if (/^KRX:/i.test(s)) return "KRX:" + s.split(":")[1].toUpperCase();
  if (/^\d{6}$/.test(s)) return "KRX:" + s; // 한국 6자리 종목코드
  return s.toUpperCase();
}

/* ========= 링크 빌더 ========= */
function linkSet(sym){
  const plain = sym.replace(/^KRX:/, "");
  const isKR = /^KRX:/.test(sym);

  const google = `https://news.google.com/search?q=${encodeURIComponent(sym + " stock")}&hl=ko&gl=KR&ceid=KR:ko`;
  const yahoo  = isKR
    ? `https://finance.yahoo.com/quote/${encodeURIComponent(plain)}.KS`
    : `https://finance.yahoo.com/quote/${encodeURIComponent(sym)}`;
  const naver  = isKR
    ? `https://finance.naver.com/item/main.nhn?code=${encodeURIComponent(plain)}`
    : `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(sym + " 주가")}`;

  return [
    { label: "Google 뉴스", href: google },
    { label: "Yahoo Finance", href: yahoo },
    { label: "네이버", href: naver }
  ];
}
function newsLinks(sym){
  // 빠른 접근 링크 모음 (테이블 대신 리스트)
  const google = `https://news.google.com/search?q=${encodeURIComponent(sym + " stock")}&hl=ko&gl=KR&ceid=KR:ko`;
  const yahoo  = `https://finance.yahoo.com/quote/${encodeURIComponent(sym.replace(/^KRX:/,"") + (/^KRX:/.test(sym)?".KS":""))}/news`;
  const naver  = /^KRX:/.test(sym)
    ? `https://finance.naver.com/item/news_news.nhn?code=${encodeURIComponent(sym.replace(/^KRX:/,""))}`
    : `https://search.naver.com/search.naver?where=news&query=${encodeURIComponent(sym + " 주가")}`;

  return [
    { label: "Google News 검색", href: google },
    { label: "Yahoo Finance News", href: yahoo },
    { label: "네이버 뉴스", href: naver }
  ];
}

/* ========= TradingView Advanced Chart =========
   - tv.js 로딩 후 위젯 생성
   - 새 심볼 적용 시 컨테이너 비우고 재생성 */
function waitForTradingView(){
  return new Promise((resolve)=>{
    if (window.TradingView) return resolve();
    const timer = setInterval(()=>{
      if(window.TradingView){ clearInterval(timer); resolve(); }
    }, 50);
  });
}
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
    theme: "dark",
    timeframe: "6M",
    style: "1",            // 1=캔들
    locale: "kr",
    autosize: true,
    hide_top_toolbar: false,
    hide_legend: false,
    withdateranges: true,
    studies: ["MASimple@tv-basicstudies"], // 기본 MA
  });
}

/* ========= 관심목록 렌더 ========= */
function renderWatchlist(){
  const list = WATCHLISTS[currentListKey];
  const ul = $("#watchlist");
  ul.innerHTML = "";
  list.forEach(s=>{
    const li = document.createElement("li");
    li.textContent = s.replace(/^KRX:/,"KRX·");
    if (normalizeSymbol(s) === currentSymbol) li.classList.add("active");
    li.addEventListener("click", ()=>{
      setSymbol(s);
    });
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
  // 상단 퀵링크
  const links = linkSet(sym).map(l => `<a target="_blank" rel="noopener" href="${l.href}">${l.label}</a>`).join("");
  $("#quickLinks").innerHTML = links;
  // 뉴스 링크
  const news = newsLinks(sym).map(l => `<li><a target="_blank" rel="noopener" href="${l.href}">${l.label}</a></li>`).join("");
  $("#newsLinks").innerHTML = news;
  // 노트 로드
  loadNote(sym);
  // 차트 렌더
  renderChart(sym);
}

/* ========= 탭 전환 ========= */
function setTab(btn){
  $$(".tab-btn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");

  $$(".tab-content").forEach(c=>c.classList.remove("active"));
  $("#tab-" + btn.dataset.tab).classList.add("active");
}

/* ========= 위젯(스크리너/캘린더) 붙이기 =========
   TradingView Market Data Widgets: embed JSON 스니펫을 동적 삽입 */
function mountScreener(){
  const mount = $("#screenerMount");
  mount.innerHTML = "";
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";
  script.async = true;
  script.innerHTML = JSON.stringify({
    "width": "100%",
    "height": 420,
    "defaultColumn": "overview",
    "defaultScreen": "general",
    "market": "america",
    "showToolbar": true,
    "colorTheme": "dark",
    "locale": "kr"
  });
  mount.appendChild(script);
}

function mountCalendar(){
  const mount = $("#calendarMount");
  mount.innerHTML = "";
  const script = document.createElement("script");
  script.type = "text/javascript";
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
  script.async = true;
  script.innerHTML = JSON.stringify({
    "colorTheme": "dark",
    "isTransparent": false,
    "width": "100%",
    "height": 420,
    "locale": "kr",
    "importanceFilter": "-1,0,1" // 전부
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

/* ========= 노트 자동 저장 ========= */
function noteKey(sym){ return "note:" + sym; }
function loadNote(sym){
  const val = localStorage.getItem(noteKey(sym)) || "";
  $("#noteArea").value = val;
  $("#noteSaved").textContent = val ? "자동 저장됨" : "작성 후 자동 저장";
}
let noteTimer = null;
$("#noteArea")?.addEventListener("input", ()=>{
  if(noteTimer) clearTimeout(noteTimer);
  noteTimer = setTimeout(()=>{
    localStorage.setItem(noteKey(currentSymbol), $("#noteArea").value);
    $("#noteSaved").textContent = "자동 저장됨";
  }, 400);
});

/* ========= 이벤트 바인딩 ========= */
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
(async function init(){
  // 탭 초기 위젯
  mountScreener();
  mountCalendar();

  // TV 로드 대기 후 차트
  await waitForTradingView();
  setSymbol(DEFAULT_SYMBOL);

  // 관심목록 초기 렌더
  renderWatchlist();
})();
