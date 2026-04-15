# TrustMate — Implementation Plan

## Project Overview

แอปสุขภาพจิต เน้นความปลอดภัยและไม่ระบุตัวตน ให้ผู้ใช้โพสต์ระบายความรู้สึก พูดคุยกันผ่าน voice room และสะท้อนตัวเองผ่าน Today Card

## Tech Stack

| Layer     | Technology                                          |
| --------- | --------------------------------------------------- |
| Frontend  | Next.js 15 (App Router) + Tailwind CSS + TypeScript |
| Backend   | NestJS + TypeScript                                 |
| Database  | PostgreSQL + Prisma ORM                             |
| Voice     | LiveKit (WebRTC)                                    |
| Real-time | Socket.io                                           |
| Auth      | JWT + Google OAuth                                  |

## Repository

| Repo     | Path                                                     |
| -------- | -------------------------------------------------------- |
| Frontend | `trustmate/frontend/` → `2026-04-trustmate-frontend.git` |
| Backend  | `trustmate/backend/` → `2026-04-trustmate-backend.git`   |
| Design   | `trustmate/pic/`                                         |

## Features Summary

| #   | Feature    | Description                                                     |
| --- | ---------- | --------------------------------------------------------------- |
| 1   | Auth       | Register (email+password, ตั้งนามแฝง), Login, Google OAuth      |
| 2   | Community  | โพสต์ไม่ระบุตัวตน, เลือก tag, กดอีโมจิกอด, ไม่มีคอมเมนต์        |
| 3   | Safe Talk  | Voice room แบบ Clubhouse, สร้างห้อง, JOIN, quick reply, Goodbye |
| 4   | Today Card | คำถามประจำวัน, พิมพ์คำตอบ, เก็บสะสมใน Profile                   |
| 5   | HelpLine   | หน้า static แสดงเบอร์สายด่วนสุขภาพจิต                           |
| 6   | Profile    | นามแฝง, คำอธิบาย, เก็บ Today Card ที่เคยทำ                      |

## Bottom Navigation

| Tab          | Feature                              |
| ------------ | ------------------------------------ |
| 🏠 Home      | Community feed                       |
| 🎙 Safe Talk | Voice room list                      |
| 📞 HelpLine  | เบอร์สายด่วน                         |
| 👤 Profile   | ข้อมูลผู้ใช้ + Today Card collection |

---

## Phase 1: Foundation

**เป้าหมาย:** Project setup + Auth + Profile พื้นฐาน

### 1.1 Project Setup

**Frontend:**

- [ ] Next.js 15 + TypeScript + Tailwind CSS
- [ ] โครงสร้าง folder (feature-based)
- [ ] Bottom navigation (4 tabs)
- [ ] Layout หลัก + responsive

**Backend:**

- [ ] NestJS + TypeScript
- [ ] PostgreSQL + Prisma setup
- [ ] Database schema (User)
- [ ] API structure (modules, controllers, services)
- [ ] CORS, validation pipe, error handling

### 1.2 Auth

**Database:**

```
User {
  id          String   @id @default(uuid())
  email       String   @unique
  password    String?  (null if Google OAuth)
  alias       String   (นามแฝง)
  bio         String?  (คำอธิบาย)
  avatarColor String?  (สี avatar)
  provider    String   @default("local") (local | google)
  createdAt   DateTime
  updatedAt   DateTime
}
```

**API Endpoints:**

- [ ] POST /auth/register — email + password + นามแฝง
- [ ] POST /auth/login — email + password → JWT
- [ ] POST /auth/google — Google OAuth → JWT
- [ ] GET /auth/me — ข้อมูล user ปัจจุบัน

**Frontend:**

- [ ] หน้า Register (email, password, นามแฝง)
- [ ] หน้า Login (email, password)
- [ ] ปุ่ม Google Login
- [ ] เก็บ JWT ใน httpOnly cookie
- [ ] Auth guard (redirect ถ้ายังไม่ login)

### 1.3 Profile

**API Endpoints:**

- [ ] GET /users/me — ข้อมูล profile
- [ ] PATCH /users/me — แก้นามแฝง, bio, avatarColor

**Frontend:**

- [ ] หน้า Profile — แสดงนามแฝง, bio, avatar
- [ ] ปุ่มข้อมูลผู้ใช้ — แก้ไขนามแฝง, bio

---

## Phase 2: Community + Today Card

**เป้าหมาย:** ฟีเจอร์หลัก 2 ตัวที่ไม่ต้องใช้ real-time ซับซ้อน

### 2.1 Community

**Database:**

```
Post {
  id        String   @id @default(uuid())
  content   String
  tag       String   (#เศร้า #ประหลาดใจ #สุขใจ #โกรธ)
  hugs      Int      @default(0)
  authorId  String   → User
  createdAt DateTime
}

Hug {
  id        String   @id @default(uuid())
  postId    String   → Post
  userId    String   → User
  createdAt DateTime
  @@unique([postId, userId])  // 1 คนกด 1 ครั้งต่อโพสต์
}
```

**API Endpoints:**

- [ ] POST /posts — สร้างโพสต์ (content, tag)
- [ ] GET /posts — feed (pagination, filter by tag)
- [ ] POST /posts/:id/hug — กดอีโมจิกอด
- [ ] DELETE /posts/:id/hug — ยกเลิกกอด

**Frontend:**

- [ ] หน้า Home — feed แสดงโพสต์ (นามแฝง, tag, content, จำนวน hug)
- [ ] ปุ่ม + สร้างโพสต์ (เลือก tag, พิมพ์เนื้อหา)
- [ ] ปุ่มอีโมจิกอด (toggle)
- [ ] Filter by tag

### 2.2 Today Card

**Database:**

```
TodayQuestion {
  id       String @id @default(uuid())
  question String
  date     DateTime @unique  // 1 คำถามต่อวัน
}

TodayCard {
  id         String   @id @default(uuid())
  answer     String
  questionId String   → TodayQuestion
  userId     String   → User
  shared     Boolean  @default(false)  // แชร์ไป Community
  createdAt  DateTime
  @@unique([questionId, userId])  // 1 คนตอบ 1 ครั้งต่อวัน
}
```

**API Endpoints:**

- [ ] GET /today-card — คำถามวันนี้ + คำตอบของ user (ถ้ามี)
- [ ] POST /today-card — ตอบคำถามวันนี้
- [ ] GET /today-card/history — ประวัติ Today Card ของ user
- [ ] POST /today-card/:id/share — แชร์ไป Community

**Frontend:**

- [ ] Today Card popup overlay บน Home
- [ ] แสดงคำถาม + ช่องพิมพ์คำตอบ
- [ ] Profile → grid แสดง Today Card ที่เคยทำ

---

## Phase 3: Safe Talk (Voice Room)

**เป้าหมาย:** Voice room แบบ Clubhouse ใช้ LiveKit

### 3.1 Room Management

**Database:**

```
Room {
  id          String   @id @default(uuid())
  topic       String
  description String?
  creatorId   String   → User
  isActive    Boolean  @default(true)
  maxMembers  Int      @default(20)
  createdAt   DateTime
}

RoomMember {
  id       String   @id @default(uuid())
  roomId   String   → Room
  userId   String   → User
  role     String   @default("listener")  // speaker | listener
  joinedAt DateTime
  @@unique([roomId, userId])
}
```

**API Endpoints:**

- [ ] POST /rooms — สร้างห้อง (topic, description)
- [ ] GET /rooms — รายการห้องที่ active
- [ ] POST /rooms/:id/join — เข้าห้อง → รับ LiveKit token
- [ ] POST /rooms/:id/leave — ออกจากห้อง
- [ ] GET /rooms/:id — ข้อมูลห้อง + สมาชิก

### 3.2 Voice (LiveKit)

- [ ] LiveKit server setup
- [ ] Backend สร้าง LiveKit token เมื่อ user JOIN
- [ ] Frontend เชื่อม LiveKit SDK — เข้าห้อง, พูด, ฟัง
- [ ] แสดง avatar สมาชิกใน room
- [ ] Indicator ว่าใครกำลังพูด

### 3.3 In-Room Interaction

**Database:**

```
QuickReply {
  id       String   @id @default(uuid())
  roomId   String   → Room
  userId   String   → User
  message  String   ("ฉันฟังคุณอยู่นะ", "ทุกอย่างกำลังจะดีขึ้น", etc.)
  createdAt DateTime
}
```

- [ ] Quick reply สำเร็จรูป (Socket.io real-time)
- [ ] อีโมจิกอด ส่งให้คนในห้อง
- [ ] ปุ่ม Goodbye — ออกจากห้อง
- [ ] อัพเดตจำนวนผู้รับฟัง real-time

---

## Phase 4: HelpLine + Polish

### 4.1 HelpLine

- [ ] หน้า static แสดงเบอร์สายด่วน
  - สายด่วนสุขภาพจิต 1323 (24 ชม.)
  - สายด่วน Helpline 02-097-1900 (08.30-22.00)
- [ ] กดเบอร์โทรได้ (tel: link)
- [ ] ข้อความให้กำลังใจ

### 4.2 Polish

- [ ] UI ให้ตรง design (สี, font, spacing, avatar)
- [ ] Responsive (mobile-first)
- [ ] Loading states
- [ ] Error handling + user-friendly messages
- [ ] Empty states (ยังไม่มีโพสต์, ยังไม่มีห้อง)

---

## Design Reference

| File   | Content                                       |
| ------ | --------------------------------------------- |
| 9.png  | Splash screen + logo                          |
| 10.png | Community + Safe Talk + Room (design เก่า)    |
| 11.png | HelpLine + Today Card + Profile (design เก่า) |
| 12.png | Community function spec                       |
| 13.png | Safe Talk function spec                       |
| 14.png | HelpLine function spec                        |
| 15.png | Today Card function spec                      |
| 19.png | Community feed (detail)                       |
| 20.png | Today Card popup overlay                      |
| 21.png | Safe Talk room list                           |
| 22.png | Safe Talk inside room                         |
| 23.png | HelpLine page                                 |
| 24.png | Profile + Today Card collection               |

---

## TODO — รอถามทีม

- [ ] Chat: เปลี่ยนเป็นแบบ B (เริ่มใหม่ทุกครั้ง + ปุ่มดูประวัติแชท) — ตอนนี้เป็นแบบ A (เปิดแชทเก่าต่อ)
- [ ] วงล้อ: บังคับเล่นก่อนใช้แอป (ไปหน้าไหนไม่ได้ถ้ายังไม่ทำ) — ยังไม่ได้ทำ
- [ ] Today Card: เปิด 12:00-23:59 เหมือนวงล้อ + ปิดได้ + เปิดใหม่ได้

## Open Questions (รอถามทีม)

- [ ] Chat: จะเปลี่ยนเป็นแบบ B (เริ่มใหม่ + ดูประวัติ) มั้ย?
- [ ] Notification — push notification ทำตอน mobile phase
