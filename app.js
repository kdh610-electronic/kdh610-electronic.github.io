async function loadData() {
  const res = await fetch("index.html"); // 자기 자신에서 데이터 읽기
  const text = await res.text();

  const parser = new DOMParser();
  const doc = parser.parseFromString(text, "text/html");

  const symbols = ["QQQ", "FIG", "KO"];
  const tablesContainer = document.getElementById("tables");
  const chartsContainer = document.getElementById("charts");

  symbols.forEach(symbol => {
    const startMarker = `<!-- ${symbol} START -->`;
    const endMarker = `<!-- ${symbol} END -->`;

    const raw = text.split(startMarker)[1].split(endMarker)[0].trim().split("\n");
    const rows = raw.map(line => {
      const [sym, price, date] = line.split(",");
      return { sym, price: parseFloat(price), date };
    });

    // 📌 테이블 생성
    const tableHTML = `
      <h2>${symbol}</h2>
      <table>
        <thead><tr><th>Date</th><th>Price</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr><td>${r.date}</td><td>${r.price}</td></tr>`).join("")}
        </tbody>
      </table>
    `;
    tablesContainer.innerHTML += tableHTML;

    // 📌 차트 생성
    const canvas = document.createElement("canvas");
    chartsContainer.appendChild(canvas);

    new Chart(canvas, {
      type: "line",
      data: {
        labels: rows.map(r => r.date),
        datasets: [{
          label: `${symbol} Price`,
          data: rows.map(r => r.price),
          borderColor: "#7248AE",
          backgroundColor: "rgba(114,72,174,0.2)",
          fill: true,
          tension: 0.3
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: true },
          title: { display: false }
        }
      }
    });
  });
}

loadData();
