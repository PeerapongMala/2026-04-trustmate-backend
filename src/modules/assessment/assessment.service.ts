import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SubmitAssessmentDto } from './dto/submit-assessment.dto';

// PSS-10: ข้อ 4,5,7,8 คิดคะแนนกลับ (0-4 ต่อข้อ, max 40)
const STRESS_REVERSE_ITEMS = ['stress-4', 'stress-5', 'stress-7', 'stress-8'];

// PHQ-9: 0-3 ต่อข้อ, max 27
function getStressLevel(score: number): { level: string; recommendation: string } {
  if (score <= 13) {
    return { level: 'ต่ำ', recommendation: 'คุณมีความเครียดในระดับต่ำ ดูแลสุขภาพจิตต่อไปนะ' };
  } else if (score <= 26) {
    return { level: 'ปานกลาง', recommendation: 'คุณมีความเครียดปานกลาง ลองหาเวลาพักผ่อนและทำกิจกรรมที่ชอบ' };
  } else {
    return { level: 'สูง', recommendation: 'คุณมีความเครียดสูง ควรพูดคุยกับคนใกล้ชิดหรือผู้เชี่ยวชาญ' };
  }
}

function getDepressionLevel(score: number): { level: string; recommendation: string } {
  if (score <= 4) {
    return { level: 'ไม่มีหรือน้อยมาก', recommendation: 'ไม่มีภาวะซึมเศร้าหรือมีน้อยมาก' };
  } else if (score <= 9) {
    return { level: 'เล็กน้อย', recommendation: 'มีภาวะซึมเศร้าระดับเล็กน้อย ควรเริ่มสังเกตตนเองอย่างใกล้ชิด' };
  } else if (score <= 14) {
    return { level: 'ปานกลาง', recommendation: 'มีภาวะซึมเศร้าระดับปานกลาง อาจจำเป็นต้องขอคำปรึกษาจากนักจิตวิทยาหรือนักจิตบำบัด' };
  } else if (score <= 19) {
    return { level: 'รุนแรงปานกลาง', recommendation: 'มีภาวะซึมเศร้าระดับรุนแรงปานกลาง ควรได้รับการดูแลจากนักจิตวิทยาหรือนักจิตบำบัด' };
  } else {
    return { level: 'รุนแรงสูง', recommendation: 'มีภาวะซึมเศร้าระดับรุนแรงสูง จำเป็นต้องได้รับการตรวจซึมเศร้าและรักษาอย่างเร่งด่วน' };
  }
}

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
    let totalScore: number;

    if (type === 'stress') {
      // PSS-10: reverse scoring for items 4,5,7,8
      totalScore = dto.answers.reduce((sum, a) => {
        const isReverse = STRESS_REVERSE_ITEMS.includes(a.questionId);
        const score = isReverse ? (4 - a.score) : a.score;
        return sum + score;
      }, 0);
    } else {
      // PHQ-9: direct scoring 0-3
      totalScore = dto.answers.reduce((sum, a) => sum + a.score, 0);
    }

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
