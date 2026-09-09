---
*** Begin Patch
*** Update File: frontend/app/admin-order/[id].tsx
@@
-        {/* Messages Card */}
-        <Card>
-          <h2 className="font-bold text-sm mb-3" style={{ color: colors.text || "#fff" }}>
-            Messages
-          </h2>
-          <OrderChat orderId={id!} myRole="ADMIN" />
-        </Card>
+        {/* Messages Card */}
+        <Card>
+          <h2 className="font-bold text-sm mb-3" style={{ color: colors.text || "#fff" }}>
+            Messages
+          </h2>
+          <OrderChat orderId={id!} myRole="ADMIN" />
+        </Card>
@@
-            <div className="space-y-2">
-              <Btn
-                title="Approve Request"
-                onClick={approve}
-                loading={busy}
-                data-testid="approve-button"
-              />
-              <Btn
-                title="Reject"
-                variant="ghost"
-                onClick={reject}
-                data-testid="reject-button"
-              />
-            </div>
+            <div className="space-y-2">
+              <Btn
+                title="Approve Request"
+                onClick={approve}
+                loading={busy}
+                data-testid="approve-button"
+              />
+              <Btn
+                title="Reject"
+                variant="ghost"
+                onClick={reject}
+                data-testid="reject-button"
+              />
+            </div>
*** End Patch
