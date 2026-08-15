# Carelio Server (Backend)

Express + TypeScript + MongoDB API for **Carelio** — a multi-role telehealth MVP (doctors/admins, health assistants, patients): auth & invites, appointments, LiveKit consultation tokens, vitals, device guides, and OpenRouter AI clinical summaries.

| | |
|---|---|
| **Production API** | https://carelio-server-gsh5.onrender.com |
| **Frontend** | https://carelio.vercel.app/ · [carelio-mvp](https://github.com/williyem/carelio-mvp) |
| **This repo** | https://github.com/williyem/carelio-server |

> CSCD602 Advanced Software Engineering — Henneh Kusi William (22427958). Development assisted with [Cursor](https://cursor.com).

## Stack

- Node.js + Express + TypeScript
- MongoDB (Mongoose)
- JWT access + refresh tokens
- Zod request validation
- LiveKit (video room tokens)
- Resend (invite / OTP email)
- OpenRouter (doctor AI clinical summaries)
- Deployed on **Render** (free tier may cold-start 30–60s)

## Setup

```bash
cp .env.example .env
npm install
npm run seed
npm run dev
```

Server: `http://localhost:4000`

### Seed / demo credentials

| Role | Identifier | Password |
|------|------------|----------|
| Admin (doctor) | `admin@carelio.app` | `Password123!` |
| Doctor | `dr.smith@carelio.app` | `Password123!` |
| Health Assistant | `ha.jones@carelio.app` | `Password123!` |
| Patient | `PAT-1001` | `Password123!` |

## Environment

See [`.env.example`](.env.example). Important variables:

| Variable | Purpose |
|----------|---------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET` | JWT signing secrets |
| `CORS_ORIGIN` / `APP_URL` | Frontend origin and invite base URL |
| `RESEND_API_KEY` / `RESEND_FROM` | Email (empty key → console log only) |
| `LIVEKIT_URL` / `LIVEKIT_API_KEY` / `LIVEKIT_API_SECRET` | Video consult tokens |
| `OPEN_ROUTER_API_KEY` / `OPEN_ROUTER_MODEL` | AI summaries (`sk-or-v1-…`) |

Never commit real secrets. Rotate demo passwords after the exam if the API stays public.

## Auth

- `POST /auth/doctor/*` · `POST /auth/assistant/*` · `POST /auth/patient/*`
- Invites: `POST /auth/doctor/invite-patient`, `POST /auth/assistant/invite-patient`, `POST /auth/patient/invite`
- Staff invite complete: `/auth/staff/*`

## Patients

| Method | Path |
|--------|------|
| GET | `/patients` (`search`, `page`, `limit`) |
| GET | `/patients/assigned` (`assistantId`, `search`, `page`, `limit`) |
| GET | `/patients/unassigned` |
| GET | `/patients/:id` |
| POST | `/patients` (register) |
| PATCH | `/patients/:id` |
| DELETE | `/patients/:id` (soft) |
| POST | `/patients/assign` |
| DELETE | `/patients/:patientId/unassign` |
| POST | `/patients/:id/verify/email\|code` |
| GET | `/patients/:patientId/appointments` |
| POST | `/patients/:id/ai/summary` (doctor clinical summary) |

## Profile & stats

| Method | Path |
|--------|------|
| GET | `/doctor/profile` |
| GET | `/health-assistant/profile` |
| GET | `/stats` |

## Appointments & consultations

| Method | Path |
|--------|------|
| GET | `/appointments` (`status`, `startDate`, `endDate`, `page`, `limit`) |
| GET | `/appointments/upcoming` |
| GET | `/appointments/recent` |
| POST | `/appointments` |
| PATCH | `/appointments/:id/reschedule` |
| PATCH | `/appointments/:id/cancel` |
| GET | `/consultations/appointments/:id` |
| GET | `/consultations/:id/token/doctor` · `/token/patient` |
| POST | `/consultations/.../ai/summary` (visit AI summary) |

## Device guides

Admin-managed device catalog (steps, tips, media) used by health assistants during visits. CRUD under device-guide routes (see source under `src/routes`).

## Frontend pairing

```
USE_DUMMY_DATA=false
API_BASE_URL=http://localhost:4000
```

Production frontend should point `API_BASE_URL` at this Render service.

## Email (Resend)

Patient invites and email OTPs are sent with Resend.

| Variable | Purpose |
|----------|---------|
| `RESEND_API_KEY` | Resend API key (leave empty to log to console only) |
| `RESEND_FROM` | Sender, e.g. `Carelio <noreply@henneh.online>` |
| `APP_URL` | Base URL for invite links |

### Demo invite flow

1. Staff invites a patient with an email address.
2. Backend emails the invite link (or logs it if no API key).
3. Response also includes `inviteLink` for copy-paste.
4. Open `/patient-invite?token=...` on the frontend to complete registration.

### Test email (dev only)

```bash
curl http://localhost:4000/dev/mail-status
curl -X POST http://localhost:4000/dev/test-email \
  -H "Content-Type: application/json" \
  -d '{"to":"your@email.com"}'
```

## Video (LiveKit)

| Variable | Purpose |
|----------|---------|
| `LIVEKIT_URL` | WebSocket URL, e.g. `wss://your-project.livekit.cloud` |
| `LIVEKIT_API_KEY` | Project API key |
| `LIVEKIT_API_SECRET` | Project API secret |

Token endpoints return `{ token, code, url }` for doctor and patient.

## AI summaries (OpenRouter)

Doctor-only endpoints generate and cache:

- Longitudinal **patient** clinical summary (`Patient.aiClinicalSummary`)
- Per-visit **appointment** summary (`Appointment.aiVisitSummary`)

Requires a valid `OPEN_ROUTER_API_KEY` (`sk-or-v1-…`). Summaries are assistive only — not a substitute for clinical judgement.

## Evolution note

Current device guides prepare the product for **ErgoCart** (or similar) hardware: guided capture today; live BLE vital streaming into the consultation record is a planned next phase.

## Licence / academic use

Submitted for CSCD602. Demo credentials are for examiner access only.
