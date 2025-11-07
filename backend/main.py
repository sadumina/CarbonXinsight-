# ---------------------------------------------------------
# ✅ CarbonXInsight Backend (PDF + Excel + Time Filter)
# ---------------------------------------------------------

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime
import camelot
import pandas as pd
import re
from db import charcoal_collection  # Mongo collection


# ─────────────────────────────────────────────
# CONSTANT
# ─────────────────────────────────────────────
PRODUCT = "Coconut Shell Charcoal"
DATE_RX = re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")  # Matches 12/10/23, 1/1/2024 etc.


# ─────────────────────────────────────────────
# INITIALIZE API
# ─────────────────────────────────────────────
app = FastAPI(title="✅ CarbonXInsight — Market Analytics Dashboard")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Change later to frontend domain
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------
# Helpers
# ---------------------------------------------------------
def clean_to_float(val):
    """Remove commas & convert price to float safely."""
    val = re.sub(r"[^\d.]", "", str(val)).strip()
    try:
        return float(val)
    except:
        return None


def normalize_country(raw: str):
    """
    ✅ Keep full country name including details inside parentheses.
    - Only remove trailing spaces
    - Do NOT remove text inside parentheses
    Example:
        "India (Domestic, Tamil Nadu)"  ✅ stays the same
        "Indonesia (FOB)"               ✅ stays the same
    """
    if not raw:
        return None

    raw = raw.strip()

    # Fix formatting: remove double spaces
    raw = " ".join(raw.split())

    return raw




# ---------------------------------------------------------
# ✅ PDF Upload & Extract Coconut Shell Charcoal rows
# ---------------------------------------------------------
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

                # Find dates row
                date_row_idx = None
                dates = []

                for i, row in df.iterrows():
                    hits = [c for c in row if DATE_RX.search(str(c))]
                    if len(hits) >= 2:  # at least 2 dates
                        date_row_idx = i
                        dates = [pd.to_datetime(d, dayfirst=True) for d in hits]
                        break

                if not dates:
                    continue

                # Read rows below date row (product + price rows)
                for _, row in df.iloc[date_row_idx + 1:].iterrows():
                    product = str(row[0]).strip()
                    raw_country = str(row[1]).strip()

                    if product == "" or product.lower().startswith("source"):
                        break

                    if "coconut shell charcoal" not in product.lower():
                        continue  # skip different product

                    country = normalize_country(raw_country)
                    prices = []

                    for idx, raw_price in enumerate(row.to_list()[2:2 + len(dates)]):
                        price = clean_to_float(raw_price)
                        if price:
                            prices.append({"date": dates[idx], "price": price})

                    if prices:
                        grouped_docs.append({
                            "product": PRODUCT,
                            "country": country,
                            "prices": prices,
                            "month": prices[0]["date"].month,
                            "year": prices[0]["date"].year,
                            "source_pdf": file.filename,
                        })

            if grouped_docs:
                charcoal_collection.insert_many(grouped_docs)
                total_rows += len(grouped_docs)
                processed_files.append(file.filename)

        except Exception as e:
            print("❌ PDF Parsing Error:", e)

    return {
        "message": "✅ PDF Upload completed",
        "files_processed": processed_files,
        "total_rows_imported": total_rows,
    }


# ---------------------------------------------------------
# ✅ Excel Upload (Supervisor Request)
# ---------------------------------------------------------
@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    if not file.filename.endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload a .xlsx or .xls file")

    df = pd.read_excel(file.file, sheet_name="Data")

    required_cols = ["Country", "Product", "Date", "Price"]
    if not all(col in df.columns for col in required_cols):
        raise HTTPException(status_code=400, detail="Excel format incorrect")

    docs = []

    for _, row in df.iterrows():
        docs.append({
            "product": PRODUCT,
            "country": normalize_country(row["Country"]),
            "prices": [{"date": pd.to_datetime(row["Date"]), "price": float(row["Price"])}],
            "source_excel": file.filename,
        })

    charcoal_collection.insert_many(docs)

    return {"message": "✅ Excel upload successful", "rows_inserted": len(docs)}


# ---------------------------------------------------------
# ✅ List Countries for Filters
# ---------------------------------------------------------
@app.get("/countries")
def list_countries():
    return sorted(charcoal_collection.distinct("country", {"product": PRODUCT}))


# ---------------------------------------------------------
# ✅ Time Series + Dynamic Filtering (Country + Date range)
# ---------------------------------------------------------
@app.get("/series")
async def get_series(
    product: str = PRODUCT,
    countries: str | None = None,
    fromDate: str | None = None,
    toDate: str | None = None,
):
    match_stage = {"product": product}

    if countries:
        match_stage["country"] = {"$in": countries.split(",")}

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

    pipeline.extend([
        {"$sort": {"prices.date": 1}},
        {"$project": {"_id": 0, "country": "$country", "date": "$prices.date", "price": "$prices.price"}},
    ])

    return list(charcoal_collection.aggregate(pipeline))


# ---------------------------------------------------------
# ✅ Market KPI Summary (Min / Max / Avg / Delta%)
# ---------------------------------------------------------
@app.get("/analytics/market-kpis")
async def market_kpis():
    pipeline = [
        {"$match": {"product": PRODUCT}},
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
                "$round": [
                    {"$multiply": [
                        {"$divide": [{"$subtract": ["$last_price", "$first_price"]}, "$first_price"]},
                        100,
                    ]},
                    2
                ]
            }
        }},
    ]

    return list(charcoal_collection.aggregate(pipeline))


# ---------------------------------------------------------
# Utilities
# ---------------------------------------------------------
@app.get("/test-db")
def test_db():
    return {"ok": True, "count": charcoal_collection.count_documents({"product": PRODUCT})}


@app.delete("/clear-data")
def clear_data():
    deleted = charcoal_collection.delete_many({"product": PRODUCT})
    return {"deleted": deleted.deleted_count}


@app.get("/")
def root():
    return {"message": "✅ CarbonXInsight backend running (PDF + EXCEL)"}
