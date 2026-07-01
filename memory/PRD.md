# Sour Apple VIP Laundry Services — PRD

## Original Problem Statement
Full-stack mobile-first college laundry pickup & delivery app. Students request laundry; Admin approves & adjusts price then releases driver jobs (Pickup/Delivery/Pickup+Delivery); approved 1099 drivers claim/complete jobs (Uber-Eats style); students track order status with a per-order QR code. Requested stack was Node/Express/Postgres/Prisma — **adapted to the platform's FastAPI + MongoDB + Expo (React Native) stack** with equivalent models & routes.

## User Choices
- Auth: JWT email/password, roles STUDENT/ADMIN/DRIVER
- MVP priority: Student + Admin first, Driver next (Driver also implemented functionally)
- AI: real AI via Emergent LLM (gpt-4o)
- Payments: Stripe (implemented as mock checkout placeholder — no keys yet)
- Admin dashboard: role-gated inside the same app

## Architecture
- Backend: `/app/backend/server.py` (FastAPI, motor/MongoDB, JWT via python-jose, bcrypt/passlib). All routes under `/api`.
- Frontend: Expo Router. `src/context/AuthContext.tsx`, `src/api/client.ts` (token in secure storage), `src/theme.ts`, `src/components/UI.tsx`.
- Route groups: `(student)`, `(admin)`, `(driver)` tabs + `order/[id]`, `admin-order/[id]`, `login`, `register`.

## User Personas
- Student: schedules pickups, tracks orders, rates, reorders, referral code.
- Admin: reviews/approves requests, adjusts pricing, releases jobs, assigns drivers, QR lookup, analytics.
- Driver (1099): sees released jobs, claims/requests, updates pickup/delivery workflow.

## Implemented (2026-07-01)
- JWT auth + role redirect; seeded admin/student/driver/campus/plan/pending order.
- Student: price estimate, create order (QR SA-XXXX), my orders, tracking timeline, rate, reorder, profile edit, referral code.
- Admin: requests dashboard w/ filters, approve/reject, adjust price/windows/note, release job (3 types, payout, auto-assign toggle), update laundry status, mark payment, QR lookup, manual/request-based driver assignment, analytics.
- Driver: available jobs, claim/request (auto-assign vs admin approval), my jobs, status workflow → order status mapping, earnings/docs placeholders.
- AI stain tips + support suggestions (Emergent LLM) — code complete; **blocked on LLM key balance**.
- Payments: mock Stripe checkout marks order Paid. Notifications logged to NotificationLog.
- Testing: 27/29 backend pytest pass; frontend E2E verified.

## Backlog
- P0: Top up Emergent LLM key balance to activate AI stain tips / support suggestions.
- P1: Real Stripe integration (keys); item photo upload (base64 wired in model); driver onboarding application form + admin approval of applications; subscription plan checkout.
- P1: Real SMS/Email/Push (Twilio/SendGrid/Expo push).
- P2: More AI placeholders (route optimization, preference prediction, driver matching); driver ratings/earnings real data; campus/pricing/time-slot admin CRUD screens; support message log UI.

## Next Tasks
1. Ask user to top up Universal Key; verify AI endpoints.
2. Driver onboarding application flow + admin applications review.
3. Real Stripe checkout + photo upload UI.
