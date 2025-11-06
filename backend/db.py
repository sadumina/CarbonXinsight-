from pymongo import MongoClient
import os
from dotenv import load_dotenv

load_dotenv()

MONGO_URL = os.getenv("MONGO_URL")
DB_NAME = "coconut_analytics"

# Create MongoDB client connection
client = MongoClient(MONGO_URL)

# Select database
db = client[DB_NAME]

# Select collection
charcoal_collection = db["charcoal_prices"]
