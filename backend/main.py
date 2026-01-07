from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime
import pandas as pd
import re
import os
import uuid
from pathlib import Path
import pdfplumber

from db import charcoal_collection

# =========================================================
# STARTUP – DB CONNECTION CHECK
# =========================================================
try:
    charcoal_collection.database.command("ping")
    print("✅ MongoDB connection successful")
except Exception as e:
    print("❌ MongoDB connection failed:", e)
    raise e


# =========================================================
# CONSTANTS
# =========================================================
PRODUCT = "Coconut Shell Charcoal"

DATE_RX = re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")
COUNTRY_RX = re.compile(r"^([^(]+)")
MARKET_RX = re.compile(r"\((.+)\)")

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# APP INIT
# =========================================================
app = FastAPI(title="CarbonXInsight — Market Analytics")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # tighten in production
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
    if not raw:
        return None, None

    raw = " ".join(str(raw).split()).strip()

    country_match = COUNTRY_RX.match(raw)
    country = country_match.group(1).strip() if country_match else raw

    market_match = MARKET_RX.search(raw)
    market = market_match.group(1).strip() if market_match else None

    return country, market


def parse_date_cells_to_datetimes(cells: List[str]) -> List[datetime]:
    out = []
    for c in cells:
        try:
            out.append(pd.to_datetime(c, dayfirst=True).to_pydatetime())
        except Exception:
            pass
    return out


def extract_pdf_tables(path: Path):
    docs = []

    with pdfplumber.open(path) as pdf:
        for page in pdf.pages:
            tables = page.extract_tables()

            for table in tables:
                if not table or len(table) < 2:
                    continue

                header = table[0]
                date_cells = [c for c in header if c and DATE_RX.search(c)]
                if len(date_cells) < 2:
                    continue

                dates = parse_date_cells_to_datetimes(date_cells)
                if not dates:
                    continue

                for row in table[1:]:
                    product = (row[0] or "").lower().strip()
                    raw_country = (row[1] or "").strip()

                    if "coconut shell charcoal" not in product:
                        continue

                    country, market = split_country_and_market(raw_country)

                    prices = []
                    for i, raw_price in enumerate(row[2:2 + len(dates)]):
                        price = clean_to_float(raw_price)
                        if price is not None:
                            prices.append({
                                "date": dates[i],
                                "price": price
                            })

                    if prices:
                        docs.append({
                            "product": PRODUCT,
                            "country": country,
                            "market": market,
                            "prices": prices
                        })

    return docs


# =========================================================
# PDF UPLOAD
# =========================================================
@app.post("/upload")
def upload_pdf(pdf: List[UploadFile] = File(...)):
    docs = []

    for file in pdf:
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail="Only PDF files allowed")

        safe_name = f"{uuid.uuid4()}_{Path(file.filename).name}"
        path = UPLOAD_DIR / safe_name

        try:
            with open(path, "wb") as f:
                f.write(file.file.read())

            parsed = extract_pdf_tables(path)

            for d in parsed:
                d["source_pdf"] = file.filename
                d["uploaded_at"] = datetime.utcnow()
                docs.append(d)

        except Exception as e:
            raise HTTPException(
                status_code=500,
                detail=f"PDF processing failed for {file.filename}: {str(e)}"
            )
        finally:
            if path.exists():
                os.remove(path)

    if docs:
        charcoal_collection.insert_many(docs)

    return {
        "message": "PDF upload completed",
        "rows_inserted": len(docs)
    }


# =========================================================
# EXCEL UPLOAD
# =========================================================


# =========================================================
# COUNTRIES
# =========================================================
@app.get("/countries")
def list_countries():
    return sorted(charcoal_collection.distinct("country", {"product": PRODUCT}))


# =========================================================
# TIME SERIES
# =========================================================
@app.get("/series")
def get_series(
    countries: Optional[List[str]] = Query(None),
    fromDate: Optional[str] = None,
    toDate: Optional[str] = None,
):
    pipeline = [
        {"$match": {"product": PRODUCT}},
        {"$unwind": "$prices"}
    ]

    if countries:
        pipeline.insert(0, {"$match": {"country": {"$in": countries}}})

    if fromDate or toDate:
        date_filter = {}
        if fromDate:
            date_filter["$gte"] = datetime.fromisoformat(fromDate)
        if toDate:
            date_filter["$lte"] = datetime.fromisoformat(toDate)
        pipeline.append({"$match": {"prices.date": date_filter}})

    pipeline.extend([
        {"$sort": {"prices.date": 1}},
        {"$project": {
            "_id": 0,
            "country": 1,
            "market": 1,
            "date": "$prices.date",
            "price": "$prices.price"
        }}
    ])

    return list(charcoal_collection.aggregate(pipeline))
# =========================================================
# VIEW DATA — MONTH BY MONTH (USED BY ViewDataPage.jsx)
# =========================================================
@app.get("/data/monthly")
def get_monthly_data(year: int, month: int):
    """
    Example:
    /data/monthly?year=2025&month=11
    """

    # Calculate month range
    start = datetime(year, month, 1)
    if month == 12:
        end = datetime(year + 1, 1, 1)
    else:
        end = datetime(year, month + 1, 1)

    pipeline = [
        {"$match": {"product": PRODUCT}},
        {"$unwind": "$prices"},
        {"$match": {"prices.date": {"$gte": start, "$lt": end}}},
        {
            "$project": {
                "_id": 0,
                "country": "$country",
                "date": "$prices.date",
                "price": "$prices.price",
                "source": {
                    "$ifNull": ["$source_pdf", "$source_excel"]
                }
            }
        },
        {"$sort": {"date": 1}}
    ]

    records = list(charcoal_collection.aggregate(pipeline))

    if not records:
        return {
            "records": [],
            "summary": None
        }

    prices = [r["price"] for r in records if r.get("price") is not None]

    summary = None
    if prices:
        summary = {
            "count": len(prices),
            "average_price": round(sum(prices) / len(prices), 2),
            "min_price": min(prices),
            "max_price": max(prices)
        }

    return {
        "records": records,
        "summary": summary
    }

# =========================================================
# AGGREGATED SERIES (COUNTRY LEVEL)
# =========================================================
@app.get("/series/aggregated")
def get_aggregated_series(
    countries: Optional[List[str]] = Query(None),
    fromDate: Optional[str] = None,
    toDate: Optional[str] = None,
):
    pipeline = [
        {"$match": {"product": PRODUCT}},
        {"$unwind": "$prices"},
    ]

    if countries:
        pipeline.append({"$match": {"country": {"$in": countries}}})

    if fromDate or toDate:
        date_filter = {}
        if fromDate:
            date_filter["$gte"] = datetime.fromisoformat(fromDate)
        if toDate:
            date_filter["$lte"] = datetime.fromisoformat(toDate)
        pipeline.append({"$match": {"prices.date": date_filter}})

    pipeline.extend([
        {
            "$group": {
                "_id": {
                    "country": "$country",
                    "date": "$prices.date"
                },
                "total_price": {"$sum": "$prices.price"}
            }
        },
        {"$sort": {"_id.date": 1}},
        {
            "$project": {
                "_id": 0,
                "country": "$_id.country",
                "date": "$_id.date",
                "price": "$total_price"
            }
        }
    ])

    return list(charcoal_collection.aggregate(pipeline))

# =========================================================
# COUNTRY COMPARISON SUMMARY (Min / Avg / Max)
# =========================================================
# =========================================================
# COUNTRY KPI SUMMARY (Min / Avg / Max) — AGGREGATED
# =========================================================
@app.get("/compare/summary")
def compare_summary(fromDate: str, toDate: str):
    start = datetime.fromisoformat(fromDate)
    end = datetime.fromisoformat(toDate)

    pipeline = [
        {"$match": {"product": PRODUCT}},
        {"$unwind": "$prices"},
        {"$match": {"prices.date": {"$gte": start, "$lte": end}}},

        # 1️⃣ Combine all markets per country per day
        {
            "$group": {
                "_id": {
                    "country": "$country",
                    "date": "$prices.date"
                },
                "daily_total": {"$sum": "$prices.price"}
            }
        },

        # 2️⃣ Calculate KPIs per country
        {
            "$group": {
                "_id": "$_id.country",
                "min": {"$min": "$daily_total"},
                "max": {"$max": "$daily_total"},
                "avg": {"$avg": "$daily_total"}
            }
        },

        # 3️⃣ Clean output
        {
            "$project": {
                "_id": 0,
                "country": "$_id",
                "min": {"$round": ["$min", 2]},
                "avg": {"$round": ["$avg", 2]},
                "max": {"$round": ["$max", 2]}
            }
        },

        {"$sort": {"country": 1}}
    ]

    return list(charcoal_collection.aggregate(pipeline))

# =========================================================
# 🔥 DELETE ALL EXISTING DATA
# =========================================================
@app.delete("/data/clear")
def clear_all_data():
    result = charcoal_collection.delete_many({})
    return {
        "message": "All existing charcoal pricing data deleted",
        "deleted_count": result.deleted_count
    }

# =========================================================
# EXCEL UPLOAD (REPLACE EXISTING DATA)
# =========================================================
@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Only Excel files are allowed")

    try:
        # Read Excel (wide format)
        df = pd.read_excel(file.file)
        df.columns = df.columns.str.strip()
        print("DEBUG columns:", df.columns.tolist())
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Excel read failed: {e}")

    # Validate structure
    if "Date" not in df.columns:
        raise HTTPException(status_code=400, detail="Excel must contain 'Date' column")

    # Country columns = everything except Date
    country_columns = [c for c in df.columns if c != "Date"]

    if not country_columns:
        raise HTTPException(status_code=400, detail="No country columns found")

    docs = []

    # 🔁 Convert wide → long
    for _, row in df.iterrows():
        try:
            date = pd.to_datetime(row["Date"]).to_pydatetime()
        except Exception:
            continue

        for country_col in country_columns:
            try:
                price = row[country_col]
                if pd.isna(price):
                    continue

                country, market = split_country_and_market(country_col)

                docs.append({
                    "product": PRODUCT,
                    "country": country,
                    "market": market,
                    "prices": [{
                        "date": date,
                        "price": float(price)
                    }],
                    "source_excel": file.filename,
                    "uploaded_at": datetime.utcnow()
                })
            except Exception:
                continue

    if not docs:
        raise HTTPException(status_code=400, detail="No valid price data found")

    # 🔥 Replace existing dataset
    charcoal_collection.delete_many({})
    charcoal_collection.insert_many(docs)

    return {
        "message": "Excel uploaded successfully (wide format processed)",
        "rows_inserted": len(docs),
        "countries": country_columns
    }
@app.get("/meta/data-status")
def get_data_status():
    doc = db.prices.find_one(
        {},
        sort=[("date", -1)],
        projection={"date": 1, "_id": 0}
    )

    return {
        "last_updated": doc["date"] if doc else None
    }

# =========================================================
# HEALTH
# =========================================================
@app.get("/")
def root():
    return {
        "status": "CarbonXInsight backend running",
        "db": "connected"
    }
