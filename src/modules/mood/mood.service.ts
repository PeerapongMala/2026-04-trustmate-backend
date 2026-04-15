import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMoodDto } from './dto/create-mood.dto';

@Injectable()
export class MoodService {
  constructor(private readonly prisma: PrismaService) {}

  async create(userId: string, dto: CreateMoodDto) {
    return this.prisma.db.moodEntry.create({
      data: {
        mood: dto.mood,
        note: dto.note,
        userId,
      },
    });
  }

  async getHistory(userId: string, limit = 30) {
    return this.prisma.db.moodEntry.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }
}
