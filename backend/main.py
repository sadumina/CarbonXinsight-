# main.py — CarbonXInsight (PDF ONLY Version)

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import camelot
import pandas as pd
import re
from typing import Optional, Dict, Any, List
from db import charcoal_collection  # Mongo collection
from typing import List
from fastapi import Query

PRODUCT = "Coconut Shell Charcoal"

app = FastAPI(title="CarbonXInsight – PDF Analytics (CSC only)")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # change later to your frontend
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------
# Helper
# ---------------------
DATE_RX = re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")

def clean_to_float(val):
    val = re.sub(r"[^\d.]", "", str(val)).strip()
    if val == "" or val.replace(".", "") == "":
        return None
    try:
        return float(val)
    except:
        return None


# ----------------------------------------------------------------------------
# ✅ Upload PDF → extract ONLY "Coconut Shell Charcoal"
# ----------------------------------------------------------------------------
@app.post("/upload")
async def upload_pdf(pdf: List[UploadFile] = File(...)):
    total_rows = 0
    processed_files = []

    for file in pdf:
        try:
            path = f"./{file.filename}"
            with open(path, "wb") as f:
                f.write(file.file.read())

            tables = camelot.read_pdf(path, pages="all", flavor="stream")
            grouped_docs = []

            for tbl in tables:
                df = tbl.df

                # detect row with dates
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

                for _, row in df.iloc[date_row_idx + 1:].iterrows():
                    product = str(row[0]).strip()
                    country = str(row[1]).strip()

                    if product == "" or product.lower().startswith("source"):
                        break

                    if "coconut shell charcoal" not in product.lower():
                        continue

                    prices = []
                    cells = row.to_list()[2:2 + len(dates)]
                    for idx, raw in enumerate(cells):
                        price = clean_to_float(raw)
                        if price is None:
                            continue
                        prices.append({"date": dates[idx], "price": price})

                    if not prices:
                        continue

                    grouped_docs.append({
                        "product": PRODUCT,
                        "country": country,
                        "prices": prices,
                        "month": prices[0]["date"].month,
                        "year": prices[0]["date"].year,
                        "source_pdf": file.filename
                    })

            if grouped_docs:
                charcoal_collection.insert_many(grouped_docs)
                total_rows += len(grouped_docs)
                processed_files.append(file.filename)

        except Exception as e:
            print("❌ PDF Error:", e)

    return {
        "message": "✅ Upload completed",
        "files_processed": processed_files,
        "total_rows_imported": total_rows
    }



# ----------------------------------------------------------------------------
# ✅ List countries for dropdown
# ----------------------------------------------------------------------------
@app.get("/countries")
def list_countries():
    return sorted(charcoal_collection.distinct("country", {"product": PRODUCT}))


# ----------------------------------------------------------------------------
# ✅ Time-series endpoint — used by frontend line chart
# ----------------------------------------------------------------------------
@app.get("/series")
def series(countries: List[str] = Query(default=[])):
    match = {"product": PRODUCT}
    if countries:
        match["country"] = {"$in": countries}

    pipeline = [
        {"$match": match},
        {"$unwind": "$prices"},
        {"$project": {
            "_id": 0,
            "country": 1,
            "date": "$prices.date",
            "price": "$prices.price",
        }},
        {"$sort": {"country": 1, "date": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))


# ----------------------------------------------------------------------------
# ✅ KPI (min/max/avg/change % per country)
# ----------------------------------------------------------------------------
@app.get("/analytics/country-kpis")
def country_kpis(country: str):
    pipeline = [
        {"$match": {"product": PRODUCT, "country": country}},
        {"$unwind": "$prices"},
        {"$sort": {"prices.date": 1}},
        {"$group": {
            "_id": "$country",
            "min": {"$min": "$prices.price"},
            "max": {"$max": "$prices.price"},
            "avg": {"$avg": "$prices.price"},
            "start": {"$first": "$prices.price"},
            "end": {"$last": "$prices.price"},
        }},
        {"$project": {
            "_id": 0,
            "country": "$_id",
            "min": 1, "max": 1, "avg": 1,
            "change_pct": {
                "$multiply": [
                    {"$divide": [{"$subtract": ["$end", "$start"]}, "$start"]},
                    100,
                ]
            }
        }}
    ]
    return list(charcoal_collection.aggregate(pipeline))

# -------------------------------------------------------
# ✅ Market KPI summary (Min / Max / Avg / MoM Change)
# -------------------------------------------------------
@app.get("/analytics/market-kpis")
async def market_kpis():
    pipeline = [
        {"$match": {"product": PRODUCT}},   # only CSC
        {"$unwind": "$prices"},
        {"$sort": {"prices.date": 1}},
        {"$group": {
            "_id": "$country",
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "avg_price": {"$avg": "$prices.price"},
            "first_price": {"$first": "$prices.price"},
            "last_price": {"$last": "$prices.price"},
        }},
        {"$project": {
            "_id": 0,
            "country": "$_id",
            "min_price": 1,
            "max_price": 1,
            "avg_price": {"$round": ["$avg_price", 2]},
            "change_pct": {
                "$cond": [
                    {"$eq": ["$first_price", 0]},
                    None,
                    {"$multiply": [
                        {"$divide": [{"$subtract": ["$last_price", "$first_price"]}, "$first_price"]},
                        100
                    ]}
                ]
            },
        }},
        {"$sort": {"country": 1}}
    ]

    return list(charcoal_collection.aggregate(pipeline))

# ✅ GLOBAL MARKET KPI SUMMARY (Min, Max, Overall Change %)

# --- replace the existing /analytics/current-kpis with this (PDF-friendly) ---


@app.get("/analytics/current-kpis")
def current_kpis(countries: List[str] = Query(default=[])):
    """
    For each country (optionally filtered), compute:
    - min, max over the full series
    - current (last) price
    - change_pct from first to current
    - last_date (for display)
    """
    match = {"product": PRODUCT}
    if countries:
        match["country"] = {"$in": countries}

    pipeline = [
        {"$match": match},
        {"$unwind": "$prices"},
        {"$sort": {"prices.date": 1}},
        {"$group": {
            "_id": "$country",
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "first_price": {"$first": "$prices.price"},
            "last_price": {"$last": "$prices.price"},
            "last_date":  {"$last": "$prices.date"}
        }},
        {"$project": {
            "_id": 0,
            "country": "$_id",
            "min":  {"$round": ["$min_price", 2]},
            "max":  {"$round": ["$max_price", 2]},
            "current": {"$round": ["$last_price", 2]},
            "last_date":  "$last_date",
            "change_pct": {
                "$cond": [
                    {"$or": [{"$eq": ["$first_price", 0]}, {"$eq": ["$first_price", None]}]},
                    None,
                    {"$round": [
                        {"$multiply": [
                            {"$divide": [{"$subtract": ["$last_price", "$first_price"]}, "$first_price"]},
                            100
                        ]},
                        2
                    ]}
                ]
            }
        }},
        {"$sort": {"country": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))

# ----------------------------------------------------------------------------
# ✅ TEST + CLEAR
# ----------------------------------------------------------------------------
@app.get("/test-db")
def test_db():
    return {"ok": True, "count": charcoal_collection.count_documents({"product": PRODUCT})}

@app.delete("/clear-data")
def clear_data():
    deleted = charcoal_collection.delete_many({"product": PRODUCT})
    return {"deleted": deleted.deleted_count}

@app.get("/")
def root():
    return {"message": "PDF-only backend running ✅"}
