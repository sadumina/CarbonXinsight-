from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
import camelot
import pandas as pd
import re
from db import charcoal_collection  # must expose a pymongo Collection

app = FastAPI(
    title="NexPulse Coconut Analytics API",
    description="Upload Coconut market PDFs → extract → store grouped weekly prices → analyze"
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # set to your frontend origin in prod
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


# ---------------------------------------------------------------------
# Upload → Extract → Group (1 doc per product+country+PDF, with prices[])
# ---------------------------------------------------------------------
@app.post("/upload")
async def upload_pdf(pdf: UploadFile = File(...)):
    try:
        # save temp
        path = f"./{pdf.filename}"
        with open(path, "wb") as f:
            f.write(pdf.file.read())

        tables = camelot.read_pdf(path, pages="all", flavor="stream")
        grouped_docs = []

        for table in tables:
            df = table.df

            # detect the date header row
            date_row_idx = None
            date_cols = []
            for i, row in df.iterrows():
                hits = [c for c in row if DATE_RX.search(str(c))]
                if len(hits) >= 2:  # must be at least two week columns
                    date_row_idx = i
                    # normalize to pandas Timestamps
                    date_cols = [pd.to_datetime(d, dayfirst=True) for d in hits]
                    break

            if not date_cols:
                # no dates in this table (skip)
                continue

            # iterate rows after date row until footer (Source...) / blank
            for _, row in df.iloc[date_row_idx + 1:].iterrows():
                product = str(row[0]).strip()
                country = str(row[1]).strip()

                if product == "" or product.lower().startswith("source"):
                    break  # reached footer / end

                # build prices array mapping each date to a cleaned float
                prices = []
                cells = row.to_list()[2:2 + len(date_cols)]
                for idx, raw in enumerate(cells):
                    price = clean_to_float(raw)
                    if price is None:
                        continue
                    prices.append({"date": date_cols[idx], "price": price})

                if not prices:
                    continue

                grouped_docs.append({
                    "product": product,
                    "country": country,
                    "prices": prices,
                    "month": prices[0]["date"].month,
                    "year": prices[0]["date"].year,
                    "source_pdf": pdf.filename
                })

        if not grouped_docs:
            return {"message": "⚠️ No valid rows found in PDF", "rows": 0}

        # Optional: avoid duplicates if same PDF re-uploaded
        # charcoal_collection.delete_many({"source_pdf": pdf.filename})

        charcoal_collection.insert_many(grouped_docs)
        return {"message": "✅ Stored grouped data", "rows": len(grouped_docs)}

    except Exception as e:
        print("❌ Upload error:", e)
        return {"error": str(e), "message": "❌ PDF processing failed"}


# ---------------------------------------------------------------------
# PRODUCTS & COUNTRIES (for dropdowns)
# ---------------------------------------------------------------------
@app.get("/products")
async def list_products():
    return sorted(charcoal_collection.distinct("product"))

@app.get("/countries")
async def list_countries(product: str):
    if not product:
        raise HTTPException(400, "product is required")
    return sorted(charcoal_collection.distinct("country", {"product": product}))


# ---------------------------------------------------------------------
# GLOBAL KPI (Avg / Min / Max / MoM) for a product (all countries)
# ---------------------------------------------------------------------
@app.get("/analytics/global")
async def global_kpi(product: str):
    if not product:
        raise HTTPException(422, "Query param ?product= is required")

    pipeline = [
        {"$match": {"product": product}},
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
# COUNTRY COMPARISON (by product) → avg/min/max per country
# (This replaces your old `/analytics`)
# ---------------------------------------------------------------------
@app.get("/analytics")
async def analytics(product: str):
    if not product:
        raise HTTPException(422, "Query param ?product= is required")

    pipeline = [
        {"$match": {"product": product}},
        {"$unwind": "$prices"},
        {"$group": {
            "_id": "$country",
            "avg_price": {"$avg": "$prices.price"},
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
        }},
        {"$project": {"_id": 1, "avg_price": 1, "min_price": 1, "max_price": 1}},
        {"$sort": {"_id": 1}}
    ]
    return list(charcoal_collection.aggregate(pipeline))


# ---------------------------------------------------------------------
# TIME SERIES for charting (product, optional country)
# returns [{date, price, country}]
# ---------------------------------------------------------------------
@app.get("/series")
async def series(product: str, country: str | None = None):
    if not product:
        raise HTTPException(422, "Query param ?product= is required")

    match_stage = {"product": product}
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
# MONTHLY ANALYTICS (filter by month/year/product, optional country)
# ---------------------------------------------------------------------
@app.get("/analytics/month")
async def monthly_analytics(month: int, year: int, pdf: str | None = None):

    match_stage = {
        "$expr": {
            "$and": [
                {"$eq": [{"$month": "$prices.date"}, month]},
                {"$eq": [{"$year": "$prices.date"}, year]}
            ]
        }
    }

    if pdf:
        match_stage["source_pdf"] = pdf   # ✅ now filter by selected PDF

    pipeline = [
        {"$unwind": "$prices"},
        {"$match": match_stage},
        {"$group": {
            "_id": {"product": "$product", "country": "$country"},
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "avg_price": {"$avg": "$prices.price"},
        }},
        {"$project": {
            "_id": 0,
            "product": "$_id.product",
            "country": "$_id.country",
            "min_price": 1,
            "max_price": 1,
            "avg_price": 1
        }}
    ]

    return list(charcoal_collection.aggregate(pipeline))



# ---------------------------------------------------------------------
# Maintenance
# ---------------------------------------------------------------------
@app.delete("/clear-data")
async def clear_data():
    deleted = charcoal_collection.delete_many({})
    return {"message": "✅ Database cleared", "deleted_count": deleted.deleted_count}

@app.get("/test-db")
async def test_db():
    return {"ok": True, "count": charcoal_collection.count_documents({})}

# ✅ get available PDFs in DB
@app.get("/pdfs")
async def get_pdfs():
    pdfs = charcoal_collection.distinct("source_pdf")
    return pdfs


# ✅ analytics by product for a specific PDF
@app.get("/analytics/by-pdf")
async def analytics_by_pdf(source_pdf: str):

    pipeline = [
        {"$match": {"source_pdf": source_pdf}},
        {"$unwind": "$prices"},
        {"$group": {
            "_id": {
                "product": "$product",
                "country": "$country"
            },
            "min_price": {"$min": "$prices.price"},
            "max_price": {"$max": "$prices.price"},
            "avg_price": {"$avg": "$prices.price"},
        }},
        {"$project": {
            "_id": 0,
            "product": "$_id.product",
            "country": "$_id.country",
            "min_price": 1,
            "max_price": 1,
            "avg_price": 1
        }},
        {"$sort": {"product": 1, "country": 1}}
    ]

    return list(charcoal_collection.aggregate(pipeline))

@app.get("/pdfs")
async def list_pdfs():
    return charcoal_collection.distinct("source_pdf")


@app.get("/")
def root():
    return {"message": "Backend running ✅"}
