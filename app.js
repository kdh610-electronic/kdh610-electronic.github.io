const DEFAULT_SYMBOL = "AAPL";

const $ = (sel) => document.querySelector(sel);
const $$ = (sel) => document.querySelectorAll(sel);

/* KRX 코드/심볼 정규화
   - 6자리 숫자 => KRX:코드
   - krx:접두사 허용, 대문자 변환
   - 그 외는 그대로 대문자 */
function normalizeSymbol(input){
  if(!input) return DEFAULT_SYMBOL;
  let s = input.trim();
  if (/^KRX:/i.test(s)) return "KRX:" + s.split(":")[1].toUpperCase();
  if (/^\d{6}$/.test(s)) return "KRX:" + s; // 005930 형태
  return s.toUpperCase();
}

function renderChart(sym){
  $("#chartContainer").innerHTML = "";
  const containerId = "tv_chart_" + Date.now();
  const slot = document.createElement("div");
  slot.id = containerId;
  slot.style.height = "100%";
  $("#chartContainer").appendChild(slot);

  new TradingView.widget({
    container_id: containerId,
    symbol: sym,
    interval: "D",
    timeframe: "6M",        // ★ 기본 6개월
    theme: "dark",
    style: "1",             // 1 = 캔들
    locale: "kr",
    autosize: true,
    withdateranges: true,
    hide_top_toolbar: false,
    hide_legend: false,
    studies: ["MASimple@tv-basicstudies"] // 기본 이동평균 1개
  });
}

function setSymbol(raw){
  const sym = normalizeSymbol(raw);
  $("#activeSymbol").textContent = sym;
  renderChart(sym);
}

function bind(){
  $("#applyBtn").addEventListener("click", ()=>{
    const v = $("#symbolInput").value;
    if(!v) return;
    setSymbol(v);
  });
  $("#symbolInput").addEventListener("keydown", (e)=>{
    if(e.key === "Enter") $("#applyBtn").click();
  });
  $$(".chip").forEach(ch => {
    ch.addEventListener("click", ()=> setSymbol(ch.dataset.sym));
  });
}

(function init(){
  bind();
  setSymbol(DEFAULT_SYMBOL);
})();
