# main.py — NexPulse Coconut Shell Charcoal–only API

from fastapi import FastAPI, UploadFile, File, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
import camelot
import pandas as pd
import re
from typing import Optional, Dict, Any, List
from db import charcoal_collection  # exposes a pymongo Collection

# 🔒 Fixed product everywhere
PRODUCT = "Coconut Shell Charcoal"

app = FastAPI(
    title="NexPulse – Coconut Shell Charcoal Analytics",
    description="Upload WPU PDFs → extract Coconut Shell Charcoal → country KPIs (Avg/Min/Max/MoM) → monthly/PDF filters + PDF-vs-PDF compare",
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],          # set your frontend origin in prod
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------
DATE_RX = re.compile(r"\d{1,2}/\d{1,2}/\d{2,4}")

def clean_to_float(val: str):
    """
    Keep only digits and dots. Return float or None.
    Skips garbage like '', '.', '..', 'n.q.', '--'
    """
    cleaned = re.sub(r"[^\d.]", "", str(val)).strip()
    if cleaned == "" or cleaned.replace(".", "") == "":
        return None
    try:
        return float(cleaned)
    except Exception:
        return None

def _scope_match(pdf: Optional[str], month: Optional[int], year: Optional[int]) -> Dict[str, Any]:
    """Base match for product + optional pdf (month/year handled as $expr later)."""
    m = {"product": PRODUCT}
    if pdf:
        m["source_pdf"] = pdf
    return m

def _date_expr(month: Optional[int], year: Optional[int]) -> Optional[Dict[str, Any]]:
    expr = []
    if month is not None:
        expr.append({"$eq": [{"$month": "$prices.date"}, month]})
    if year is not None:
        expr.append({"$eq": [{"$year": "$prices.date"}, year]})
    if expr:
        return {"$and": expr}
    return None

def _country_stats_for_scope(pdf: Optional[str], month: Optional[int], year: Optional[int]) -> Dict[str, Dict[str, float]]:
    """Per-country min/max/avg for a single scope."""
    pipeline: List[Dict[str, Any]] = [
        {"$match": _scope_match(pdf, month, year)},
        {"$unwind": "$prices"},
    ]
    expr = _date_expr(month, year)
    if expr:
        pipeline.append({"$match": {"$expr": expr}})
    pipeline += [
        {"$group": {
            "_id": "$country",
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "avg_price": {"$avg": "$prices.price"},
        }},
        {"$sort": {"_id": 1}}
    ]
    out: Dict[str, Dict[str, float]] = {}
    for row in charcoal_collection.aggregate(pipeline):
        out[row["_id"]] = {
            "min": row["min_price"],
            "max": row["max_price"],
            "avg": row["avg_price"],
        }
    return out

# ---------------------------------------------------------------------
# Upload → Extract → Group (1 doc per country+PDF for Coconut Shell Charcoal)
# ---------------------------------------------------------------------
@app.post("/upload")
async def upload_pdf(pdf: UploadFile = File(...)):
    """
    Parses the PDF, finds date header row, then stores ONLY
    'Coconut Shell Charcoal' rows grouped as:
    {
      product: 'Coconut Shell Charcoal',
      country: '<market>',
      prices: [{date, price}, ...],
      month, year, source_pdf
    }
    """
    try:
        path = f"./{pdf.filename}"
        with open(path, "wb") as f:
            f.write(pdf.file.read())

        tables = camelot.read_pdf(path, pages="all", flavor="stream")
        grouped_docs: List[Dict[str, Any]] = []

        for table in tables:
            df = table.df

            # detect the date header row
            date_row_idx = None
            dates = []
            for i, row in df.iterrows():
                hits = [c for c in row if DATE_RX.search(str(c))]
                if len(hits) >= 2:  # at least two week columns
                    date_row_idx = i
                    dates = [pd.to_datetime(d, dayfirst=True) for d in hits]
                    break

            if not dates:
                continue

            # iterate rows after date row until footer (Source...) / blank
            for _, row in df.iloc[date_row_idx + 1:].iterrows():
                product = str(row[0]).strip()
                country = str(row[1]).strip()

                if product == "" or product.lower().startswith("source"):
                    break  # reached footer/end of table

                # 🔒 keep only Coconut Shell Charcoal rows
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
                    "source_pdf": pdf.filename
                })

        if not grouped_docs:
            return {"message": "⚠️ No Coconut Shell Charcoal rows found in PDF", "rows": 0}

        # Optional: avoid duplicates if same PDF re-uploaded
        # charcoal_collection.delete_many({"source_pdf": pdf.filename, "product": PRODUCT})

        charcoal_collection.insert_many(grouped_docs)
        return {"message": "✅ Stored Coconut Shell Charcoal grouped data", "rows": len(grouped_docs)}

    except Exception as e:
        print("❌ Upload error:", e)
        return {"error": str(e), "message": "❌ PDF processing failed"}

# ---------------------------------------------------------------------
# Countries list (charcoal only)
# ---------------------------------------------------------------------
@app.get("/countries")
async def list_countries():
    return sorted(charcoal_collection.distinct("country", {"product": PRODUCT}))

# ---------------------------------------------------------------------
# Global KPI (Avg/Min/Max/MoM) across all countries/dates (charcoal)
# ---------------------------------------------------------------------
@app.get("/analytics/global")
async def global_kpi():
    pipeline = [
        {"$match": {"product": PRODUCT}},
        {"$unwind": "$prices"},
        {"$sort": {"prices.date": 1}},
        {"$group": {
            "_id": None,
            "avg_price": {"$avg": "$prices.price"},
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "first_price": {"$first": "$prices.price"},
            "last_price": {"$last": "$prices.price"},
        }},
        {"$project": {
            "_id": 0,
            "avg_price": 1,
            "min_price": 1,
            "max_price": 1,
            "mom_change_percent": {
                "$cond": [
                    {"$or": [{"$eq": ["$first_price", None]}, {"$eq": ["$first_price", 0]}]},
                    None,
                    {
                        "$multiply": [
                            {"$divide": [{"$subtract": ["$last_price", "$first_price"]}, "$first_price"]},
                            100
                        ]
                    }
                ]
            }
        }}
    ]
    res = list(charcoal_collection.aggregate(pipeline))
    return res[0] if res else {}

# ---------------------------------------------------------------------
# Country Comparison (Avg/Min/Max per country) — scoped by pdf/month/year
# ---------------------------------------------------------------------
@app.get("/analytics")
async def analytics(pdf: Optional[str] = None, month: Optional[int] = None, year: Optional[int] = None):
    pipeline: List[Dict[str, Any]] = [
        {"$match": _scope_match(pdf, month, year)},
        {"$unwind": "$prices"},
    ]
    expr = _date_expr(month, year)
    if expr:
        pipeline.append({"$match": {"$expr": expr}})

    pipeline += [
        {"$group": {
            "_id": "$country",
            "avg_price": {"$avg": "$prices.price"},
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
        }},
        {"$sort": {"_id": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))

# ---------------------------------------------------------------------
# Country-wise KPI cards (Avg/Min/Max/MoM) — optional countries/pdf/month/year
# ---------------------------------------------------------------------
@app.get("/analytics/country-kpis")
async def country_kpis(
    countries: List[str] = Query(default=[]),
    pdf: Optional[str] = None,
    month: Optional[int] = None,
    year: Optional[int] = None,
):
    base_match = _scope_match(pdf, month, year)
    if countries:
        base_match["country"] = {"$in": countries}

    pipeline: List[Dict[str, Any]] = [
        {"$match": base_match},
        {"$unwind": "$prices"},
        {"$sort": {"country": 1, "prices.date": 1}},
    ]
    expr = _date_expr(month, year)
    if expr:
        pipeline.insert(2, {"$match": {"$expr": expr}})

    pipeline += [
        {"$group": {
            "_id": "$country",
            "avg_price": {"$avg": "$prices.price"},
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "first_price": {"$first": "$prices.price"},
            "last_price": {"$last": "$prices.price"},
        }},
        {"$project": {
            "_id": 0,
            "country": "$_id",
            "avg_price": 1,
            "min_price": 1,
            "max_price": 1,
            "mom_change_percent": {
                "$cond": [
                    {"$or": [{"$eq": ["$first_price", None]}, {"$eq": ["$first_price", 0]}]},
                    None,
                    {
                        "$multiply": [
                            {"$divide": [{"$subtract": ["$last_price", "$first_price"]}, "$first_price"]},
                            100
                        ]
                    }
                ]
            }
        }},
        {"$sort": {"country": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))

# ---------------------------------------------------------------------
# Time series for charting (optional single-country filter)
# ---------------------------------------------------------------------
@app.get("/series")
async def series(country: Optional[str] = None):
    match_stage = {"product": PRODUCT}
    if country:
        match_stage["country"] = country

    pipeline = [
        {"$match": match_stage},
        {"$unwind": "$prices"},
        {"$project": {
            "_id": 0,
            "product": 1,
            "country": 1,
            "date": "$prices.date",
            "price": "$prices.price",
        }},
        {"$sort": {"date": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))

# ---------------------------------------------------------------------
# Monthly analytics (filter by month/year; optional pdf)
# ---------------------------------------------------------------------
@app.get("/analytics/month")
async def monthly_analytics(month: int, year: int, pdf: Optional[str] = None):
    pipeline: List[Dict[str, Any]] = [
        {"$match": _scope_match(pdf, month, year)},
        {"$unwind": "$prices"},
        {"$match": {"$expr": {"$and": [
            {"$eq": [{"$month": "$prices.date"}, month]},
            {"$eq": [{"$year": "$prices.date"}, year]},
        ]}}},
        {"$group": {
            "_id": {"country": "$country"},
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "avg_price": {"$avg": "$prices.price"},
        }},
        {"$project": {
            "_id": 0,
            "country": "$_id.country",
            "min_price": 1,
            "max_price": 1,
            "avg_price": 1
        }},
        {"$sort": {"country": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))

# ---------------------------------------------------------------------
# PDF helpers (list PDFs, analytics for a specific PDF)
# ---------------------------------------------------------------------
@app.get("/pdfs")
async def list_pdfs():
    return sorted(charcoal_collection.distinct("source_pdf", {"product": PRODUCT}))

@app.get("/analytics/by-pdf")
async def analytics_by_pdf(source_pdf: str):
    pipeline = [
        {"$match": {"source_pdf": source_pdf, "product": PRODUCT}},
        {"$unwind": "$prices"},
        {"$group": {
            "_id": {"country": "$country"},
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "avg_price": {"$avg": "$prices.price"},
        }},
        {"$project": {
            "_id": 0,
            "country": "$_id.country",
            "min_price": 1,
            "max_price": 1,
            "avg_price": 1
        }},
        {"$sort": {"country": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))

# ---------------------------------------------------------------------
# PDF-vs-PDF / Month-vs-Month comparison (per-country)
# ---------------------------------------------------------------------
@app.get("/analytics/compare")
async def compare_scopes(
    pdf1: Optional[str] = None,
    pdf2: Optional[str] = None,
    month1: Optional[int] = None,
    year1: Optional[int] = None,
    month2: Optional[int] = None,
    year2: Optional[int] = None,
):
    """
    Compare per-country MIN/MAX/AVG between two scopes.
    Scope = a single PDF (pdf=...) OR a (month, year) pair.

    Examples:
      /analytics/compare?pdf1=wpu2025-08.pdf&pdf2=wpu2025-10.pdf
      /analytics/compare?month1=8&year1=2025&month2=10&year2=2025
    """
    use_pdf = bool(pdf1 and pdf2)
    use_month = (month1 is not None and year1 is not None and
                 month2 is not None and year2 is not None)
    if not (use_pdf or use_month):
        raise HTTPException(status_code=400, detail="Provide either pdf1+pdf2 OR month1/year1 + month2/year2")

    A = _country_stats_for_scope(pdf1 if use_pdf else None, month1 if use_month else None, year1 if use_month else None)
    B = _country_stats_for_scope(pdf2 if use_pdf else None, month2 if use_month else None, year2 if use_month else None)

    countries = sorted(set(A.keys()) | set(B.keys()))
    rows = []
    for c in countries:
        a = A.get(c)
        b = B.get(c)

        def delta(x, y):
            if x is None or y is None:
                return None
            try:
                return y - x
            except Exception:
                return None

        def pct(x, y):
            if x is None or y is None or x == 0:
                return None
            try:
                return ((y - x) / x) * 100.0
            except Exception:
                return None

        rows.append({
            "country": c,
            "a": a,
            "b": b,
            "delta": {
                "min": delta(a["min"] if a else None, b["min"] if b else None),
                "max": delta(a["max"] if a else None, b["max"] if b else None),
                "avg": delta(a["avg"] if a else None, b["avg"] if b else None),
                "min_pct": pct(a["min"] if a else None, b["min"] if b else None),
                "max_pct": pct(a["max"] if a else None, b["max"] if b else None),
                "avg_pct": pct(a["avg"] if a else None, b["avg"] if b else None),
            }
        })

    label_a = pdf1 if use_pdf else f"{month1:02}/{year1}"
    label_b = pdf2 if use_pdf else f"{month2:02}/{year2}"

    return {
        "label_a": label_a,
        "label_b": label_b,
        "countries": rows
    }

# ---------------------------------------------------------------------
# Maintenance / Health
# ---------------------------------------------------------------------
@app.delete("/clear-data")
async def clear_data():
    deleted = charcoal_collection.delete_many({"product": PRODUCT})
    return {"message": "✅ Charcoal data cleared", "deleted_count": deleted.deleted_count}

@app.get("/test-db")
async def test_db():
    return {"ok": True, "count": charcoal_collection.count_documents({"product": PRODUCT})}

@app.get("/")
def root():
    return {"message": "Coconut Shell Charcoal API running ✅"}
