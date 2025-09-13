import yfinance as yf
from datetime import datetime
import os

# 관심 종목 목록
symbols = ["QQQ", "FIG", "KO"]

today = datetime.now().strftime("%Y%m%d")

# 데이터 저장용 딕셔너리
data_dict = {s: [] for s in symbols}

# 기존 index.html에서 데이터 읽어오기
if os.path.exists("index.html"):
    with open("index.html", "r", encoding="utf-8") as f:
        lines = f.readlines()
        for symbol in symbols:
            start = False
            for line in lines:
                if f"<!-- {symbol} START -->" in line:
                    start = True
                    continue
                if f"<!-- {symbol} END -->" in line:
                    start = False
                if start and line.strip():
                    data_dict[symbol].append(line.strip())

# 오늘 데이터 추가
for symbol in symbols:
    stock = yf.Ticker(symbol)
    data = stock.history(period="1d")
    if not data.empty:
        price = round(float(data["Close"].iloc[-1]), 2)
        new_line = f"{symbol},{price},{today}"
    else:
        new_line = f"{symbol},N/A,{today}"

    # 중복 방지 (같은 날짜 데이터가 이미 있으면 업데이트)
    if not any(today in entry for entry in data_dict[symbol]):
        data_dict[symbol].append(new_line)

    # 최대 30줄 유지
    if len(data_dict[symbol]) > 30:
        data_dict[symbol] = data_dict[symbol][-30:]

# HTML 다시 작성
with open("index.html", "w", encoding="utf-8") as f:
    f.write("<!DOCTYPE html><html><head><meta charset='UTF-8'>\n")
    f.write("<title>Stock Data</title></head><body>\n")
    f.write("<h1>📈 Stock Data Log (Last 30 days)</h1>\n")

    for symbol in symbols:
        f.write(f"<h2>{symbol}</h2>\n")
        f.write(f"<!-- {symbol} START -->\n")
        for entry in data_dict[symbol]:
            f.write(entry + "\n")
        f.write(f"<!-- {symbol} END -->\n")

    f.write("</body></html>\n")
