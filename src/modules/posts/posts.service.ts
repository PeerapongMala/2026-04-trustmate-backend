import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AdminService } from '../admin/admin.service';
import { CreatePostDto } from './dto/create-post.dto';

@Injectable()
export class PostsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly adminService: AdminService,
  ) {}

  async create(userId: string, dto: CreatePostDto) {
    // AI Moderation check
    const modResult = await this.adminService.moderateContent(dto.content);

    if (modResult.status === 'blocked') {
      throw new ForbiddenException(
        'เนื้อหาไม่ผ่านการตรวจสอบ: ' + (modResult.reason || 'ไม่เหมาะสม'),
      );
    }

    // harm_others → force to private (ไม่ให้คนอื่นกดกอดเป็นการสนับสนุน)
    let visibility = dto.visibility || 'public';
    if (modResult.category === 'harm_others') {
      visibility = 'private';
    }

    const post = await this.prisma.db.post.create({
      data: {
        content: dto.content,
        tag: dto.tag,
        visibility,
        authorId: userId,
        flagStatus: modResult.status, // clean or flagged
      },
      select: this.postSelect(userId),
    });

    return post;
  }

  async findByUser(userId: string, limit = 50) {
    const posts = await this.prisma.db.post.findMany({
      where: { authorId: userId },
      orderBy: { createdAt: 'desc' },
      take: Math.min(limit, 100),
      select: {
        id: true,
        content: true,
        tag: true,
        visibility: true,
        hugCount: true,
        createdAt: true,
        author: {
          select: { alias: true, avatarColor: true },
        },
        hugs: {
          where: { userId },
          select: { id: true },
        },
      },
    });

    return posts.map((post) => ({
      ...post,
      isHugged: post.hugs.length > 0,
      hugs: undefined,
    }));
  }

  async findAll(userId: string, tag?: string, page = 1, limit = 20) {
    const where = {
      flagStatus: 'clean' as const,
      visibility: { not: 'private' },
      ...(tag ? { tag } : {}),
    };

    const [posts, total] = await Promise.all([
      this.prisma.db.post.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        select: {
          id: true,
          content: true,
          tag: true,
          visibility: true,
          hugCount: true,
          createdAt: true,
          author: {
            select: { alias: true, avatarColor: true },
          },
          hugs: {
            where: { userId },
            select: { id: true },
          },
        },
      }),
      this.prisma.db.post.count({ where }),
    ]);

    return {
      data: posts.map((post) => ({
        ...post,
        isHugged: post.hugs.length > 0,
        hugs: undefined,
      })),
      meta: { total, page, limit },
    };
  }

  async hug(userId: string, postId: string) {
    const post = await this.prisma.db.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('ไม่พบโพสต์');
    }

    const existing = await this.prisma.db.hug.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (existing) {
      return { message: 'กอดแล้ว' };
    }

    await this.prisma.db.$transaction([
      this.prisma.db.hug.create({ data: { postId, userId } }),
      this.prisma.db.post.update({
        where: { id: postId },
        data: { hugCount: { increment: 1 } },
      }),
    ]);

    return { message: 'กอดสำเร็จ' };
  }

  async unhug(userId: string, postId: string) {
    const existing = await this.prisma.db.hug.findUnique({
      where: { postId_userId: { postId, userId } },
    });

    if (!existing) {
      return { message: 'ยังไม่ได้กอด' };
    }

    await this.prisma.db.$transaction([
      this.prisma.db.hug.delete({ where: { id: existing.id } }),
      this.prisma.db.post.update({
        where: { id: postId },
        data: { hugCount: { decrement: 1 } },
      }),
    ]);

    return { message: 'ยกเลิกกอดสำเร็จ' };
  }

  async report(userId: string, postId: string, reason: string) {
    const post = await this.prisma.db.post.findUnique({
      where: { id: postId },
    });

    if (!post) {
      throw new NotFoundException('ไม่พบโพสต์');
    }

    await this.prisma.db.report.create({
      data: {
        targetType: 'post',
        targetId: postId,
        postId,
        reporterId: userId,
        reason,
      },
    });

    return { message: 'แจ้งรายงานสำเร็จ' };
  }

  private postSelect(userId: string) {
    return {
      id: true,
      content: true,
      tag: true,
      visibility: true,
      hugCount: true,
      createdAt: true,
      author: {
        select: { alias: true, avatarColor: true },
      },
    } as const;
  }
}
