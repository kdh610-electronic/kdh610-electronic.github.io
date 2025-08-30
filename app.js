// 형의 Alpha Vantage 키로 교체해줘
const API_KEY = "4L2KP1QEQ5C01C8Y"; // <- 형 키
const SYMBOL = "AAPL"; // 보고 싶은 종목 심볼 (미국 주식 예시). 국내면 다른 소스 필요.

let chart;

async function fetchSeries(mode) {
  // mode: DAILY | WEEKLY | MONTHLY
  const fnMap = {
    DAILY: "TIME_SERIES_DAILY",
    WEEKLY: "TIME_SERIES_WEEKLY",
    MONTHLY: "TIME_SERIES_MONTHLY"
  };
  const fn = fnMap[mode] || fnMap.DAILY;

  const url = `https://www.alphavantage.co/query?function=${fn}&symbol=${SYMBOL}&apikey=${API_KEY}&outputsize=compact`;
  const res = await fetch(url);
  const data = await res.json();

  const key = Object.keys(data).find(k => k.includes("Time Series"));
  if (!key) throw new Error("데이터를 불러오지 못했어: " + JSON.stringify(data).slice(0,120));

  const series = data[key]; // { '2025-08-29': { '1. open': '...', ... }, ... }
  const entries = Object.entries(series)
    .sort((a,b) => new Date(a[0]) - new Date(b[0])); // 날짜 오름차순

  // 최근 1년만
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const labels = [];
  const closes = [];

  for (const [date, ohlc] of entries) {
    const d = new Date(date);
    if (d >= oneYearAgo) {
      labels.push(date);
      closes.push(parseFloat(ohlc["4. close"]));
    }
  }

  return { labels, closes };
}

async function draw(mode = "DAILY") {
  const ctx = document.getElementById("chart").getContext("2d");
  const { labels, closes } = await fetchSeries(mode);

  if (chart) chart.destroy();
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [{
        label: `${SYMBOL} (${mode})`,
        data: closes,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2
      }]
    },
    options: {
      responsive: true,
      scales: {
        x: { ticks: { maxTicksLimit: 8 } },
        y: { beginAtZero: false }
      }
    }
  });
}

function loadData(mode) { draw(mode); }

// 처음 로드 시 일봉
draw("DAILY").catch(err => alert(err.message));
