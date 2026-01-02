from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import List, Optional
from datetime import datetime
import pandas as pd
import re
import os
import uuid
from pathlib import Path

from db import charcoal_collection

# =========================================================
# OPTIONAL DEPENDENCY: CAMELOT
# - Camelot often fails on Python 3.13/3.14 because wheels aren't available.
# - This prevents your whole app from crashing at startup.
# =========================================================
try:
    import camelot  # type: ignore
except ImportError:
    camelot = None


# =========================================================
# CONSTANTS
# =========================================================
PRODUCT = "Coconut Shell Charcoal"

DATE_RX = re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")
COUNTRY_RX = re.compile(r"^([^(]+)")      # before "("
MARKET_RX = re.compile(r"\((.+)\)")       # inside "()"

UPLOAD_DIR = Path("./uploads")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


# =========================================================
# APP INIT
# =========================================================
app = FastAPI(title="CarbonXInsight — Market Analytics")

# In development you can allow all.
# In production set allow_origins=["https://your-frontend-domain"]
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "*"],
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


def parse_date_cells_to_datetimes(cells: List[str]) -> List[datetime]:
    """
    Convert a list of strings containing dates into datetime objects.
    Assumes day-first format because your PDFs appear to be dd/mm/yyyy.
    """
    out = []
    for c in cells:
        try:
            out.append(pd.to_datetime(c, dayfirst=True).to_pydatetime())
        except Exception:
            # skip invalid
            pass
    return out


# =========================================================
# PDF UPLOAD
# NOTE: This endpoint is SYNC because Camelot parsing is blocking.
# =========================================================
@app.post("/upload")
def upload_pdf(pdf: List[UploadFile] = File(...)):
    # If Camelot is not installed, return a clear error (do not crash the server)
    if camelot is None:
        raise HTTPException(
            status_code=500,
            detail=(
                "PDF parsing engine (camelot) is not available in this environment. "
                "Use Python 3.10/3.11 and install: pip install camelot-py[cv] ghostscript"
            ),
        )

    docs = []

    for file in pdf:
        # Basic validation
        if not file.filename.lower().endswith(".pdf"):
            raise HTTPException(status_code=400, detail=f"Only PDF files allowed: {file.filename}")

        # Save file to disk (unique name)
        safe_name = f"{uuid.uuid4()}_{Path(file.filename).name}"
        path = UPLOAD_DIR / safe_name

        try:
            # Write uploaded file to disk
            with open(path, "wb") as f:
                f.write(file.file.read())

            # Parse PDF
            tables = camelot.read_pdf(str(path), pages="all", flavor="stream")

            for tbl in tables:
                df = tbl.df

                date_row_idx = None
                date_cells = []

                # Find header row that contains at least 2 date-like values
                for i, row in df.iterrows():
                    hits = [c for c in row if DATE_RX.search(str(c))]
                    if len(hits) >= 2:
                        date_row_idx = i
                        date_cells = hits
                        break

                if date_row_idx is None:
                    continue

                dates = parse_date_cells_to_datetimes(date_cells)
                if not dates:
                    continue

                # Read data rows under header
                for _, row in df.iloc[date_row_idx + 1 :].iterrows():
                    product = str(row[0]).strip().lower()
                    raw_country = str(row[1]).strip()

                    # Stop when end section is reached
                    if product == "" or product.startswith("source"):
                        break

                    # Only coconut shell charcoal
                    if "coconut shell charcoal" not in product:
                        continue

                    country, market = split_country_and_market(raw_country)

                    prices = []
                    # Prices start from column 2 onward, aligned with dates
                    raw_prices = row.to_list()[2 : 2 + len(dates)]

                    for idx, raw_price in enumerate(raw_prices):
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
                                "uploaded_at": datetime.utcnow(),
                            }
                        )

        except HTTPException:
            raise
        except Exception as e:
            # Return real error instead of silent 500
            raise HTTPException(status_code=500, detail=f"PDF processing failed for {file.filename}: {str(e)}")
        finally:
            # Cleanup file from disk
            try:
                if path.exists():
                    os.remove(path)
            except Exception:
                # If cleanup fails, do not fail the request
                pass

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
    if not file.filename.lower().endswith((".xlsx", ".xls")):
        raise HTTPException(status_code=400, detail="Upload Excel only (.xlsx / .xls)")

    try:
        df = pd.read_excel(file.file, sheet_name="Data")
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Cannot read Excel file: {str(e)}")

    required = {"Country", "Product", "Date", "Price"}
    if not required.issubset(df.columns):
        raise HTTPException(status_code=400, detail="Invalid Excel format. Required: Country, Product, Date, Price")

    docs = []
    for _, row in df.iterrows():
        country, market = split_country_and_market(row.get("Country"))
        try:
            docs.append(
                {
                    "product": PRODUCT,
                    "country": country,
                    "market": market,
                    "prices": [
                        {
                            "date": pd.to_datetime(row["Date"]).to_pydatetime(),
                            "price": float(row["Price"]),
                        }
                    ],
                    "source_excel": file.filename,
                    "uploaded_at": datetime.utcnow(),
                }
            )
        except Exception:
            # Skip malformed rows instead of failing entire upload
            continue

    if docs:
        charcoal_collection.insert_many(docs)

    return {
        "message": "Excel upload successful",
        "rows_inserted": len(docs),
    }


# =========================================================
# COUNTRIES
# =========================================================
@app.get("/countries")
def list_countries():
    countries = charcoal_collection.distinct("country", {"product": PRODUCT})
    return sorted([c for c in countries if c])


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
# VIEW DATA — MONTH BY MONTH
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
                "source": {"$ifNull": ["$source_pdf", "$source_excel"]},
            }
        },
        {"$sort": {"date": 1}},
    ]

    records = list(charcoal_collection.aggregate(pipeline))
    if not records:
        return {"records": [], "summary": None}

    prices = [r["price"] for r in records if r.get("price") is not None]
    if not prices:
        return {"records": records, "summary": None}

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
# COMPARISON SUMMARY — MIN / AVG / MAX (BY COUNTRY + MARKET)
# FIXED: market must be included in _id or it will be null.
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
                    "market": "$market",
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
