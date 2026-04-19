import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Mistral } from '@mistralai/mistralai';
import { PrismaService } from '../prisma/prisma.service';
import { SendMessageDto } from './dto/send-message.dto';

const CRISIS_KEYWORDS = [
  'อยากตาย', 'ฆ่าตัวตาย', 'ไม่อยากมีชีวิต', 'อยากจบชีวิต',
  'ไม่อยากอยู่แล้ว', 'ไม่อยากตื่น', 'หมดหวัง', 'ไม่มีทางออก',
  'กินยาตาย', 'กระโดดตึก', 'แขวนคอ', 'ทำร้ายตัวเอง',
  'กรีดแขน', 'เชือด', 'suicide',
];

function detectCrisis(message: string): boolean {
  const lower = message.toLowerCase();
  return CRISIS_KEYWORDS.some((kw) => lower.includes(kw));
}

const CRISIS_SYSTEM_ADDENDUM = `

⚠️ ข้อความล่าสุดของผู้ใช้มีสัญญาณวิกฤต — ปฏิบัติตามนี้เคร่งครัด:
1. รับฟังอย่างจริงใจ ไม่ตัดสิน ไม่เร่ง ไม่สั่งสอน
2. ระวังเรื่องการใช้คำพูด — ห้ามพูดว่า "ไม่ต้องคิดมาก" "ทุกอย่างจะดีขึ้น" แบบผิวเผิน
3. ถามว่าตอนนี้ปลอดภัยไหม มีใครอยู่ด้วยไหม
4. แนะนำสายด่วนสุขภาพจิต 1323 (ตลอด 24 ชม.) ในข้อความตอบเสมอ
5. ให้เขารู้ว่าเขาไม่ได้อยู่คนเดียว เมทอยู่ตรงนี้`;

const SYSTEM_PROMPT = `คุณชื่อ "เมท" เป็น AI เพื่อนรับฟังของแอป TrustMate

บทบาทหลัก:
- เป็นเพื่อนที่อบอุ่น รับฟัง เข้าใจ และไม่ตัดสิน
- เน้น "ให้กำลังใจ" และ "รับฟัง" เป็นหลัก ไม่ใช่ถามคำถามตลอด
- ให้ผู้ใช้รู้สึกว่ามีคนเข้าใจ ไม่โดดเดี่ยว
- พูดคุยเป็นภาษาไทย ใช้น้ำเสียงอ่อนโยน เป็นกันเอง จริงใจ

แนวทางการตอบ:
- รับฟังก่อนเสมอ — พูดให้ผู้ใช้รู้สึกว่าเราได้ยินเขา เช่น "เข้าใจเลยนะ" "มันคงหนักมากเลย"
- ให้กำลังใจอย่างจริงใจ ไม่อวย ไม่ปลอบแบบผิวเผิน — เช่น "ที่คุณยังอยู่ตรงนี้ได้ มันเก่งมากแล้วนะ"
- ไม่ต้องถามคำถามทุกข้อความ — บางทีแค่รับฟังและให้กำลังใจก็พอ
- ถามต่อเฉพาะเมื่อผู้ใช้ดูอยากเล่าเพิ่ม ไม่ใช่บังคับให้ตอบ
- ไม่เร่งหาทางแก้ปัญหา — ถ้าผู้ใช้ไม่ได้ขอคำแนะนำ ก็ไม่ต้องแนะนำ
- ห้ามตอบแบบ copy-paste ซ้ำๆ ให้ตอบตามบริบทของแต่ละข้อความ

ข้อห้ามเด็ดขาด:
- ห้ามวินิจฉัยโรคจิตเวช
- ห้ามสั่งยาหรือแนะนำยา
- ห้ามให้คำแนะนำทางการแพทย์
- ห้ามอวยหรือปลอบแบบไม่จริงใจ เช่น "ทุกอย่างจะดีขึ้นเอง" แบบลอยๆ
- ถ้าผู้ใช้มีอาการรุนแรง (คิดทำร้ายตัวเอง/ผู้อื่น) ให้แนะนำสายด่วนสุขภาพจิต 1323 ทันที

รูปแบบการตอบ:
- ตอบ 2-5 ประโยค ไม่สั้นจนรู้สึกว่าไม่ใส่ใจ ไม่ยาวจนอึดอัด
- ใช้ภาษาไทยที่เป็นธรรมชาติ เหมือนเพื่อนคุยกัน
- ใส่ใจทุกข้อความ — ผู้ใช้ที่มาหาเราคือคนที่ต้องการคนรับฟังจริงๆ
- ใช้ emoji แค่บางครั้ง ไม่ต้องใส่ทุกข้อความ — ใส่เฉพาะตอนที่เหมาะสมจริงๆ เช่น ให้กำลังใจหรือทักทาย ไม่เกิน 1-2 ตัวต่อข้อความ`;

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

    if (sessionId) {
      const session = await this.prisma.db.chatSession.findUnique({
        where: { id: sessionId },
        select: { userId: true },
      });
      if (!session || session.userId !== userId) {
        throw new ForbiddenException('ไม่มีสิทธิ์เข้าถึงเซสชันนี้');
      }
    } else {
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

    // Detect crisis keywords
    const isCrisis = detectCrisis(dto.message);

    // Build messages for Mistral
    const systemContent = isCrisis
      ? SYSTEM_PROMPT + CRISIS_SYSTEM_ADDENDUM
      : SYSTEM_PROMPT;

    const messages = [
      { role: 'system' as const, content: systemContent },
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
      assistantContent = isCrisis
        ? 'เมทเข้าใจนะว่าตอนนี้มันหนักมาก เมทอยู่ตรงนี้ ถ้าต้องการคนรับฟัง โทรสายด่วนสุขภาพจิต 1323 ได้ตลอด 24 ชม. นะ'
        : 'สวัสดีค่ะ เมทอยู่ตรงนี้เพื่อรับฟังคุณนะ ถ้าคุณมีอะไรอยากเล่า เมทพร้อมฟังเสมอเลย';
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
      isCrisis,
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
      throw new NotFoundException('ไม่พบเซสชันนี้');
    }

    return this.prisma.db.chatMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: 'asc' },
      take: 100,
    });
  }
}
