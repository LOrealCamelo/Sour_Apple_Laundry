# Order Image Review & Approval

This document describes the new image review and branded-bag workflow for Sour Apple VIP Laundry.

Summary

- New order fields (sent in the POST /orders body):
  - `bag_image_base64` (optional): Data URL (string) containing the customer bag photo (image/png or image/jpeg).
  - `image_review_requested` (bool): true if the customer requested bag review / branded-bag purchase.
  - `image_review_email` (string): admin/backup email; default: `natture1st@gmail.com`.
  - `bag_price_each` (float): Optional per-bag price when purchasing a branded bag.

Launch Behavior (Option A: Base64-in-JSON)

- The frontend sends `bag_image_base64` inside the order creation JSON payload. The backend stores the image by:
  - pushing the data URL into the existing `photos` array (e.g. `photos[0] = bag_image_base64`) for compatibility with the UI, and
  - saving `bag_image_base64`, `image_review_requested`, `image_review_email`, and `bag_price_each` as top-level order fields.
- Orders that set `image_review_requested === true` remain in `Pending Admin Approval` until an admin reviews the image and approves or rejects the order.
- The admin UI (Admin Order Detail) displays the customer image (from `photos[0]`) and shows Approve / Reject actions. For now those buttons reuse the existing `/admin/orders/{order_id}/approve` and `/admin/orders/{order_id}/reject` endpoints.

Recommended API endpoints (examples)

- POST /admin/orders/{order_id}/approve
  - Current endpoint reused to approve an order (set `status = "Approved"`) and optionally update `price`, `pickup_window`, `delivery_window`, or `admin_note`.
- POST /admin/orders/{order_id}/reject
  - Current endpoint reused to reject an order (set `status = "Rejected"` or `Needs Customer Follow-Up`) and include a `reason`.

Optional (separation of concerns)

- POST /admin/orders/{order_id}/approve-image
  - Mark the image approved, optionally continue to payment or mark order `Approved`.
- POST /admin/orders/{order_id}/reject-image
  - Mark the image rejected and set `admin_note` explaining required fixes; set `status = "Needs Customer Follow-Up"`.

Notification & Email Routing

- Current `notify(...)` helper writes to the `notifications` collection only. When email sending is enabled, send emails as well.
- Immediate recommendations (to be implemented when email is enabled):
  - When `image_review_requested === true` on order creation, notify the seeded admin account and send an email to `natture1st@gmail.com`.
  - Email templates (examples) are below.

Example email templates

Image review email
Subject: [Sour Apple] Bag Photo Requires Review — Order {order.code}

Body:
```
Order: {order.code}
Customer: {order.student_name} — {order.phone}
Claimed size: {order.service_type} · Qty: {order.bags}
Bag price (each): ${order.bag_price_each || 'N/A'}
Review image: {image_url or inline preview}
Admin review: {FRONTEND_ADMIN_URL}/admin-order/{order.id}
Approve: POST /admin/orders/{order.id}/approve
Reject: POST /admin/orders/{order.id}/reject
Notes: Please include any adjustments to price or required changes in the admin note.
```

Payment approval email
Subject: [Sour Apple] Payment Approval Needed — Order {order.code}

Body: similar format directing admin to review payment and the admin order detail.

Security, Storage & Migration Notes

- Option A (current): Keeping Base64 in JSON is OK for a small pilot, but it has drawbacks:
  - Large JSON payloads, slower uploads, and bigger database documents.
  - Serving images from the DB as data URLs works but is inefficient.
- Recommended production migration (high priority):
  - Use presigned uploads to object storage (S3/MinIO). The frontend should upload the image directly to storage and send the storage URL in the order POST. Store only the URL in the DB.

Immediate validation rules (apply even while using Base64):
- Allow only `image/jpeg` and `image/png` content types.
- Enforce a max size after base64 decode (recommend <= 5 MB).
- Sanitize inputs and never execute uploaded content.

Audit fields

- Consider storing review metadata on the order for traceability:
  - `image_review_by` (admin user id), `image_review_at` (timestamp), `image_review_reason` (string).

Admin UI Notes

- Admin Order Detail shows `order.photos[0]` if present. The Approve / Reject buttons reuse existing endpoints and reload the order after action.
- If you want dedicated image-approval endpoints, we can add them and record the approver and timestamp in audit fields.

Testing Checklist

1. Create an order with `bag_image_base64` and `image_review_requested = true` using the Schedule page.
2. Inspect the orders collection: confirm `photos[0]` contains the data URL string and the other fields are present.
3. Open the Admin Order Detail for that order: confirm image preview appears and Approve / Reject buttons update order status and create notifications.

Operational Notes

- Rate-limit uploads and validate client-side before submitting.
- Migrate to presigned uploads before high-volume traffic.
- When enabling email, do not embed API keys in the repo — use environment variables and secret management.

