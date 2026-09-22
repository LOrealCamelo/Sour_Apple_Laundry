import os
import json
import smtplib
import urllib.request
from datetime import datetime
from typing import List, Optional, Dict, Any
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, HTTPException, status, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from motor.motor_asyncio import AsyncIOMotorClient
import stripe

# ==============================================================================
# Configuration & Environment
# ==============================================================================
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "natture1st@gmail.com")
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")  # Google App Password
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")

if STRIPE_SECRET_KEY:
    stripe.api_key = STRIPE_SECRET_KEY

# ==============================================================================
# Initialize FastAPI App (Must be defined before any @app route decorators)
# ==============================================================================
app = FastAPI(title="Sour Apple Wash & Fold VIP Laundry Services API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Database connection
client = AsyncIOMotorClient(MONGODB_URL)
db = client.sour_apple_laundry

# ==============================================================================
# Pydantic Schemas
# ==============================================================================
class OrderCreate(BaseModel):
    bag_size: str  # 'Small', 'Medium', 'Large'
    is_mvcc: bool = False
    add_ons: List[str] = []
    digital_contract_accepted: bool = False
    e_signature: str
    bag_photo_url: Optional[str] = None

class Order(OrderCreate):
    id: str
    user_id: Optional[str] = None
    total_price: float
    status: str = "Pending"
    status_history: List[Dict[str, Any]] = []
    created_at: datetime
    payment_reported: bool = False
    payment_method: Optional[str] = None

# ==============================================================================
# Helper Functions
# ==============================================================================
def calculate_price(bag_size: str, is_mvcc: bool) -> float:
    prices = {
        "Small": 10.0 if is_mvcc else 20.0,
        "Medium": 20.0 if is_mvcc else 30.0,
        "Large": 30.0 if is_mvcc else 40.0,
    }
    return prices.get(bag_size, 0.0)

def send_order_alert(order: dict):
    subject = f"New Laundry Order: {order.get('e_signature')}"
    html = f"""
    <html><body>
    <h2>New Order Received</h2>
    <p><b>Customer:</b> {order.get('e_signature')}</p>
    <p><b>Bag Size:</b> {order.get('bag_size')}</p>
    <p><b>Total Price:</b> ${order.get('total_price')}</p>
    <p><b>MVCC Student:</b> {order.get('is_mvcc')}</p>
    <p><b>Digital Signature:</b> {order.get('e_signature')}</p>
    </body></html>
    """

    if RESEND_API_KEY:
        url = "https://api.resend.com/emails"
        headers = {
            "Authorization": f"Bearer {RESEND_API_KEY}",
            "Content-Type": "application/json",
        }
        data = json.dumps({
            "from": "onboarding@resend.dev",
            "to": ADMIN_EMAIL,
            "subject": subject,
            "html": html,
        }).encode("utf-8")
        req = urllib.request.Request(url, data=data, headers=headers, method="POST")
        with urllib.request.urlopen(req) as response:
            return response.read()

    elif SMTP_PASSWORD and SMTP_USER:
        msg = MIMEMultipart()
        msg["From"] = SMTP_USER
        msg["To"] = ADMIN_EMAIL
        msg["Subject"] = subject
        msg.attach(MIMEText(html, "html"))
        with smtplib.SMTP("smtp.gmail.com", 587) as server:
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)

# ==============================================================================
# API Endpoints
# ==============================================================================
@app.get("/health")
async def health_check():
    return {"status": "ok"}

@app.get("/api/admin/test-email")
async def test_email():
    test_order = {
        "e_signature": "LOreal Test",
        "bag_size": "Small",
        "total_price": 10.0,
        "is_mvcc": True,
    }
    send_order_alert(test_order)
    return {"status": f"Test email sent to {ADMIN_EMAIL}"}

@app.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks):
    price = calculate_price(order_data.bag_size, order_data.is_mvcc)
    now = datetime.now()
    new_order = {
        **order_data.model_dump(),
        "total_price": price,
        "status": "Awaiting Pickup",
        "status_history": [{"status": "Awaiting Pickup", "timestamp": now}],
        "created_at": now,
        "payment_reported": False,
    }
    result = await db.orders.insert_one(new_order)
    new_order["id"] = str(result.inserted_id)
    background_tasks.add_task(send_order_alert, new_order)
    return new_order

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"_id": order_id})
    if order:
        return order
    raise HTTPException(
        status_code=status.HTTP_404_NOT_FOUND,
        detail="Order not found"
    )

@app.post("/orders/{order_id}/report-payment")
async def report_payment(order_id: str, method: str):
    await db.orders.update_one(
        {"_id": order_id},
        {"$set": {"payment_reported": True, "payment_method": method}},
    )
    return {"status": "success"}

@app.post("/api/payments/create-checkout-session/{order_id}")
async def create_checkout_session(order_id: str):
    order = await db.orders.find_one({"_id": order_id})
    if not order:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Order not found"
        )
    try:
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"{order.get('bag_size')} Laundry Bag Service"},
                    "unit_amount": int(order.get("total_price", 0) * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{FRONTEND_URL}/success",
            cancel_url=f"{FRONTEND_URL}/cancel",
        )
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(e)
        )

# ==============================================================================
# Static File Mounting (Optional frontend delivery)
# ==============================================================================
if os.path.exists("backend/static"):
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")

    @app.get("/")
    async def serve_frontend():
        return FileResponse("backend/static/index.html")
        
# Place this at the VERY BOTTOM of backend/main.py (after all other API routes)
if os.path.exists("backend/static"):
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Allow static files to be served directly if they exist
        file_path = os.path.join("backend/static", full_path)
        if os.path.isfile(file_path):
            return FileResponse(file_path)
        # Otherwise fall back to index.html for client-side routing
        return FileResponse("backend/static/index.html")
