import os

from datetime import datetime, timedelta

from typing import List, Optional

from fastapi import FastAPI, HTTPException, Depends, status, File, UploadFile

from fastapi.middleware.cors import CORSMiddleware

from pydantic import BaseModel, Field

from motor.motor_asyncio import AsyncIOMotorClient

from jose import JWTError, jwt

from passlib.context import CryptContext

# Configuration

SECRET_KEY = os.getenv("JWT_SECRET", "sour-apple-super-secret-key")

ALGORITHM = "HS256"

MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")

app = FastAPI(title="Sour Apple Laundry API")

app.add_middleware(

    CORSMiddleware,

    allow_origins=["*"],

    allow_methods=["*"],

    allow_headers=["*"],

)

client = AsyncIOMotorClient(MONGODB_URL)

db = client.sour_apple_laundry

# Models

class OrderCreate(BaseModel):

    bag_size: str # 'Small', 'Medium', 'Large'

    is_mvcc: bool

    add_ons: List[str] = []

    digital_contract_accepted: bool

    e_signature: str

    bag_photo_url: Optional[str] = None

class Order(OrderCreate):

    id: str

    user_id: str

    total_price: float

    status: str = "Pending"

    status_history: List[dict] = []

    created_at: datetime

    payment_reported: bool = False

    payment_method: Optional[str] = None

def calculate_price(bag_size: str, is_mvcc: bool) -> float:

    prices = {

        "Small": 10.0 if is_mvcc else 20.0,

        "Medium": 20.0 if is_mvcc else 30.0,

        "Large": 30.0 if is_mvcc else 40.0

    }

    return prices.get(bag_size, 0.0)

@app.post("/orders", response_model=Order)

async def create_order(order_data: OrderCreate):

    price = calculate_price(order_data.bag_size, order_data.is_mvcc)

    

    new_order = {

        **order_data.dict(),

        "total_price": price,

        "status": "Awaiting Pickup",

        "status_history": [{"status": "Awaiting Pickup", "timestamp": datetime.now()}],

        "created_at": datetime.now(),

        "payment_reported": False

    }

    

    result = await db.orders.insert_one(new_order)

    new_order["id"] = str(result.inserted_id)

    return new_order

@app.get("/orders/{order_id}")

async def get_order(order_id: str):

    order = await db.orders.find_one({"_id": order_id})

    if order:

        return order

    raise HTTPException(status_404_NOT_FOUND)

@app.post("/orders/{order_id}/report-payment")

async def report_payment(order_id: str, method: str):

    await db.orders.update_one(

        {"_id": order_id},

        {"$set": {"payment_reported": True, "payment_method": method}}

    )

    return {"status": "success"}

