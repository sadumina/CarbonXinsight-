from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime
import camelot
import pandas as pd
import re
from db import charcoal_collection

# ─────────────────────────────────────────────
PRODUCT = "Coconut Shell Charcoal"
DATE_RX = re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")
COUNTRY_RX = re.compile(r"^([^(]+)")
MARKET_RX = re.compile(r"\((.+)\)")

# ─────────────────────────────────────────────
app = FastAPI(title="CarbonXInsight — Market Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ─────────────────────────────────────────────
def clean_to_float(val):
    val = re.sub(r"[^\d.]", "", str(val))
    try:
        return float(val)
    except:
        return None


def split_country_and_market(raw: str):
    if not raw:
        return None, None

    raw = " ".join(str(raw).split()).strip()
    country = COUNTRY_RX.match(raw).group(1).strip()
    market_match = MARKET_RX.search(raw)
    market = market_match.group(1).strip() if market_match else None
    return country, market


# ─────────────────────────────────────────────
@app.post("/upload")
async def upload_pdf(pdf: List[UploadFile] = File(...)):
    docs = []

    for file in pdf:
        path = f"./{file.filename}"
        with open(path, "wb") as f:
            f.write(file.file.read())

        tables = camelot.read_pdf(path, pages="all", flavor="stream")

        for tbl in tables:
            df = tbl.df
            date_row = None
            dates = []

            for i, row in df.iterrows():
                hits = [c for c in row if DATE_RX.search(str(c))]
                if len(hits) >= 2:
                    date_row = i
                    dates = [pd.to_datetime(d, dayfirst=True) for d in hits]
                    break

            if not dates:
                continue

            for _, row in df.iloc[date_row + 1 :].iterrows():
                product = str(row[0]).lower()
                if "coconut shell charcoal" not in product:
                    continue

                country, market = split_country_and_market(row[1])

                prices = []
                for i, raw in enumerate(row[2 : 2 + len(dates)]):
                    price = clean_to_float(raw)
                    if price:
                        prices.append({"date": dates[i], "price": price})

                if prices:
                    docs.append(
                        {
                            "product": PRODUCT,
                            "country": country,
                            "market": market,
                            "prices": prices,
                            "source_pdf": file.filename,
                        }
                    )

    if docs:
        charcoal_collection.insert_many(docs)

    return {"inserted": len(docs)}


# ─────────────────────────────────────────────
@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    df = pd.read_excel(file.file, sheet_name="Data")

    docs = []
    for _, r in df.iterrows():
        country, market = split_country_and_market(r["Country"])
        docs.append(
            {
                "product": PRODUCT,
                "country": country,
                "market": market,
                "prices": [{"date": pd.to_datetime(r["Date"]), "price": float(r["Price"])}],
                "source_excel": file.filename,
            }
        )

    charcoal_collection.insert_many(docs)
    return {"rows": len(docs)}


# ─────────────────────────────────────────────
@app.get("/series")
def get_series(
    countries: Optional[List[str]] = Query(None),
    fromDate: Optional[str] = None,
    toDate: Optional[str] = None,
):
    match = {"product": PRODUCT}
    if countries:
        match["country"] = {"$in": countries}

    pipeline = [{"$match": match}, {"$unwind": "$prices"}]

    if fromDate or toDate:
        date_filter = {}
        if fromDate:
            date_filter["$gte"] = datetime.fromisoformat(fromDate)
        if toDate:
            date_filter["$lte"] = datetime.fromisoformat(toDate)
        pipeline.append({"$match": {"prices.date": date_filter}})

    pipeline.append(
        {
            "$project": {
                "_id": 0,
                "country": 1,
                "market": 1,
                "date": "$prices.date",
                "price": "$prices.price",
            }
        }
    )

    return list(charcoal_collection.aggregate(pipeline))


# ─────────────────────────────────────────────
# ✅ NEW — MONTHLY VIEW API
# ─────────────────────────────────────────────
@app.get("/data/monthly")
def view_monthly_data(year: int, month: int):
    start = datetime(year, month, 1)
    end = datetime(year + 1, 1, 1) if month == 12 else datetime(year, month + 1, 1)

    pipeline = [
        {"$match": {"product": PRODUCT}},
        {"$unwind": "$prices"},
        {"$match": {"prices.date": {"$gte": start, "$lt": end}}},
        {
            "$project": {
                "_id": 0,
                "country": 1,
                "market": 1,
                "date": "$prices.date",
                "price": "$prices.price",
                "source": {"$ifNull": ["$source_pdf", "$source_excel"]},
            }
        },
        {"$sort": {"date": 1}},
    ]

    records = list(charcoal_collection.aggregate(pipeline))
    if not records:
        return {"records": [], "summary": None}

    prices = [r["price"] for r in records]

    return {
        "records": records,
        "summary": {
            "count": len(prices),
            "average_price": round(sum(prices) / len(prices), 2),
            "min_price": min(prices),
            "max_price": max(prices),
        },
    }


@app.get("/")
def root():
    return {"status": "CarbonXInsight running"}
