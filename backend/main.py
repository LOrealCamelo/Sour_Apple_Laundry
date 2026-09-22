from pydantic import BaseModel
from typing import Optional, List
from fastapi.responses import FileResponse
from datetime import datetime

# --- Restored Admin Models ---
class ApproveBody(BaseModel):
    price: Optional[float] = None
    pickup_window: Optional[str] = None
    delivery_window: Optional[str] = None
    admin_note: Optional[str] = ""

class RejectBody(BaseModel):
    reason: str = ""

class StatusUpdate(BaseModel):
    status: str

# --- Restored Admin Routes ---

@app.get("/admin")
async def serve_admin_portal():
    """Serves the admin web view when visiting /admin."""
    return FileResponse("backend/static/admin.html")

@app.get("/api/admin/orders")
async def get_admin_orders(status_filter: Optional[str] = None):
    """Fetches all orders, bag photos, and signatures for admin review."""
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
    """Sets order to Approved and records timestamp."""
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
    """Sets order to Rejected with reason note."""
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
