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

  async deleteAccount(userId: string) {
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { deletedAt: new Date() },
    });
    return { message: 'ลบบัญชีเรียบร้อยแล้ว' };
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    // Only allow-list mutable fields to prevent accidental write of DTO
    // additions (e.g., password, role, deletedAt).
    const data: Partial<Pick<UpdateProfileDto, 'alias' | 'bio' | 'avatarColor'>> =
      {};
    if (dto.alias !== undefined) data.alias = dto.alias;
    if (dto.bio !== undefined) data.bio = dto.bio;
    if (dto.avatarColor !== undefined) data.avatarColor = dto.avatarColor;

    const user = await this.prisma.db.user.update({
      where: { id: userId },
      data,
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
