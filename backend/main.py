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
# --- Market Average Only (per country) ---
@app.get("/analytics/avg")
async def average_only(pdf: str | None = None, month: int | None = None, year: int | None = None):
    pipeline = [
        {"$match": {"product": PRODUCT}},
        {"$unwind": "$prices"},
    ]
    if pdf:
        pipeline.append({"$match": {"source_pdf": pdf}})
    date_expr = []
    if month is not None:
        date_expr.append({"$eq": [{"$month": "$prices.date"}, month]})
    if year is not None:
        date_expr.append({"$eq": [{"$year": "$prices.date"}, year]})
    if date_expr:
        pipeline.append({"$match": {"$expr": {"$and": date_expr}}})

    pipeline += [
        {"$group": {
            "_id": "$country",
            "avg_price": {"$avg": "$prices.price"},
        }},
        {"$project": {"_id": 0, "country": "$_id", "avg_price": {"$round": ["$avg_price", 2]}}},
        {"$sort": {"country": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))

PRODUCT_DEFAULT = "Coconut Shell Charcoal"

# Utility: normalize header
def _norm(s: str) -> str:
    return re.sub(r"\s+", "", s.strip().lower()) if isinstance(s, str) else ""

# Utility: best-effort parse of Excel "date" cells
def _to_datetime(val):
    if pd.isna(val):
        return None
    if isinstance(val, (datetime, np.datetime64)):
        return pd.to_datetime(val)
    # Excel serial?
    try:
        return pd.to_datetime(val, unit="D", origin="1899-12-30")
    except Exception:
        pass
    # string date
    try:
        return pd.to_datetime(str(val), dayfirst=True, errors="coerce")
    except Exception:
        return None

def _to_float(val):
    try:
        s = re.sub(r"[^\d.\-]", "", str(val)).strip()
        if s == "" or s == "-" or s == ".":
            return None
        return float(s)
    except Exception:
        return None

# -----------------------------
# 1) Upload Excel (flat schema)
# -----------------------------
@app.post("/upload-excel")
async def upload_excel(file: UploadFile = File(...)):
    if not (file.filename.endswith(".xlsx") or file.filename.endswith(".xls")):
        raise HTTPException(status_code=400, detail="Please upload an Excel file (.xlsx / .xls)")

    try:
        df = pd.read_excel(file.file)

        # Map headers
        cols = { _norm(c): c for c in df.columns }
        date_col    = cols.get("date") or cols.get("week")
        country_col = cols.get("country") or cols.get("market")
        price_col   = cols.get("price") or cols.get("usd/mt")
        product_col = cols.get("product")

        if not (date_col and country_col and price_col):
            raise HTTPException(status_code=400, detail=(
                "Missing required columns. Expected Date/Week, Country/Market, Price (optional: Product)."
            ))

        # Clean + Project
        df["_date"]    = df[date_col].apply(_to_datetime)
        df["_country"] = df[country_col].astype(str).str.strip()
        df["_price"]   = df[price_col].apply(_to_float)
        df["_product"] = df[product_col].astype(str).str.strip() if product_col else PRODUCT_DEFAULT

        df = df.dropna(subset=["_date", "_country", "_price"])
        df["_date"] = pd.to_datetime(df["_date"]).dt.normalize()

        docs = []
        for _, r in df.iterrows():
            d = {
                "product": r.get("_product", PRODUCT_DEFAULT),
                "country": r["_country"],
                "date":    r["_date"].to_pydatetime(),
                "price":   float(r["_price"]),
                "source_type": "excel",
                "source_file": file.filename,
                "year": int(r["_date"].year),
                "month": int(r["_date"].month),
            }
            docs.append(d)

        if not docs:
            return {"message": "No valid rows found in Excel."}

        # Optional: de-dup for this file before insert
        # charcoal_collection.delete_many({"source_type": "excel", "source_file": file.filename})

        charcoal_collection.insert_many(docs)
        return {"message": "Excel data ingested", "rows": len(docs)}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Upload failed: {e}")

# -----------------------------------------
# 2) Countries available in Excel dataset
# -----------------------------------------
@app.get("/countries-series")
def countries_series(product: Optional[str] = None):
    q = {"source_type": "excel"}
    if product:
        q["product"] = product
    return sorted(charcoal_collection.distinct("country", q))

# ---------------------------------------------------------
# 3) Time series with running stats for hover/click tooltip
#    GET /series-excel?countries=Sri%20Lanka&countries=Indonesia&start=2023-01-01&end=2025-12-31
# ---------------------------------------------------------
@app.get("/series-excel")
def series_excel(
    countries: List[str] = Query(default=[]),
    start: Optional[str] = None,
    end: Optional[str] = None,
    product: Optional[str] = None,
):
    match = {"source_type": "excel"}
    if countries:
        match["country"] = {"$in": countries}
    if product:
        match["product"] = product

    if start or end:
        date_q = {}
        if start:
            date_q["$gte"] = pd.to_datetime(start)
        if end:
            date_q["$lte"] = pd.to_datetime(end)
        match["date"] = date_q

    pipeline = [
        {"$match": match},
        {"$project": {"_id": 0, "country": 1, "date": 1, "price": 1}},
        {"$sort": {"country": 1, "date": 1}},
    ]
    rows = list(charcoal_collection.aggregate(pipeline))
    if not rows:
        return {"series": []}

    # Build per-country running stats
    out = []
    from collections import defaultdict
    groups = defaultdict(list)
    for r in rows:
        groups[r["country"]].append(r)

    for country, pts in groups.items():
        first_price = None
        run_min = None
        run_max = None
        run_sum = 0.0
        run_n = 0

        series_points = []
        for r in pts:
            p = float(r["price"])
            if first_price is None:
                first_price = p
            run_min = p if run_min is None else min(run_min, p)
            run_max = p if run_max is None else max(run_max, p)
            run_sum += p
            run_n += 1
            avg = run_sum / run_n
            change_pct = None if first_price in (None, 0) else ( (p - first_price) / first_price ) * 100.0

            series_points.append({
                "date": r["date"],
                "price": p,
                "min_to_date": run_min,
                "max_to_date": run_max,
                "avg_to_date": avg,
                "change_pct_from_start": change_pct,
            })

        out.append({
            "country": country,
            "points": series_points
        })

    return {"series": out}

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
