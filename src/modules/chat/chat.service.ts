import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

const SYSTEM_PROMPT = `คุณชื่อ "เมท" เป็น AI เพื่อนรับฟังของแอป TrustMate

บทบาทของคุณ:
- เป็นเพื่อนที่อบอุ่น รับฟัง เข้าใจ และไม่ตัดสิน
- พูดคุยเป็นภาษาไทย ใช้น้ำเสียงอ่อนโยน เป็นกันเอง
- ถามไถ่ความรู้สึกของผู้ใช้อย่างนุ่มนวล
- ให้กำลังใจและแสดงความเข้าใจ

ข้อห้ามเด็ดขาด:
- ห้ามวินิจฉัยโรคจิตเวช
- ห้ามสั่งยาหรือแนะนำยา
- ห้ามให้คำแนะนำทางการแพทย์
- ถ้าผู้ใช้มีอาการรุนแรง (คิดทำร้ายตัวเอง/ผู้อื่น) ให้แนะนำสายด่วนสุขภาพจิต 1323 ทันที

รูปแบบการตอบ:
- ตอบสั้นกระชับ 2-4 ประโยค
- ใช้ภาษาไทยที่เป็นธรรมชาติ
- แสดงความเข้าใจก่อนแล้วค่อยถามต่อ`;

@Injectable()
export class ChatService {
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

  async sendMessage(userId: string, dto: SendMessageDto) {
    let sessionId = dto.sessionId;

    if (!sessionId) {
      const session = await this.prisma.db.chatSession.create({
        data: { userId },
      });
      sessionId = session.id;
    }

    // Save user message
    await this.prisma.db.chatMessage.create({
      data: {
        sessionId,
        role: 'user',
        content: dto.message,
      },
    });

    // Get conversation history for context
    const history = await this.prisma.db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 20,
    });

    // Build messages for Mistral
    const messages = [
      { role: 'system' as const, content: SYSTEM_PROMPT },
      ...history.map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
    ];

    let assistantContent: string;

    if (this.mistral) {
      const response = await this.mistral.chat.complete({
        model: 'mistral-small-latest',
        messages,
      });

      assistantContent =
        response.choices?.[0]?.message?.content?.toString() ||
        'ขอโทษนะ เมทตอบไม่ได้ตอนนี้ ลองใหม่อีกทีนะ';
    } else {
      // Fallback when no API key
      assistantContent =
        'สวัสดีค่ะ เมทอยู่ตรงนี้เพื่อรับฟังคุณนะ ถ้าคุณมีอะไรอยากเล่า เมทพร้อมฟังเสมอเลย 💛';
    }

    // Save assistant message
    const saved = await this.prisma.db.chatMessage.create({
      data: {
        sessionId,
        role: 'assistant',
        content: assistantContent,
      },
    });

    return {
      sessionId,
      message: {
        id: saved.id,
        role: saved.role,
        content: saved.content,
        createdAt: saved.createdAt,
      },
    };
  }

  async getSessions(userId: string) {
    return this.prisma.db.chatSession.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });
  }

  async getMessages(userId: string, sessionId: string) {
    const session = await this.prisma.db.chatSession.findFirst({
      where: { id: sessionId, userId },
    });

    if (!session) {
      return [];
    }

    return this.prisma.db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
    });
  }
}
