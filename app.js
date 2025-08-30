/***** 전일 종가 코드 생성 모듈 *****/

// ✅ Alpha Vantage 키 (필요 시 수정)
const AV_API_KEY = "4L2KP1QEQ5C01C8Y"; // 형의 키
// 일일/분당 제한에 안전: 본 모듈은 "심볼당 하루 1회"만 호출 & 로컬 캐시

// 로컬 캐시 (24시간)
const CODE_CACHE_TTL = 24 * 60 * 60 * 1000;
function codeCacheKey(sym){ return `prevclose:${sym}`; }
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

// Alpha Vantage에서 전일 종가 얻기 (최신 가용 일자)
async function fetchPrevClose(symbol){
  const cached = loadPrevClose(symbol);
  if(cached) return cached;

  const url = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&symbol=${encodeURIComponent(symbol)}&apikey=${AV_API_KEY}&outputsize=compact`;
  const res = await fetch(url);
  const json = await res.json();
  const key = Object.keys(json).find(k => k.includes("Time Series"));
  if(!key) throw new Error(`데이터 없음(${symbol})`);
  const series = json[key]; // { 'YYYY-MM-DD': { '4. close': '...' } }

  // 가장 최근 날짜
  const dates = Object.keys(series).sort(); // 오름차순
  const lastDate = dates[dates.length - 1];
  const close = parseFloat(series[lastDate]["4. close"]);

  const payload = { date: lastDate, close };
  savePrevClose(symbol, payload);
  return payload;
}

// 통화/숫자 규칙
function isKR(sym){ return /^KRX:/i.test(sym) || /^\d{6}$/.test(sym); }
function formatPriceInt(close, kr){
  if(kr){
    // KRW: 소수점 없이 반올림 제거(대부분 정수)
    return Math.round(close).toString();
  } else {
    // USD: 소수점 제거(센트 단위) = 소수 둘째 자리까지 고정 후 점 제거
    return close.toFixed(2).replace(".", "");
  }
}
function currencyLetter(sym){ return isKR(sym) ? "W" : "D"; }
function dateCompact(yyyy_mm_dd){ return yyyy_mm_dd.replaceAll("-", ""); }

// 코드 조합: 001X가격D/W날짜  (예: 001X23745D20250830)
function buildCode(uniqueNumber, priceInt, curLetter, yyyymmdd){
  return `${uniqueNumber}X${priceInt}${curLetter}${yyyymmdd}`;
}

// AES-GCM 암호화/복호화 (비번 기반)
async function deriveKey(password, salt){
  const enc = new TextEncoder();
  const keyMat = await crypto.subtle.importKey(
    "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMat, { name: "AES-GCM", length: 256 }, false, ["encrypt","decrypt"]
  );
}
function b64encode(buf){ return btoa(String.fromCharCode(...new Uint8Array(buf))); }
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
  // 저장 편의: base64(salt) . base64(iv) . base64(cipher)
  return `${b64encode(salt)}.${b64encode(iv)}.${b64encode(ct)}`;
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

// UI 바인딩
const elSym   = $("#codeSymbol");
const elUse   = $("#useActiveBtn");
const elNum   = $("#uniqueNumber");
const elPlain = $("#plainCode");
const elPwd   = $("#encPassword");
const elEnc   = $("#encOutput");
const elGen   = $("#genCodeBtn");
const elDec   = $("#decCodeBtn");
const elStat  = $("#codeStatus");
const elMid   = $("#midCountdown");

// 현재 차트 심볼 가져오기 (기존 setSymbol/normalizeSymbol과 연계)
function getActiveSymbolText(){
  const t = $("#activeSymbol")?.textContent?.trim();
  return t || DEFAULT_SYMBOL;
}

// 전일 종가로 코드 생성
async function generateCode(){
  try{
    elStat.textContent = "상태: 전일 종가 조회 중…";
    let symRaw = elSym.value.trim() || getActiveSymbolText();
    const sym = normalizeSymbol(symRaw);
    elSym.value = sym; // 보정 표시

    const uniq = (elNum.value || "").trim();
    if(!/^[A-Za-z0-9]{3}$/.test(uniq)){
      elStat.textContent = "상태: 고유 넘버를 3자리 영문/숫자로 입력해줘 (예: 001)";
      return;
    }

    const { date, close } = await fetchPrevClose(sym);
    const priceInt = formatPriceInt(close, isKR(sym));
    const cur = currencyLetter(sym);
    const ymd = dateCompact(date);

    const code = buildCode(uniq, priceInt, cur, ymd);
    elPlain.value = code;
    elStat.textContent = `상태: 생성 완료 (${date} 종가 사용)`;

    // 선택 암호화
    if(elPwd.value){
      const enc = await encryptText(code, elPwd.value);
      elEnc.value = enc || "";
      elStat.textContent += " · 암호화 저장 완료";
    } else {
      elEnc.value = "";
    }

    // 오늘 생성한 최신 코드 로컬 저장
    localStorage.setItem("lastCodePlain", code);
    localStorage.setItem("lastCodeSymbol", sym);
    localStorage.setItem("lastCodeDate", date);
  }catch(e){
    elStat.textContent = "상태: 에러 - " + e.message;
  }
}

// 복호화 (암호화 코드 → 평문 코드)
async function decryptCode(){
  try{
    if(!elPwd.value){ elStat.textContent = "상태: 비밀번호를 입력해줘"; return; }
    if(!elEnc.value){ elStat.textContent = "상태: 암호화 코드가 비어있어"; return; }
    const plain = await decryptText(elEnc.value.trim(), elPwd.value);
    elPlain.value = plain;
    elStat.textContent = "상태: 복호화 완료";
  }catch(e){
    elStat.textContent = "상태: 복호화 실패 - " + e.message;
  }
}

// 자정(KST 기준 로컬) 자동 새로고침
function msUntilNextMidnight(){
  const now = new Date();
  const next = new Date(now);
  next.setHours(24,0,0,0); // 로컬 자정
  return next - now;
}
function scheduleMidnightReload(){
  function updateCountdown(){
    const ms = msUntilNextMidnight();
    const sec = Math.floor(ms/1000)%60;
    const min = Math.floor(ms/1000/60)%60;
    const hr  = Math.floor(ms/1000/60/60);
    elMid.textContent = `${String(hr).padStart(2,"0")}:${String(min).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  }
  updateCountdown();
  setInterval(updateCountdown, 1000);

  setTimeout(()=> location.reload(), msUntilNextMidnight() + 500); // 여유 0.5초
}

// 버튼 바인딩
elUse?.addEventListener("click", ()=>{
  elSym.value = getActiveSymbolText();
});
elGen?.addEventListener("click", generateCode);
elDec?.addEventListener("click", decryptCode);

// 초기값 & 스케줄
(function initCodeBox(){
  // 초기 심볼/넘버 자동 채움
  elSym.value = getActiveSymbolText();
  if(!elNum.value) elNum.value = "001";

  // 페이지 로드 시 오늘 코드가 없다면 자동 생성 시도 (조용히)
  generateCode();

  // 자정 리로드 예약
  scheduleMidnightReload();
})();
