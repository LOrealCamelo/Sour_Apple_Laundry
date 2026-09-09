---
*** Begin Patch
*** Update File: frontend/app/(student)/schedule.tsx
@@
-          <p className="text-xs text-zinc-400 mb-2">
-            Heavy-duty, water-resistant drawstring closure bags in <strong>Girl Apple</strong> and <strong>Boy Apple</strong> styles. Small 27" (${BAG_SIZES[0].publicPrice}) , Medium 32" (${BAG_SIZES[1].publicPrice}), Large 40" (${BAG_SIZES[2].publicPrice}).
-          </p>
-
-          <div
-            className="p-2.5 rounded-xl border text-center text-xs text-zinc-300"
-            style={{ backgroundColor: colors.surfaceAlt || "#111", borderColor: colors.border || "#222" }}
-          >
-            🌟 Custom branded bags with drawstring closures are in production! In the meantime, please use any standard bag with a drawstring, zipper, Velcro, or snap buttons.
-          </div>
+          <div className="grid grid-cols-2 gap-2 items-center mb-2">
+            <img src="/assets/images/girl-apple.jpg" alt="Girl Apple bag mockup" className="w-full h-24 object-contain rounded" />
+            <img src="/assets/images/boy-apple.jpg" alt="Boy Apple bag mockup" className="w-full h-24 object-contain rounded" />
+          </div>
+
+          <p className="text-xs text-zinc-400 mb-2">
+            Heavy-duty, water-resistant drawstring closure bags in <strong>Girl Apple</strong> and <strong>Boy Apple</strong> styles. Small 27" (${BAG_SIZES[0].publicPrice}), Medium 32" (${BAG_SIZES[1].publicPrice}), Large 40" (${BAG_SIZES[2].publicPrice}).
+          </p>
+
+          <div className="p-2.5 rounded-xl border text-center text-xs text-zinc-300" style={{ backgroundColor: colors.surfaceAlt || "#111", borderColor: colors.border || "#222" }}>
+            🌟 Custom branded bags with drawstring closures are in production! In the meantime, please use any standard bag with a drawstring, zipper, Velcro, or snap buttons.
+          </div>
*** End Patch
