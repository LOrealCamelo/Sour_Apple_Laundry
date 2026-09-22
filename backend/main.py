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
from fastapi.responses import FileResponse, HTMLResponse
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
    try:
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
    except Exception as e:
        print(f"Error fetching orders: {e}")
        return []

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

# 6. Embedded Admin Portal View (Zero File Dependency)
ADMIN_HTML = """<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sour Apple Laundry — Admin Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-gray-100 min-h-screen text-gray-800 font-sans p-4 sm:p-8">
    <div class="max-w-5xl mx-auto">
        <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
            <div>
                <h1 class="text-2xl font-black text-green-700">Sour Apple Wash &amp; Fold</h1>
                <p class="text-sm text-gray-500">Order Approval &amp; Bag Verification Portal</p>
            </div>
            <button onclick="loadOrders()" class="bg-green-600 hover:bg-green-700 text-white font-bold px-4 py-2 rounded-xl text-sm transition">
                Refresh Orders
            </button>
        </header>

        <div id="orders-container" class="space-y-4">
            <div class="text-center py-12 text-gray-500">Loading orders...</div>
        </div>
    </div>

    <!-- Image Enlarge Modal -->
    <div id="img-modal" class="fixed inset-0 bg-black/75 z-50 hidden flex items-center justify-center p-4" onclick="this.classList.add('hidden')">
        <img id="modal-img" src="" class="max-w-full max-h-[85vh] rounded-2xl shadow-2xl object-contain bg-white">
    </div>

    <script>
        async function loadOrders() {
            const container = document.getElementById('orders-container');
            try {
                const res = await fetch('/api/admin/orders');
                const orders = await res.json();

                if (!orders || orders.length === 0) {
                    container.innerHTML = `<div class="bg-white p-8 rounded-2xl text-center text-gray-500 border border-gray-200">No orders found.</div>`;
                    return;
                }

                container.innerHTML = orders.map(order => {
                    const photo = order.bag_photo_url || (order.photos && order.photos[0]) || '';
                    const status = order.status || 'Pending';
                    const isApproved = status === 'Approved';
                    const isRejected = status === 'Rejected';

                    return `
                        <div class="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-6 items-start md:items-center justify-between">
                            <div class="flex gap-4 items-center">
                                ${photo ? `
                                    <img src="${photo}" onclick="enlargeImg('${photo}')" class="w-24 h-24 rounded-xl object-cover border-2 border-green-200 cursor-pointer hover:opacity-90" title="Click to enlarge bag photo">
                                ` : `
                                    <div class="w-24 h-24 rounded-xl bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center text-xs text-gray-400 text-center p-2">
                                        No Photo Uploaded
                                    </div>
                                `}
                                <div>
                                    <div class="flex items-center gap-2 mb-1">
                                        <h3 class="font-bold text-lg">${order.e_signature || order.student_name || 'Customer'}</h3>
                                        <span class="text-xs px-2.5 py-0.5 rounded-full font-semibold ${isApproved ? 'bg-green-100 text-green-800' : isRejected ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'}">
                                            ${status}
                                        </span>
                                    </div>
                                    <p class="text-sm text-gray-600"><b>Bag Size:</b> ${order.bag_size || order.bags || 'Standard'} ${order.is_mvcc ? '<span class="text-xs text-pink-600 font-bold ml-1">(MVCC Discount)</span>' : ''}</p>
                                    <p class="text-sm text-gray-600"><b>Total:</b> $${order.total_price || order.price || '0.00'}</p>
                                    <p class="text-xs text-gray-400 mt-1">Order ID: ${order.id}</p>
                                </div>
                            </div>

                            <div class="flex items-center gap-3 w-full md:w-auto">
                                ${(!isApproved && !isRejected) ? `
                                    <button onclick="approveOrder('${order.id}')" class="flex-1 md:flex-none bg-green-600 hover:bg-green-700 text-white font-bold px-5 py-2.5 rounded-xl text-sm transition">
                                        Approve
                                    </button>
                                    <button onclick="rejectOrder('${order.id}')" class="flex-1 md:flex-none bg-red-100 hover:bg-red-200 text-red-700 font-bold px-4 py-2.5 rounded-xl text-sm transition">
                                        Reject
                                    </button>
                                ` : `
                                    <span class="text-sm text-gray-400 font-medium">Action Completed</span>
                                `}
                            </div>
                        </div>
                    `;
                }).join('');
            } catch (err) {
                container.innerHTML = `<div class="bg-red-50 p-6 rounded-2xl text-red-600 border border-red-200">Error loading orders: ${err.message}</div>`;
            }
        }

        function enlargeImg(url) {
            document.getElementById('modal-img').src = url;
            document.getElementById('img-modal').classList.remove('hidden');
        }

        async function approveOrder(id) {
            const res = await fetch(`/api/admin/orders/${id}/approve`, { method: 'POST' });
            if (res.ok) loadOrders();
            else alert('Failed to approve order');
        }

        async function rejectOrder(id) {
            const reason = prompt('Reason for rejection / size adjustment:') || '';
            const res = await fetch(`/api/admin/orders/${id}/reject`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ reason })
            });
            if (res.ok) loadOrders();
            else alert('Failed to reject order');
        }

        loadOrders();
    </script>
</body>
</html>
"""

# 7. Routes for Admin and Frontend
@app.get("/admin")
async def serve_admin():
    return HTMLResponse(content=ADMIN_HTML)

@app.get("/")
async def serve_frontend():
    for path in ["backend/static/index.html", "static/index.html", "index.html"]:
        if os.path.exists(path):
            return FileResponse(path)
    return HTMLResponse("<h1>Sour Apple Laundry API is running</h1><p><a href='/admin'>Go to Admin Portal</a></p>")

if os.path.exists("backend/static"):
    app.mount("/static", StaticFiles(directory="backend/static"), name="static")
elif os.path.exists("static"):
    app.mount("/static", StaticFiles(directory="static"), name="static")
