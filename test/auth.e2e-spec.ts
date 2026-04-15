import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

const mockPrisma = {
  db: {
    user: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    assessmentQuestion: { findMany: jest.fn() },
    assessmentResult: { create: jest.fn(), findMany: jest.fn() },
  },
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
};

describe('Auth (e2e)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
      }),
    );
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /api/auth/register', () => {
    it('should register and return token', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);
      mockPrisma.db.user.create.mockResolvedValue({
        id: 'user-1',
        email: 'new@test.com',
        role: 'user',
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({
          email: 'new@test.com',
          password: 'password123',
          alias: 'ทดสอบ',
        })
        .expect(201);

      expect(res.body.accessToken).toBeTruthy();
      expect(res.body.userId).toBe('user-1');
    });

    it('should reject duplicate email', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue({ id: 'existing' });

      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'dup@test.com', password: 'password123', alias: 'dup' })
        .expect(409);
    });

    it('should reject invalid email format', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'not-an-email', password: 'password123', alias: 'test' })
        .expect(400);
    });

    it('should reject short password', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: '123', alias: 'test' })
        .expect(400);
    });

    it('should reject missing alias', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/register')
        .send({ email: 'test@test.com', password: 'password123' })
        .expect(400);
    });
  });

  describe('POST /api/auth/login', () => {
    it('should login with correct credentials', async () => {
      const hashed = await bcrypt.hash('password123', 12);
      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        password: hashed,
        role: 'user',
      });

      const res = await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'password123' })
        .expect(201);

      expect(res.body.accessToken).toBeTruthy();
    });

    it('should reject wrong password', async () => {
      const hashed = await bcrypt.hash('correct-password', 12);
      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'user@test.com',
        password: hashed,
        role: 'user',
      });

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'user@test.com', password: 'wrong-password' })
        .expect(401);
    });

    it('should reject non-existent user', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/login')
        .send({ email: 'nobody@test.com', password: 'password123' })
        .expect(401);
    });
  });

  describe('GET /api/auth/me', () => {
    it('should return 401 without token', async () => {
      await request(app.getHttpServer()).get('/api/auth/me').expect(401);
    });

    it('should return user with valid token', async () => {
      const jwtService = app.get(JwtService);
      const token = jwtService.sign({
        sub: 'user-1',
        email: 'test@test.com',
        role: 'user',
      });

      mockPrisma.db.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'test@test.com',
        role: 'user',
        alias: 'ทดสอบ',
        deletedAt: null,
      });

      const res = await request(app.getHttpServer())
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(res.body.email).toBe('test@test.com');
    });
  });

  describe('POST /api/auth/forgot-password', () => {
    it('should always return success (prevent email enumeration)', async () => {
      mockPrisma.db.user.findUnique.mockResolvedValue(null);

      const res = await request(app.getHttpServer())
        .post('/api/auth/forgot-password')
        .send({ email: 'nonexistent@test.com' })
        .expect(201);

      expect(res.body.message).toContain('หากอีเมลนี้มีอยู่ในระบบ');
    });
  });

  describe('POST /api/auth/reset-password', () => {
    it('should reject invalid token', async () => {
      mockPrisma.db.user.findFirst.mockResolvedValue(null);

      await request(app.getHttpServer())
        .post('/api/auth/reset-password')
        .send({ token: 'invalid', newPassword: 'newpass123' })
        .expect(400);
    });
  });
});
