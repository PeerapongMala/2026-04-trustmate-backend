# TrustMate — Claude Code Rules

> Claude จะอ่านไฟล์นี้อัตโนมัติทุก session

---

## Project Overview

TrustMate = แอปสุขภาพจิต เน้นไม่ระบุตัวตน + ปลอดภัย
ผู้ใช้โพสต์ระบาย คุยกับ AI "เมท" ทำแบบประเมิน จองคิวจิตแพทย์

---

## Deployed URLs

| ส่วน | URL |
|------|-----|
| Frontend (Vercel) | https://2026-04-trustmate-frontend.vercel.app |
| Backend (Render) | https://two026-04-trustmate-backend.onrender.com/api |
| Admin | https://2026-04-trustmate-frontend.vercel.app/admin |
| Database | Neon PostgreSQL (Singapore) |

## Repos

| Repo | GitHub |
|------|--------|
| Frontend | PeerapongMala/2026-04-trustmate-frontend |
| Backend | PeerapongMala/2026-04-trustmate-backend |
| Design | trustmate/pic/ (1-22.png) |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15 (App Router) + Tailwind CSS v4 + TypeScript |
| Backend | NestJS + TypeScript + Prisma 7 (prisma-client-js CJS) |
| Database | PostgreSQL (Neon, Singapore) |
| AI Chatbot | Mistral AI (mistral-small-latest) — ชื่อ "เมท" |
| AI Moderation | Mistral AI — ตรวจโพสต์ก่อนขึ้น |
| Auth | JWT (Bearer token, localStorage) + Google OAuth + Resend (reset password) |
| Testing | Jest (backend) + Vitest (frontend components) + Playwright (E2E) |
| Deploy | Vercel (frontend) + Render (backend) |

---

## Features — สถานะปัจจุบัน

| Feature | สถานะ | หมายเหตุ |
|---------|--------|---------|
| Auth (login/register/Google/reset) | ✅ เสร็จ | |
| Community (โพสต์/กอด/report) | ✅ เสร็จ | AI moderation ตรวจก่อนโพสต์ |
| AI Chatbot "เมท" | ✅ เสร็จ | เปิด session เก่าต่อ (แบบ A) |
| Today Card | ✅ เสร็จ | ถามวน 6 ข้อ, popup บน Home |
| Today's Mood วงล้อ | ✅ เสร็จ | เปิด 12:00-23:59, 8 อารมณ์ |
| แบบประเมิน PSS-10 + PHQ-9 | ✅ เสร็จ | trigger จาก mood ≥57% ลบใน 7 วัน |
| HelpLine | ✅ เสร็จ | สายด่วน 1323 |
| Booking จิตแพทย์ | ✅ เสร็จ | 3 steps, sort by rating |
| Admin Panel | ✅ เสร็จ | dashboard + CRUD + moderation |
| Profile | ✅ เสร็จ | แก้ไข + mood graph + Today Card collection |

## Business Logic สำคัญ

### วงล้ออารมณ์
- เปิด 12:00-23:59 เท่านั้น
- 8 อารมณ์: เบื่อหน่าย, สับสน, ประหลาดใจ, กลัว, กังวล, อาย, เศร้าซึม, เปล่าเปลี่ยว
- อารมณ์ลบ: เศร้าซึม, เปล่าเปลี่ยว, กลัว, กังวล
- ถ้า 7 วันย้อนหลัง mood ลบ ≥ 4 วัน (57%, อ้างอิง PHQ-9) → prompt ให้ทำแบบประเมิน

### แบบประเมิน
- PSS-10 (เครียด): 10 ข้อ, 0-4 ต่อข้อ, **ข้อ 4,5,7,8 คิดคะแนนกลับ**, max 40
- PHQ-9 (ซึมเศร้า): 9 ข้อ, 0-3 ต่อข้อ, max 27
- เกณฑ์ PHQ-9: 0-4 น้อยมาก / 5-9 เล็กน้อย / 10-14 ปานกลาง / 15-19 รุนแรงปานกลาง / 20-27 รุนแรงสูง

### AI Chatbot "เมท"
- เน้นรับฟัง + ให้กำลังใจ ไม่ถามคำถามตลอด
- ไม่อวย ไม่ปลอบแบบผิวเผิน
- ห้ามวินิจฉัยโรค สั่งยา
- ถ้ารุนแรง → แนะนำสายด่วน 1323
- เปิด session เก่าต่อได้ (ประวัติ chat อยู่ใน DB)

### AI Post Moderation
- ตรวจ 4 อย่าง: สแปม, ไม่เหมาะสม, ชักชวนทำร้าย, ด่า/ข่มขู่
- clean → โพสต์เลย / flagged → โพสต์ได้ admin เห็น / blocked → บล็อก
- Fail-safe: Mistral error → flag pending ไม่ใช่ block

### Today Card
- ถามวน 6 ข้อ (cycle by day-of-year)
- popup บน Home ถ้ายังไม่ตอบวันนี้

---

## Routes (21 หน้า)

```
Auth:
  /splash              Splash → auto redirect
  /login               Login (email + Google)
  /register            Register
  /forgot-password     ลืมรหัสผ่าน
  /reset-password      ตั้งรหัสใหม่
  /auth/google/callback  Google OAuth callback

Main (มี bottom nav):
  /                    Home — Community feed + Today Card popup
  /create-post         สร้างโพสต์
  /mood                วงล้ออารมณ์ (12:00-23:59)
  /chat                AI Chatbot "เมท"
  /care                สายด่วน + Book a Session
  /care/assessment     แบบประเมิน (เลือกชุด → intro → คำถาม → ผล)
  /care/booking        จองคิว (3 steps)
  /profile             โปรไฟล์ + mood graph + Today Card

Admin:
  /admin               Dashboard
  /admin/posts         จัดการโพสต์
  /admin/reports       จัดการ reports
  /admin/therapists    จัดการที่ปรึกษา
  /admin/questions     จัดการคำถาม
```

## Bottom Navigation (4 tabs)

| Tab | Route | Icon |
|-----|-------|------|
| Home | / | 🏠 filled circle |
| Chat | /chat | 💬 filled circle |
| Care | /care | ❤️ filled circle |
| Profile | /profile | 👤 filled circle |

---

## Design Files (trustmate/pic/)

| File | หน้า |
|------|------|
| 1.png | Brand Guide — colors, logo, concept |
| 2.png | Splash |
| 3.png | Login |
| 4.png | Register |
| 5.png | Community Feed |
| 6.png | Today Card popup (overlay บน Home) |
| 7.png | Today's Mood วงล้อ |
| 8.png | Create Post |
| 9.png | AI Chatbot เมท |
| 10.png | แบบประเมิน Intro |
| 11-13.png | แบบประเมิน คำถาม (5 emoji scale) |
| 14.png | แบบประเมิน ผลลัพธ์ |
| 15.png | Care — สายด่วน + Book a Session |
| 16-17.png | Booking Step 1 เลือกหมอ |
| 18.png | Booking Step 2 เลือกวัน/เวลา |
| 19.png | Community Feed (มุมมองเพิ่ม) |
| 20.png | Profile + mood graph + Today Card |
| 21-22.png | (ไม่ใช้ — Safe Talk เดิม ถูกแทนด้วย AI Chat) |

## Color Palette

```
bg:      #FFFCF4  ← พื้นหลังทุกหน้า (ห้ามขาวล้วน)
light:   #D8E1ED  ← card bg, input, bottom nav
blue:    #B1C9EB  ← user chat bubble
orange:  #E47B18  ← CTA button, accent
navy:    #31356E  ← heading, active nav
gray:    #494F56  ← body text
```

---

## Hard Rules

- ❌ ห้ามใช้สีนอก palette
- ❌ ห้าม `#FFFFFF` เป็น background — ใช้ `#FFFCF4`
- ❌ ห้าม hardcode secrets
- ❌ ห้าม expose authorId ใน anonymous posts
- ❌ ห้าม log chat content
- ❌ ห้ามแก้ scoring logic โดยไม่มี test — PSS-10 reverse scoring ผิดแล้วอันตราย
- ✅ Logo ใช้ `/logo.png` (crop จาก design) ห้ามใช้ SVG วาดเอง
- ✅ ทุก admin route ต้องมี JwtAuthGuard + RolesGuard('admin')
- ✅ Booking ใช้ Prisma transaction ป้องกัน race condition

---

## Tests — 263 tests

| Tier | Framework | Tests |
|------|-----------|-------|
| Backend Unit | Jest | 131 |
| Backend Integration | Supertest | 18 |
| Frontend Components | Vitest | 31 |
| Frontend E2E | Playwright | 83 |

Coverage: Assessment 90%+, Auth 90%+

---

## TODO — ยังไม่ได้ทำ

### รอถามทีม
- [ ] Chat: เปลี่ยนเป็นแบบ B (เริ่มใหม่ + ปุ่มดูประวัติ) แทนแบบ A ปัจจุบัน?
- [ ] Notification: push notification (ทำตอน mobile phase)

### ยังไม่ implement
- [ ] วงล้อบังคับเล่นก่อนใช้แอป (ไปหน้าไหนไม่ได้ถ้ายังไม่ทำวันนี้)
- [ ] Today Card: เวลาเปิด 12:00-23:59 + ปิดได้ + เปิดใหม่ได้
- [ ] Mobile app (React Native — Phase 7)

---

## Env Variables (Backend .env)

```
DATABASE_URL=postgresql://... (Neon Singapore)
JWT_SECRET=...
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_CALLBACK_URL=https://two026-04-trustmate-backend.onrender.com/api/auth/google/callback
FRONTEND_URL=https://2026-04-trustmate-frontend.vercel.app
MISTRAL_API_KEY=...
RESEND_API_KEY=...
PORT=4000
```

## Env Variables (Frontend)

```
NEXT_PUBLIC_API_URL=https://two026-04-trustmate-backend.onrender.com/api
```
