import yfinance as yf
from datetime import datetime
import os

# 관심 종목
symbols = ["QQQ", "FIG", "KO"]

today = datetime.now().strftime("%Y%m%d")
index_file = "index.html"

# 기존 데이터 읽기
data_dict = {s: [] for s in symbols}

if os.path.exists(index_file):
    with open(index_file, "r", encoding="utf-8") as f:
        content = f.read()
    for symbol in symbols:
        start_marker = f"<!-- {symbol} START -->"
        end_marker = f"<!-- {symbol} END -->"
        if start_marker in content and end_marker in content:
            raw = content.split(start_marker)[1].split(end_marker)[0].strip().splitlines()
            data_dict[symbol] = [line.strip() for line in raw if line.strip()]

# 새 데이터 가져오기
for symbol in symbols:
    stock = yf.Ticker(symbol)
    data = stock.history(period="1d")
    if not data.empty:
        price = round(float(data["Close"].iloc[-1]), 2)
        new_line = f"{symbol},{price},{today}"
    else:
        new_line = f"{symbol},N/A,{today}"

    # 같은 날짜 데이터 중복 방지
    if not any(today in entry for entry in data_dict[symbol]):
        data_dict[symbol].append(new_line)

    # 30개만 유지
    if len(data_dict[symbol]) > 30:
        data_dict[symbol] = data_dict[symbol][-30:]

# index.html 새로 작성
with open(index_file, "w", encoding="utf-8") as f:
    f.write("<!DOCTYPE html>\n<html lang='ko'>\n<head>\n")
    f.write("  <meta charset='UTF-8'>\n")
    f.write("  <title>관심 주식 기록</title>\n")
    f.write("  <link rel='stylesheet' href='style.css'>\n")
    f.write("  <script src='https://cdn.jsdelivr.net/npm/chart.js'></script>\n")
    f.write("</head>\n<body>\n")
    f.write("  <header>\n")
    f.write("    <h1>📈 관심 주식 기록 (최근 30일)</h1>\n")
    f.write("    <p>GitHub Actions가 매일 00시에 자동 업데이트</p>\n")
    f.write("  </header>\n")
    f.write("  <main>\n")
    f.write("    <section id='tables'></section>\n")
    f.write("    <section id='charts'></section>\n")
    f.write("    <section id='logs'>\n")
    f.write("      <h2>📜 Raw Logs</h2>\n")
    for symbol in symbols:
        f.write(f"      <h3>{symbol}</h3>\n")
        f.write(f"      <!-- {symbol} START -->\n")
        for entry in data_dict[symbol]:
            f.write(f"      {entry}\n")
        f.write(f"      <!-- {symbol} END -->\n")
    f.write("    </section>\n")
    f.write("  </main>\n")
    f.write("  <footer><p>Powered by GitHub Actions & yfinance</p></footer>\n")
    f.write("  <script src='script.js'></script>\n")
    f.write("</body>\n</html>\n")
