import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnswerCardDto } from './dto/answer-card.dto';

@Injectable()
export class TodayCardService {
  constructor(private readonly prisma: PrismaService) {}

  async getTodayCard(userId: string) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const question = await this.prisma.db.todayQuestion.findUnique({
      where: { date: today },
    });

    if (!question) {
      return { question: null, answer: null };
    }

    const existing = await this.prisma.db.todayCard.findUnique({
      where: {
        questionId_userId: {
          questionId: question.id,
          userId,
        },
      },
    });

    return {
      question: {
        id: question.id,
        question: question.question,
        date: question.date,
      },
      answer: existing
        ? {
            id: existing.id,
            answer: existing.answer,
            createdAt: existing.createdAt,
          }
        : null,
    };
  }

  async answerCard(userId: string, dto: AnswerCardDto) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const question = await this.prisma.db.todayQuestion.findUnique({
      where: { date: today },
    });

    if (!question) {
      throw new NotFoundException('ไม่มีคำถามวันนี้');
    }

    const existing = await this.prisma.db.todayCard.findUnique({
      where: {
        questionId_userId: {
          questionId: question.id,
          userId,
        },
      },
    });

    if (existing) {
      throw new ConflictException('ตอบคำถามวันนี้แล้ว');
    }

    return this.prisma.db.todayCard.create({
      data: {
        answer: dto.answer,
        questionId: question.id,
        userId,
      },
    });
  }

  async getHistory(userId: string) {
    return this.prisma.db.todayCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        question: {
          select: { question: true, date: true },
        },
      },
    });
  }
}
