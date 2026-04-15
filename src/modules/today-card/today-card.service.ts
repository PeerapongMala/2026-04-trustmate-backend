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

    // Try exact date first
    let question = await this.prisma.db.todayQuestion.findUnique({
      where: { date: today },
    });

    // If no question for today, pick one by cycling through all questions
    if (!question) {
      const allQuestions = await this.prisma.db.todayQuestion.findMany({
        orderBy: { date: 'asc' },
      });

      if (allQuestions.length === 0) {
        return { question: null, answer: null };
      }

      // Use day-of-year to cycle through questions
      const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const index = dayOfYear % allQuestions.length;
      question = allQuestions[index];
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

    // Same cycling logic
    let question = await this.prisma.db.todayQuestion.findUnique({
      where: { date: today },
    });

    if (!question) {
      const allQuestions = await this.prisma.db.todayQuestion.findMany({
        orderBy: { date: 'asc' },
      });

      if (allQuestions.length === 0) {
        throw new NotFoundException('ไม่มีคำถาม');
      }

      const dayOfYear = Math.floor(
        (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
          (1000 * 60 * 60 * 24),
      );
      const index = dayOfYear % allQuestions.length;
      question = allQuestions[index];
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
