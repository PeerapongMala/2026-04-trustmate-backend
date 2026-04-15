import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        alias: true,
        bio: true,
        avatarColor: true,
        provider: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('ไม่พบผู้ใช้');
    }

    return user;
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    const user = await this.prisma.db.user.update({
      where: { id: userId },
      data: dto,
      select: {
        id: true,
        email: true,
        alias: true,
        bio: true,
        avatarColor: true,
        provider: true,
        role: true,
        createdAt: true,
      },
    });

    return user;
  }
}
