/* ========= 기본 설정 ========= */
const DEFAULT_SYMBOL = "AAPL";
const AV_API_KEY = "4L2KP1QEQ5C01C8Y"; // Alpha Vantage API 키

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
  if (/^\d{6}$/.test(s)) return "KRX:" + s; // 한국 6자리 코드
  return s.toUpperCase();
}

/* ========= 뉴스 링크 ========= */
function linkSet(sym){
  const plain = sym.replace(/^KRX:/,"");
  const isKR = /^KRX:/.test(sym);
  const google = `https://news.google.com/search?q=${encodeURIComponent(sym + " stock")}&hl=ko&gl=KR&ceid=KR:ko`;
  const yahooQuote = isKR ? `https://finance.yahoo.com/quote/${plain}.KS` : `https://finance.yahoo.com/quote/${sym}`;
  const naverQuote = isKR ? `https://finance.naver.com/item/main.nhn?code=${plain}` : `https://search.naver.com/search.naver?query=${sym}+주가`;
  return { google, yahooQuote, naverQuote };
}
function buildNewsTable(sym){
  const { google, yahooQuote, naverQuote } = linkSet(sym);
  const rows = [
    { label: "Google News", href: google },
    { label: "Yahoo Finance", href: yahooQuote + "/news" },
    { label: "네이버 뉴스", href: /^KRX:/.test(sym) ? `https://finance.naver.com/item/news_news.nhn?code=${sym.replace(/^KRX:/,"")}` : `https://search.naver.com/search.naver?query=${sym}+주가` }
  ];
  $("#newsTableBody").innerHTML = rows.map(r => `<tr><td>${r.label}</td><td><a target="_blank" rel="noopener" href="${r.href}">열기</a></td></tr>`).join("");
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
    timeframe: "6M",       // 기본 6개월
    theme: "dark",
    style: "1",
    locale: "kr",
    autosize: true,
    withdateranges: true,
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
  const { google, yahooQuote, naverQuote } = linkSet(sym);
  $("#quickLinks").innerHTML = `
    <a target="_blank" href="${yahooQuote}">Quote</a>
    <a target="_blank" href="${google}">News</a>
    <a target="_blank" href="${naverQuote}">국내</a>`;
  buildNewsTable(sym);
  renderChart(sym);
}

/* ========= 탭 ========= */
function setTab(btn){
  $$(".tab-btn").forEach(b=>b.classList.remove("active"));
  btn.classList.add("active");
  $$(".tab-content").forEach(c=>c.classList.remove("active"));
  $("#tab-" + btn.dataset.tab).classList.add("active");
}

/* ========= 외부 위젯 ========= */
function mountScreener(){
  const mount = $("#screenerMount");
  mount.innerHTML = "";
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-screener.js";
  script.async = true;
  script.innerHTML = JSON.stringify({ width:"100%",height:420,defaultColumn:"overview",defaultScreen:"general",market:"america",showToolbar:true,colorTheme:"dark",locale:"kr" });
  mount.appendChild(script);
}
function mountCalendar(){
  const mount = $("#calendarMount");
  mount.innerHTML = "";
  const script = document.createElement("script");
  script.src = "https://s3.tradingview.com/external-embedding/embed-widget-events.js";
  script.async = true;
  script.innerHTML = JSON.stringify({ colorTheme:"dark",width:"100%",height:420,locale:"kr",importanceFilter:"-1,0,1" });
  mount.appendChild(script);
}

/* ========= 계산기 ========= */
$("#calcBtn")?.addEventListener("click", ()=>{
  const acc = parseFloat($("#accSize").value);
  const rp  = parseFloat($("#riskPct").value);
  const entry = parseFloat($("#entryPrice").value);
  const stop  = parseFloat($("#stopPrice").value);
  const out = $("#posResult");
  if([acc,rp,entry,stop].some(v => !isFinite(v))){ out.innerHTML = "입력 확인"; return; }
  const riskAmt = acc * (rp/100);
  const perShare = Math.abs(entry-stop);
  const shares = Math.floor(riskAmt/perShare);
  const posAmt = shares*entry;
  out.innerHTML = `허용 리스크 금액:${riskAmt}<br>1주당 리스크:${perShare}<br>매수 수량:${shares}<br>포지션 금액:${posAmt}`;
});
$("#avgBtn")?.addEventListener("click", ()=>{
  const p1=parseFloat($("#p1").value),q1=parseFloat($("#q1").value);
  const p2=parseFloat($("#p2").value),q2=parseFloat($("#q2").value);
  if([p1,q1,p2,q2].some(v=>!isFinite(v)||v<=0)){ $("#avgResult").textContent="입력값 확인"; return; }
  const avg=(p1*q1+p2*q2)/(q1+q2);
  $("#avgResult").textContent="평단가:"+avg.toFixed(4);
});

/* ========= 이벤트 ========= */
$("#applyBtn")?.addEventListener("click", ()=> setSymbol($("#symbolInput").value));
$("#symbolInput")?.addEventListener("keydown", e=>{ if(e.key==="Enter") $("#applyBtn").click(); });
$$(".watch-page").forEach(btn=> btn.addEventListener("click", ()=> setWatchPage(btn)));
$$(".tab-btn").forEach(btn=> btn.addEventListener("click", ()=> setTab(btn)));

/* =========================
   🔐 전일 종가 기반 암호화 코드 생성 모듈
   - 포맷: 001X가격D/W날짜 (예: 001X23745D20250830)
   - KRW: 반올림 정수 / USD: 소수 둘째자리까지 -> 점 제거
   - 매일 00:00 (로컬) 자동 새로고침
   ========================= */

// (이미 파일 상단에 AV_API_KEY가 있으면 이 줄은 삭제하세요)
const AV_API_KEY = typeof AV_API_KEY !== "undefined" ? AV_API_KEY : "4L2KP1QEQ5C01C8Y";

/* ===== 로컬 캐시 (심볼별 전일 종가, 24시간 유효) ===== */
const CODE_CACHE_TTL = 24 * 60 * 60 * 1000;
const codeCacheKey = (sym) => `prevclose:${sym}`;
function savePrevClose(sym, payload){
  localStorage.setItem(codeCacheKey(sym), JSON.stringify({ t: Date.now(), payload }));
}
function loadPrevClose(sym){
  const raw = localStorage.getItem(codeCacheKey(sym));
  if(!raw) return null;
  try{
    const obj = JSON.parse(raw);
    if(Date.now() - obj.t < CODE_CACHE_TTL) return obj.payload;
  }catch{}
  return null;
}

/* ===== Alpha Vantage: 전일 종가 ===== */
async function fetchPrevClose(symbol){
  const cached = loadPrevClose(symbol);
  if(cached) return cached;

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${AV_API_KEY}&outputsize=compact`;
  const res = await fetch(url);
  const json = await res.json();
  const key = Object.keys(json).find(k => k.includes("Time Series"));
  if(!key) throw new Error(`데이터 없음(${symbol})`);
  const series = json[key];

  const dates = Object.keys(series).sort(); // 오름차순
  const lastDate = dates[dates.length - 1];
  const close = parseFloat(series[lastDate]["4. close"]);

  const payload = { date: lastDate, close };
  savePrevClose(symbol, payload);
  return payload;
}

/* ===== 포맷 규칙 ===== */
const isKR = (sym) => /^KRX:/i.test(sym) || /^\d{6}$/.test(sym);
function formatPriceInt(close, kr){
  if(kr){
    return Math.round(close).toString();      // KRW: 정수
  } else {
    return close.toFixed(2).replace(".", ""); // USD: 소수 둘째자리 → 점 제거
  }
}
const currencyLetter = (sym) => isKR(sym) ? "W" : "D";
const dateCompact = (yyyy_mm_dd) => yyyy_mm_dd.replaceAll("-", "");
const buildCode = (uniq, priceInt, cur, yyyymmdd) => `${uniq}X${priceInt}${cur}${yyyymmdd}`;

/* ===== AES-GCM 암호화/복호화 (선택) ===== */
async function deriveKey(password, salt){
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey("raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]);
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMat, { name: "AES-GCM", length: 256 }, false, ["encrypt","decrypt"]
  );
}
const b64encode = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
function b64decode(str){
  const bin = atob(str); const buf = new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}
async function encryptText(plain, password){
  if(!password) return null;
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt);
  const ct   = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, enc.encode(plain));
  return `${b64encode(salt)}.${b64encode(iv)}.${b64encode(ct)}`; // salt.iv.ct
}
async function decryptText(pack, password){
  const [b64s, b64iv, b64ct] = (pack || "").split(".");
  if(!b64s || !b64iv || !b64ct) throw new Error("잘못된 암호화 문자열");
  const salt = new Uint8Array(b64decode(b64s));
  const iv   = new Uint8Array(b64decode(b64iv));
  const ct   = b64decode(b64ct);
  const key  = await deriveKey(password, salt);
  const pt   = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, key, ct);
  return new TextDecoder().decode(pt);
}

/* ===== DOM 참조 ===== */
const elSym   = document.querySelector("#codeSymbol");
const elUse   = document.querySelector("#useActiveBtn");
const elNum   = document.querySelector("#uniqueNumber");
const elPlain = document.querySelector("#plainCode");
const elPwd   = document.querySelector("#encPassword");
const elEnc   = document.querySelector("#encOutput");
const elGen   = document.querySelector("#genCodeBtn");
const elDec   = document.querySelector("#decCodeBtn");
const elStat  = document.querySelector("#codeStatus");
const elMid   = document.querySelector("#midCountdown");

/* 현재 차트 심볼 가져오기 */
function getActiveSymbolText(){
  const t = document.querySelector("#activeSymbol")?.textContent?.trim();
  return t || DEFAULT_SYMBOL;
}

/* ===== 코드 생성 / 복호화 ===== */
async function generateCode(){
  try{
    if(!elStat) return;
    elStat.textContent = "상태: 전일 종가 조회 중…";

    let symRaw = elSym?.value?.trim() || getActiveSymbolText();
    const sym = normalizeSymbol(symRaw);
    if(elSym) elSym.value = sym;

    const uniq = (elNum?.value || "").trim();
    if(!/^[A-Za-z0-9]{3}$/.test(uniq)){
      elStat.textContent = "상태: 고유 넘버 3자리(예: 001)를 입력해줘";
      return;
    }

    const { date, close } = await fetchPrevClose(sym);
    const priceInt = formatPriceInt(close, isKR(sym));
    const cur = currencyLetter(sym);
    const ymd = dateCompact(date);

    const code = buildCode(uniq, priceInt, cur, ymd);
    if(elPlain) elPlain.value = code;
    elStat.textContent = `상태: 생성 완료 (${date} 종가 사용)`;

    if(elPwd?.value){
      const enc = await encryptText(code, elPwd.value);
      if(elEnc) elEnc.value = enc || "";
      elStat.textContent += " · 암호화 완료";
    } else {
      if(elEnc) elEnc.value = "";
    }

    localStorage.setItem("lastCodePlain", code);
    localStorage.setItem("lastCodeSymbol", sym);
    localStorage.setItem("lastCodeDate", date);
  }catch(e){
    if(elStat) elStat.textContent = "상태: 에러 - " + e.message;
  }
}

async function decryptCode(){
  try{
    if(!elPwd?.value){ if(elStat) elStat.textContent = "상태: 비밀번호를 입력해줘"; return; }
    if(!elEnc?.value){ if(elStat) elStat.textContent = "상태: 암호화 코드가 비어있어"; return; }
    const plain = await decryptText(elEnc.value.trim(), elPwd.value);
    if(elPlain) elPlain.value = plain;
    if(elStat) elStat.textContent = "상태: 복호화 완료";
  }catch(e){
    if(elStat) elStat.textContent = "상태: 복호화 실패 - " + e.message;
  }
}

/* ===== 자정(로컬) 자동 새로고침 + 카운트다운 ===== */
function msUntilNextMidnight(){
  const now = new Date();
  const next = new Date(now);
  next.setHours(24,0,0,0);
  return next - now;
}
function scheduleMidnightReload(){
  if(!elMid) return;
  function tick(){
    const ms = msUntilNextMidnight();
    const sec = Math.floor(ms/1000)%60;
    const min = Math.floor(ms/1000/60)%60;
    const hr  = Math.floor(ms/1000/60/60);
    elMid.textContent = `${String(hr).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  }
  tick();
  setInterval(tick, 1000);
  setTimeout(()=> location.reload(), msUntilNextMidnight() + 500);
}

/* ===== 버튼 바인딩 & 초기화 ===== */
elUse?.addEventListener("click", ()=> { if(elSym) elSym.value = getActiveSymbolText(); });
elGen?.addEventListener("click", generateCode);
elDec?.addEventListener("click", decryptCode);

(function initCodeBox(){
  if(!elSym) return;
  elSym.value = getActiveSymbolText();
  if(elNum && !elNum.value) elNum.value = "001";
  generateCode();              // 페이지 로드 시 1회 생성
  scheduleMidnightReload();    // 자정 자동 새로고침
})();
/* ========= 초기화 ========= */
(function init(){
  mountScreener();
  mountCalendar();
  setSymbol(DEFAULT_SYMBOL);
  renderWatchlist();
})();
