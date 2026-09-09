@@
 class OrderCreate(BaseModel):
@@
     photos: List[str] = []           # base64 strings (optional)
     referral_code: str = ""
     contract_agreed: bool = True
     signature_name: str = ""          # Customer's typed legal name
     signed_at: Optional[str] = None   # Timestamp when signed
+
+    # --- New fields for bag photo review and per-bag pricing ---
+    bag_image_base64: Optional[str] = None
+    image_review_requested: bool = False
+    image_review_email: Optional[str] = "natture1st@gmail.com"
+    bag_price_each: Optional[float] = None
@@
     def now_iso() -> str:
         return datetime.utcnow().isoformat() + "Z"
@@
     order = {
@@
-        "photos": body.photos,
+        "photos": [body.bag_image_base64] if body.bag_image_base64 else body.photos,
+        "bag_image_base64": body.bag_image_base64,
+        "image_review_requested": body.image_review_requested,
+        "image_review_email": body.image_review_email,
+        "bag_price_each": body.bag_price_each,
*** End Patch
