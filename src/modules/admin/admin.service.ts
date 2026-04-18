import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { PrismaService } from '../prisma/prisma.service';

const MODERATION_PROMPT = `คุณเป็นระบบตรวจสอบเนื้อหาของแอปสุขภาพจิต TrustMate
ตรวจสอบข้อความต่อไปนี้ว่าเข้าข่ายผิดกฎหรือไม่

กฎที่ต้องตรวจ:
1. สแปม/โฆษณา — ขายของ, link, โปรโมท
2. เนื้อหาไม่เหมาะสม — 18+, ยาเสพติด
3. ชักชวนทำร้ายตัวเอง/ผู้อื่น — (ไม่ใช่การระบาย แต่เป็นการชักชวน)
4. ด่า/ข่มขู่/คุกคาม
5. แสดงเจตนาทำร้ายคนอื่น — เช่น จะไปตบ จะไปฆ่า จะไปทำร้ายใครบางคน (ไม่ใช่แค่ระบายว่าโกรธ แต่มีเจตนาชัดเจน)

สำคัญ: การระบายความรู้สึก เช่น "ไม่อยากมีชีวิตอยู่" "เหนื่อยมาก" "อยากตาย" ไม่ถือว่าผิดกฎ เพราะเป็นเหตุผลที่ผู้ใช้มาใช้แอป — ให้ flag เป็น "self_harm" เพื่อส่งต่อระบบดูแล

ตอบเป็น JSON เท่านั้น:
{"status": "clean" | "flagged" | "blocked", "category": "none" | "self_harm" | "harm_others" | "profanity" | "spam" | "inappropriate", "reason": "เหตุผลสั้นๆ ถ้าไม่ clean"}`;

@Injectable()
export class AdminService {
  private mistral: Mistral | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    const apiKey = this.config.get<string>('MISTRAL_API_KEY');
    if (apiKey) {
      this.mistral = new Mistral({ apiKey });
    }
  }

  // ========== AI Moderation ==========

  async moderateContent(content: string): Promise<{
    status: 'clean' | 'flagged' | 'blocked';
    category?: string;
    reason?: string;
  }> {
    if (!this.mistral) {
      return { status: 'clean', category: 'none' };
    }

    try {
      const response = await this.mistral.chat.complete({
        model: 'mistral-small-latest',
        messages: [
          { role: 'system', content: MODERATION_PROMPT },
          { role: 'user', content },
        ],
        responseFormat: { type: 'json_object' },
      });

      const text = response.choices?.[0]?.message?.content?.toString() || '';
      const result = JSON.parse(text);
      return {
        status: result.status || 'clean',
        category: result.category || 'none',
        reason: result.reason,
      };
    } catch {
      // Fail-safe: flag as pending instead of blocking
      return {
        status: 'flagged',
        category: 'none',
        reason: 'AI moderation error — manual review needed',
      };
    }
  }

  // ========== Posts ==========

  async getPosts(status?: string, page = 1, limit = 20) {
    const where = status ? { flagStatus: status } : {};

    const [posts, total] = await Promise.all([
      this.prisma.db.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          author: { select: { alias: true, email: true } },
        },
      }),
      this.prisma.db.post.count({ where }),
    ]);

    return { data: posts, meta: { total, page, limit } };
  }

  async deletePost(postId: string) {
    await this.prisma.db.post.delete({ where: { id: postId } });
    return { message: 'ลบโพสต์สำเร็จ' };
  }

  // ========== Reports ==========

  async getReports(status = 'pending', page = 1, limit = 20) {
    const [reports, total] = await Promise.all([
      this.prisma.db.report.findMany({
        where: { status },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          reporter: { select: { alias: true } },
          post: { select: { content: true, tag: true } },
        },
      }),
      this.prisma.db.report.count({ where: { status } }),
    ]);

    return { data: reports, meta: { total, page, limit } };
  }

  async reviewReport(reportId: string, action: 'reviewed' | 'dismissed') {
    await this.prisma.db.report.update({
      where: { id: reportId },
      data: { status: action },
    });
    return { message: `Report ${action}` };
  }

  // ========== Users ==========

  async banUser(userId: string) {
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
    return { message: 'Ban user สำเร็จ' };
  }

  async unbanUser(userId: string) {
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { deletedAt: null },
    });
    return { message: 'Unban user สำเร็จ' };
  }

  // ========== Therapists ==========

  async createTherapist(data: {
    name: string;
    title: string;
    specialties: string[];
    location: string;
    clinic: string;
    pricePerSlot: number;
  }) {
    return this.prisma.db.therapist.create({ data });
  }

  async updateTherapist(
    id: string,
    data: Partial<{
      name: string;
      title: string;
      specialties: string[];
      location: string;
      clinic: string;
      pricePerSlot: number;
      isActive: boolean;
    }>,
  ) {
    return this.prisma.db.therapist.update({ where: { id }, data });
  }

  async deleteTherapist(id: string) {
    await this.prisma.db.therapist.update({
      where: { id },
      data: { isActive: false },
    });
    return { message: 'ลบผู้ให้คำปรึกษาสำเร็จ' };
  }

  // ========== Time Slots ==========

  async createTimeSlots(
    therapistId: string,
    slots: { date: string; startTime: string; endTime: string }[],
  ) {
    const data = slots.map((s) => ({
      therapistId,
      date: new Date(s.date),
      startTime: s.startTime,
      endTime: s.endTime,
    }));

    return this.prisma.db.timeSlot.createMany({ data, skipDuplicates: true });
  }

  // ========== Questions ==========

  async createAssessmentQuestion(text: string, order: number) {
    return this.prisma.db.assessmentQuestion.create({
      data: { text, order },
    });
  }

  async createTodayQuestion(question: string, date: string) {
    return this.prisma.db.todayQuestion.create({
      data: { question, date: new Date(date) },
    });
  }

  // ========== Dashboard Stats ==========

  async getDashboardStats() {
    const [userCount, postCount, flaggedCount, pendingReports, bookingCount] =
      await Promise.all([
        this.prisma.db.user.count({ where: { deletedAt: null } }),
        this.prisma.db.post.count(),
        this.prisma.db.post.count({ where: { flagStatus: 'flagged' } }),
        this.prisma.db.report.count({ where: { status: 'pending' } }),
        this.prisma.db.booking.count({ where: { status: 'confirmed' } }),
      ]);

    return {
      userCount,
      postCount,
      flaggedCount,
      pendingReports,
      bookingCount,
    };
  }
}
