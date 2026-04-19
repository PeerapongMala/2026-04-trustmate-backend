import { Controller, ForbiddenException, Get, Post } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  check() {
    return { status: 'ok' };
  }

  @Post('seed')
  async seed() {
    // Dev-only endpoint. Creates an admin account with a well-known
    // password; must never be reachable in production.
    if (process.env.NODE_ENV === 'production') {
      throw new ForbiddenException('Seed endpoint disabled in production');
    }

    const results: string[] = [];

    // Admin user
    const adminPassword = await bcrypt.hash('admin1234', 10);
    await this.prisma.db.user.upsert({
      where: { email: 'admin@trustmate.app' },
      update: { role: 'admin' },
      create: {
        email: 'admin@trustmate.app',
        password: adminPassword,
        alias: 'Admin',
        role: 'admin',
      },
    });
    results.push('Admin: admin@trustmate.app / admin1234');

    // Therapists
    const therapistsData = [
      {
        name: 'พญ. ใจดี สุขสบาย',
        title: 'จิตแพทย์ทั่วไป',
        specialties: [
          'ปัญหาครอบครัว',
          'การเลี้ยงลูก',
          'ปัญหาวัยรุ่น',
          'ปัญหาความสัมพันธ์',
        ],
        location: 'กรุงเทพฯ',
        clinic: 'รพ. จิตเวชนครพิงค์',
        pricePerSlot: 1500,
        avgRating: 4.8,
        reviewCount: 24,
      },
      {
        name: 'นพ. สมชาย รักษาใจ',
        title: 'จิตแพทย์เด็กและวัยรุ่น',
        specialties: ['ซึมเศร้า', 'วิตกกังวล', 'ADHD', 'ปัญหาการเรียน'],
        location: 'กรุงเทพฯ',
        clinic: 'รพ. ศิริราช',
        pricePerSlot: 2000,
        avgRating: 4.9,
        reviewCount: 56,
      },
      {
        name: 'ผศ.ดร. ปรียา จิตวิทยา',
        title: 'นักจิตวิทยาคลินิก',
        specialties: ['ความเครียด', 'Burnout', 'ปัญหาการทำงาน', 'CBT'],
        location: 'เชียงใหม่',
        clinic: 'คลินิกใจสบาย',
        pricePerSlot: 1200,
        avgRating: 4.7,
        reviewCount: 18,
      },
    ];

    for (const t of therapistsData) {
      const existing = await this.prisma.db.therapist.findFirst({
        where: { name: t.name },
      });
      const therapist =
        existing || (await this.prisma.db.therapist.create({ data: t }));
      results.push(`Therapist: ${therapist.name} (${therapist.id})`);

      // Time slots for next 14 days
      const now = new Date();
      const timeSlotTemplates = [
        { startTime: '17:00', endTime: '17:30' },
        { startTime: '17:30', endTime: '18:00' },
        { startTime: '18:00', endTime: '18:30' },
        { startTime: '18:30', endTime: '19:00' },
        { startTime: '19:00', endTime: '19:30' },
        { startTime: '19:30', endTime: '20:00' },
      ];

      let slotCount = 0;
      for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
        const date = new Date(now);
        date.setDate(date.getDate() + dayOffset);
        date.setHours(0, 0, 0, 0);
        if (date.getDay() === 0) continue;

        for (const ts of timeSlotTemplates) {
          try {
            await this.prisma.db.timeSlot.create({
              data: {
                therapistId: therapist.id,
                date,
                startTime: ts.startTime,
                endTime: ts.endTime,
              },
            });
            slotCount++;
          } catch {
            // duplicate slot, skip
          }
        }
      }
      results.push(`  ${slotCount} new time slots`);
    }

    return { seeded: results };
  }
}
