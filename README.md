# Carelio Backend

Node.js + TypeScript + Express + MongoDB API for the Carelio MVP.

This increment implements **auth** for doctors, health assistants, and patients, matching the contracts expected by `carelio-mvp`.

## Stack

- Express + TypeScript
- MongoDB (Mongoose)
- JWT access + refresh tokens
- TOTP 2FA (`otplib`)
- Zod validation

## Planned (not in this increment)

- **Cloudinary** for image/file uploads (not AWS S3)
- **LiveKit** for video calls (not Zoom)
- Appointments, patients CRUD, vitals, consultations

## Setup

```bash
cp .env.example .env
# ensure MongoDB is running locally or set MONGODB_URI to Atlas
npm install
npm run seed
npm run dev
```

Server defaults to `http://localhost:4000`.

### Seed credentials

| Role | Identifier | Password |
|------|------------|----------|
| Doctor | `dr.smith@carelio.app` | `Password123!` |
| Health Assistant | `ha.jones@carelio.app` | `Password123!` |
| Patient | `PAT-1001` | (login by patient ID only) |

## Auth routes

- `POST /auth/doctor/register|login|verify-2fa|forgot-password|verify-reset-otp|reset-password|refresh|logout|change-password|setup-2fa|enable-2fa|disable-2fa|regenerate-recovery-codes`
- `GET /auth/doctor/session`
- Same under `/auth/assistant/*` for health assistants
- `POST /auth/patient/login|refresh|logout`
- `GET /auth/patient/session`

Password-reset OTPs are logged to the server console in development.

## Connect frontend (`carelio-mvp`)

In `carelio-mvp/.env`:

```
USE_DUMMY_DATA=false
API_BASE_URL=http://localhost:4000
```

Then restart the Next.js app.
