import os
import json
import urllib.request
import smtplib
from datetime import datetime, timedelta
from typing import List, Optional
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import FastAPI, HTTPException, Depends, status, BackgroundTasks, File, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel, Field
from motor.motor_asyncio import AsyncIOMotorClient
import stripe

# Configuration
SECRET_KEY = os.getenv("JWT_SECRET", "sour-apple-super-secret-key")
ALGORITHM = "HS256"
MONGODB_URL = os.getenv("MONGODB_URL", "mongodb://localhost:27017")
SMTP_USER = os.getenv("SMTP_USER", "your-gmail@gmail.com")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD")
RESEND_API_KEY = os.getenv("RESEND_API_KEY")
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "natture1st@gmail.com")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY", "")
stripe.api_key = STRIPE_SECRET_KEY

# 1. Initialize FastAPI App
app = FastAPI(title="Sour Apple Wash & Fold VIP Laundry Services API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

client = AsyncIOMotorClient(MONGODB_URL)
db = client.sour_apple_laundry

# 2. Data Models
class OrderCreate(BaseModel):
    bag_size: str  # 'Small', 'Medium', 'Large'
    is_mvcc: bool = False
    add_ons: List[str] = []
    digital_contract_accepted: bool = True
    e_signature: str
    bag_photo_url: Optional[str] = None
    photos: List[str] = []

class Order(OrderCreate):
    id: str
    total_price: float
    status: str = "Pending"
    status_history: List[dict] = []
    created_at: datetime
    payment_reported: bool = False
    payment_method: Optional[str] = None

class ApproveBody(BaseModel):
    price: Optional[float] = None
    pickup_window: Optional[str] = None
    delivery_window: Optional[str] = None
    admin_note: Optional[str] = ""

class RejectBody(BaseModel):
    reason: str = ""

class StatusUpdate(BaseModel):
    status: str

# 3. Helpers & Email Notifications
def calculate_price(bag_size: str, is_mvcc: bool) -> float:
    prices = {
        "Small": 10.0 if is_mvcc else 20.0,
        "Medium": 20.0 if is_mvcc else 30.0,
        "Large": 30.0 if is_mvcc else 40.0
    }
    return prices.get(bag_size, 0.0)

def send_order_alert(order: dict):
    subject = f"New Laundry Order: {order.get('e_signature')}"
    photo_html = ""
    photo = order.get("bag_photo_url") or (order.get("photos") and order.get("photos")[0])
    if photo:
        photo_html = f"<p><b>Bag Photo:</b><br><img src='{photo}' style='max-width:300px;border-radius:12px;'></p>"
        
    html = f"""
    <html><body>
    <h2>New Order Received - Sour Apple Wash & Fold</h2>
    <p><b>Customer:</b> {order.get('e_signature')}</p>
    <p><b>Bag Size:</b> {order.get('bag_size')}</p>
    <p><b>Total Price:</b> ${order.get('total_price')}</p>
    <p><b>MVCC Student:</b> {order.get('is_mvcc')}</p>
    <p><b>Digital Signature:</b> {order.get('e_signature')}</p>
    {photo_html}
    <hr>
    <p><a href="https://sourapplelaundry.com/admin" style="background:#16a34a;color:white;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:bold;">Review & Approve in Admin Portal</a></p>
    </body></html>"""
    
    if RESEND_API_KEY:
        try:
            url = "https://api.resend.com/emails"
            headers = {"Authorization": f"Bearer {RESEND_API_KEY}", "Content-Type": "application/json"}
            data = json.dumps({"from": "onboarding@resend.dev", "to": ADMIN_EMAIL, "subject": subject, "html": html}).encode("utf-8")
            req = urllib.request.Request(url, data=data, headers=headers, method="POST")
            with urllib.request.urlopen(req) as response:
                return response.read()
        except Exception as e:
            print(f"Resend email error: {e}")
    elif SMTP_PASSWORD and SMTP_USER:
        try:
            msg = MIMEMultipart()
            msg["From"] = SMTP_USER
            msg["To"] = ADMIN_EMAIL
            msg["Subject"] = subject
            msg.attach(MIMEText(html, "html"))
            with smtplib.SMTP("smtp.gmail.com", 587) as server:
                server.starttls()
                server.login(SMTP_USER, SMTP_PASSWORD)
                server.send_message(msg)
        except Exception as e:
            print(f"SMTP email error: {e}")

# 4. Customer Order Endpoints
@app.post("/orders", response_model=Order)
async def create_order(order_data: OrderCreate, background_tasks: BackgroundTasks):
    price = calculate_price(order_data.bag_size, order_data.is_mvcc)
    
    new_order = {
        **order_data.dict(),
        "total_price": price,
        "status": "Pending Admin Approval",
        "status_history": [{"status": "Pending Admin Approval", "timestamp": datetime.now()}],
        "created_at": datetime.now(),
        "payment_reported": False
    }
    
    result = await db.orders.insert_one(new_order)
    new_order["id"] = str(result.inserted_id)
    background_tasks.add_task(send_order_alert, new_order)
    return new_order

@app.get("/orders/{order_id}")
async def get_order(order_id: str):
    order = await db.orders.find_one({"$or": [{"id": order_id}, {"_id": order_id}]})
    if order:
        order["id"] = str(order.get("id") or order.get("_id"))
        order.pop("_id", None)
        return order
    raise HTTPException(status_code=404, detail="Order not found")

@app.post("/orders/{order_id}/report-payment")
async def report_payment(order_id: str, method: str):
    await db.orders.update_one(
        {"$or": [{"id": order_id}, {"_id": order_id}]},
        {"$set": {"payment_reported": True, "payment_method": method}}
    )
    return {"status": "success"}

@app.post("/api/payments/create-checkout-session/{order_id}")
async def create_checkout_session(order_id: str):
    order = await db.orders.find_one({"$or": [{"id": order_id}, {"_id": order_id}]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    try:
        frontend_url = os.getenv("FRONTEND_URL", "https://sourapplelaundry.com")
        checkout_session = stripe.checkout.Session.create(
            payment_method_types=["card"],
            line_items=[{
                "price_data": {
                    "currency": "usd",
                    "product_data": {"name": f"{order.get('bag_size', 'Standard')} Laundry Bag Service"},
                    "unit_amount": int(order.get("total_price", 0) * 100),
                },
                "quantity": 1,
            }],
            mode="payment",
            success_url=f"{frontend_url}/success",
            cancel_url=f"{frontend_url}/cancel",
        )
        return {"url": checkout_session.url}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# 5. Restored Admin Endpoints
@app.get("/api/admin/orders")
async def get_admin_orders(status_filter: Optional[str] = None):
    query = {}
    if status_filter and status_filter != "All":
        query["status"] = status_filter
    cursor = db.orders.find(query).sort("created_at", -1)
    orders = []
    async for doc in cursor:
        doc["id"] = str(doc.get("id") or doc.get("_id"))
        doc.pop("_id", None)
        orders.append(doc)
    return orders

@app.post("/api/admin/orders/{order_id}/approve")
async def approve_order(order_id: str, body: ApproveBody = ApproveBody()):
    order = await db.orders.find_one({"$or": [{"id": order_id}, {"_id": order_id}]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")
    
    updates = {"status": "Approved"}
    if body.price is not None:
        updates["total_price"] = body.price
    if body.pickup_window:
        updates["pickup_window"] = body.pickup_window
    if body.delivery_window:
        updates["delivery_window"] = body.delivery_window
    if body.admin_note:
        updates["admin_note"] = body.admin_note

    await db.orders.update_one(
        {"$or": [{"id": order_id}, {"_id": order_id}]},
        {
            "$set": updates,
            "$push": {"status_history": {"status": "Approved", "timestamp": datetime.now()}}
        }
    )
    return {"status": "success", "message": f"Order {order_id} approved"}

@app.post("/api/admin/orders/{order_id}/reject")
async def reject_order(order_id: str, body: RejectBody = RejectBody()):
    order = await db.orders.find_one({"$or": [{"id": order_id}, {"_id": order_id}]})
    if not order:
        raise HTTPException(status_code=404, detail="Order not found")

    await db.orders.update_one(
        {"$or": [{"id": order_id}, {"_id": order_id}]},
        {
            "$set": {"status": "Rejected", "admin_note": body.reason},
            "$push": {"status_history": {"status": "Rejected", "timestamp": datetime.now()}}
        }
    )
    return {"status": "success", "message": f"Order {order_id} rejected"}

@app.post("/api/admin/orders/{order_id}/status")
async def admin_update_status(order_id: str, body: StatusUpdate):
    await db.orders.update_one(
        {"$or": [{"id": order_id}, {"_id": order_id}]},
        {
            "$set": {"status": body.status},
            "$push": {"status_history": {"status": body.status, "timestamp": datetime.now()}}
        }
    )
    return {"status": "success", "status": body.status}

@app.get("/api/admin/test-email")
async def test_email():
    test_order = {"e_signature": "LOreal Test", "bag_size": "Small", "total_price": 10.0, "is_mvcc": True}
    send_order_alert(test_order)
    return {"status": f"Test email sent to {ADMIN_EMAIL}"}

# 6. Static & Frontend Route Serving
os.makedirs("backend/static", exist_ok=True)
app.mount("/static", StaticFiles(directory="backend/static"), name="static")

@app.get("/")
async def serve_frontend():
    return FileResponse("backend/static/index.html")

@app.get("/admin")
async def serve_admin():
    return FileResponse("backend/static/admin.html")
