from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime
# import camelot
import pandas as pd
import re

from db import charcoal_collection

# =========================================================
# CONSTANTS
# =========================================================
PRODUCT = "Coconut Shell Charcoal"

DATE_RX = re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")
COUNTRY_RX = re.compile(r"^([^(]+)")      # before "("
MARKET_RX = re.compile(r"\((.+)\)")       # inside "()"


# =========================================================
# APP INIT
# =========================================================
app = FastAPI(title="CarbonXInsight — Market Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],   # tighten in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# =========================================================
# HELPERS
# =========================================================
def clean_to_float(val):
    val = re.sub(r"[^\d.]", "", str(val)).strip()
    try:
        return float(val)
    except Exception:
        return None


def split_country_and_market(raw: str):
    """
    Examples:
      India (Domestic, Tamil Nadu)
      Sri Lanka (FOB)
      Indonesia
    """
    if not raw:
        return None, None

    raw = " ".join(str(raw).split()).strip()

    country_match = COUNTRY_RX.match(raw)
    country = country_match.group(1).strip() if country_match else raw

    market_match = MARKET_RX.search(raw)
    market = market_match.group(1).strip() if market_match else None

    return country, market


# =========================================================
# PDF UPLOAD
# =========================================================
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

            date_row_idx = None
            dates = []

            for i, row in df.iterrows():
                hits = [c for c in row if DATE_RX.search(str(c))]
                if len(hits) >= 2:
                    date_row_idx = i
                    dates = [pd.to_datetime(d, dayfirst=True) for d in hits]
                    break

            if not dates:
                continue

            for _, row in df.iloc[date_row_idx + 1 :].iterrows():
                product = str(row[0]).strip().lower()
                raw_country = str(row[1]).strip()

                if product == "" or product.startswith("source"):
                    break

                if "coconut shell charcoal" not in product:
                    continue

                country, market = split_country_and_market(raw_country)

                prices = []
                for idx, raw_price in enumerate(row.to_list()[2 : 2 + len(dates)]):
                    price = clean_to_float(raw_price)
                    if price is not None:
                        prices.append(
                            {
                                "date": dates[idx],
                                "price": price,
                            }
                        )

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

    return {
        "message": "PDF upload completed",
        "rows_inserted": len(docs),
    }


# =========================================================
# EXCEL UPLOAD
# =========================================================
@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload Excel only")

    df = pd.read_excel(file.file, sheet_name="Data")

    required = {"Country", "Product", "Date", "Price"}
    if not required.issubset(df.columns):
        raise HTTPException(status_code=400, detail="Invalid Excel format")

    docs = []

    for _, row in df.iterrows():
        country, market = split_country_and_market(row["Country"])

        docs.append(
            {
                "product": PRODUCT,
                "country": country,
                "market": market,
                "prices": [
                    {
                        "date": pd.to_datetime(row["Date"]),
                        "price": float(row["Price"]),
                    }
                ],
                "source_excel": file.filename,
            }
        )

    if docs:
        charcoal_collection.insert_many(docs)

    return {
        "message": "Excel upload successful",
        "rows_inserted": len(docs),
    }


# =========================================================
# ✅ COUNTRIES (FIXES YOUR 404)
# =========================================================
@app.get("/countries")
def list_countries():
    """
    Used by dashboard & filters
    """
    countries = charcoal_collection.distinct(
        "country",
        {"product": PRODUCT}
    )
    return sorted(countries)


# =========================================================
# TIME SERIES (DASHBOARD CHARTS)
# =========================================================
@app.get("/series")
def get_series(
    countries: Optional[List[str]] = Query(None),
    fromDate: Optional[str] = None,
    toDate: Optional[str] = None,
):
    match_stage = {"product": PRODUCT}

    if countries:
        match_stage["country"] = {"$in": countries}

    pipeline = [
        {"$match": match_stage},
        {"$unwind": "$prices"},
    ]

    if fromDate or toDate:
        date_filter = {}
        if fromDate:
            date_filter["$gte"] = datetime.fromisoformat(fromDate)
        if toDate:
            date_filter["$lte"] = datetime.fromisoformat(toDate)

        pipeline.append({"$match": {"prices.date": date_filter}})

    pipeline.extend(
        [
            {"$sort": {"prices.date": 1}},
            {
                "$project": {
                    "_id": 0,
                    "country": "$country",
                    "market": "$market",
                    "date": "$prices.date",
                    "price": "$prices.price",
                }
            },
        ]
    )

    return list(charcoal_collection.aggregate(pipeline))


# =========================================================
# ✅ VIEW DATA — MONTH BY MONTH
# =========================================================
@app.get("/data/monthly")
def get_monthly_data(year: int, month: int):
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
                "source": {
                    "$ifNull": ["$source_pdf", "$source_excel"]
                },
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
# =========================================================
# ✅ COMPARISON SUMMARY — MIN / AVG / MAX (BY COUNTRY + MARKET)
# =========================================================
@app.get("/compare/summary")
def compare_summary(fromDate: str, toDate: str):
    start = datetime.fromisoformat(fromDate)
    end = datetime.fromisoformat(toDate)

    pipeline = [
        {"$match": {"product": PRODUCT}},
        {"$unwind": "$prices"},
        {"$match": {"prices.date": {"$gte": start, "$lte": end}}},
        {
            "$group": {
                "_id": {
                    "country": "$country",
                    
                },
                "min_price": {"$min": "$prices.price"},
                "avg_price": {"$avg": "$prices.price"},
                "max_price": {"$max": "$prices.price"},
            }
        },
        {
            "$project": {
                "_id": 0,
                "country": "$_id.country",
                "market": "$_id.market",
                "min": {"$round": ["$min_price", 2]},
                "avg": {"$round": ["$avg_price", 2]},
                "max": {"$round": ["$max_price", 2]},
            }
        },
        {"$sort": {"country": 1, "market": 1}},
    ]

    return list(charcoal_collection.aggregate(pipeline))


# =========================================================
# HEALTH / ROOT
# =========================================================
@app.get("/")
def root():
    return {"status": "CarbonXInsight backend running"}
