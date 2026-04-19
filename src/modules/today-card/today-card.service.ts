import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AnswerCardDto } from './dto/answer-card.dto';

type TodayQuestionRow = {
  id: string;
  question: string;
  date: Date;
};

@Injectable()
export class TodayCardService {
  constructor(private readonly prisma: PrismaService) {}

  // Resolves the question-of-the-day by exact date, falling back to day-of-year
  // cycling through all questions. Returns null only when no questions exist.
  private async resolveTodayQuestion(): Promise<TodayQuestionRow | null> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const exact = await this.prisma.db.todayQuestion.findUnique({
      where: { date: today },
    });
    if (exact) return exact as TodayQuestionRow;

    const allQuestions = await this.prisma.db.todayQuestion.findMany({
      orderBy: { date: 'asc' },
    });
    if (allQuestions.length === 0) return null;

    const dayOfYear = Math.floor(
      (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) /
        (1000 * 60 * 60 * 24),
    );
    return allQuestions[dayOfYear % allQuestions.length] as TodayQuestionRow;
  }

  async getTodayCard(userId: string) {
    const question = await this.resolveTodayQuestion();
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
    const question = await this.resolveTodayQuestion();
    if (!question) {
      throw new NotFoundException('ไม่มีคำถาม');
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

  async getHistory(userId: string, limit = 90) {
    return this.prisma.db.todayCard.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
      include: {
        question: {
          select: { question: true, date: true },
        },
      },
    });
  }
}
