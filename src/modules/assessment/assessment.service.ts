import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';
import {
  calculateStressScore,
  calculateDepressionScore,
  getStressLevel,
  getDepressionLevel,
} from './assessment.scoring';

@Injectable()
export class AssessmentService {
  constructor(private readonly prisma: PrismaService) {}

  async getQuestions(type: string) {
    const prefix = type === 'depression' ? 'phq9-' : 'stress-';
    const questions = await this.prisma.db.assessmentQuestion.findMany({
      where: { id: { startsWith: prefix } },
      orderBy: { order: 'asc' },
    });
    return questions;
  }

  async submit(userId: string, type: string, dto: SubmitAssessmentDto) {
    const totalScore =
      type === 'stress'
        ? calculateStressScore(dto.answers)
        : calculateDepressionScore(dto.answers);

    const { level, recommendation } =
      type === 'depression'
        ? getDepressionLevel(totalScore)
        : getStressLevel(totalScore);

    const maxScore = type === 'depression' ? 27 : 40;

    const result = await this.prisma.db.assessmentResult.create({
      data: {
        userId,
        answers: dto.answers.map((a) => ({
          questionId: a.questionId,
          score: a.score,
        })),
        totalScore,
        level,
      },
    });

    return {
      id: result.id,
      type,
      totalScore,
      maxScore,
      level,
      recommendation,
      createdAt: result.createdAt,
    };
  }

  async getHistory(userId: string) {
    return this.prisma.db.assessmentResult.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
  }
}
