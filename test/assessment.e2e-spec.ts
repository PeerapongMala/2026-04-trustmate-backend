import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/modules/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';

// Mock PrismaService to avoid real DB connection
const mockPrisma = {
  db: {
    assessmentQuestion: {
      findMany: jest.fn(),
    },
    assessmentResult: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
    },
  },
  onModuleInit: jest.fn(),
  onModuleDestroy: jest.fn(),
};

describe('Assessment (e2e)', () => {
  let app: INestApplication;
  let jwtToken: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(mockPrisma)
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    app.setGlobalPrefix('api');
    await app.init();

    // Generate a test JWT
    const jwtService = moduleFixture.get<JwtService>(JwtService);
    jwtToken = jwtService.sign({
      sub: 'test-user-1',
      email: 'test@test.com',
      role: 'user',
    });

    // Mock user validation for JWT strategy
    mockPrisma.db.user.findUnique.mockResolvedValue({
      id: 'test-user-1',
      email: 'test@test.com',
      role: 'user',
      alias: 'test',
      deletedAt: null,
    });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /api/assessment/questions', () => {
    it('should return stress questions', async () => {
      const mockQuestions = [
        { id: 'stress-1', text: 'คำถาม 1', order: 1 },
        { id: 'stress-2', text: 'คำถาม 2', order: 2 },
      ];
      mockPrisma.db.assessmentQuestion.findMany.mockResolvedValue(
        mockQuestions,
      );

      const res = await request(app.getHttpServer())
        .get('/api/assessment/questions?type=stress')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body).toHaveLength(2);
      expect(res.body[0].id).toBe('stress-1');
    });

    it('should return depression questions', async () => {
      const mockQuestions = [{ id: 'phq9-1', text: 'คำถาม PHQ 1', order: 101 }];
      mockPrisma.db.assessmentQuestion.findMany.mockResolvedValue(
        mockQuestions,
      );

      const res = await request(app.getHttpServer())
        .get('/api/assessment/questions?type=depression')
        .set('Authorization', `Bearer ${jwtToken}`)
        .expect(200);

      expect(res.body[0].id).toBe('phq9-1');
    });

    it('should return 401 without token', async () => {
      await request(app.getHttpServer())
        .get('/api/assessment/questions')
        .expect(401);
    });
  });

  describe('POST /api/assessment/submit', () => {
    it('should return correct stress score and level', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-1',
        totalScore: 20,
        level: 'ปานกลาง',
        createdAt: new Date(),
      });

      const answers = [
        { questionId: 'stress-1', score: 3 },
        { questionId: 'stress-2', score: 2 },
        { questionId: 'stress-3', score: 2 },
        { questionId: 'stress-4', score: 2 }, // reverse: 4-2=2
        { questionId: 'stress-5', score: 2 }, // reverse: 4-2=2
        { questionId: 'stress-6', score: 3 },
        { questionId: 'stress-7', score: 2 }, // reverse: 4-2=2
        { questionId: 'stress-8', score: 2 }, // reverse: 4-2=2
        { questionId: 'stress-9', score: 2 },
        { questionId: 'stress-10', score: 2 },
      ];
      // Normal: 3+2+2+3+2+2 = 14, Reverse: 2+2+2+2 = 8 → total 22

      const res = await request(app.getHttpServer())
        .post('/api/assessment/submit?type=stress')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ answers })
        .expect(201);

      expect(res.body.type).toBe('stress');
      expect(res.body.maxScore).toBe(40);
      expect(res.body.level).toBeTruthy();
      expect(res.body.recommendation).toBeTruthy();
    });

    it('should return correct depression score', async () => {
      mockPrisma.db.assessmentResult.create.mockResolvedValue({
        id: 'result-2',
        totalScore: 15,
        level: 'รุนแรงปานกลาง',
        createdAt: new Date(),
      });

      const answers = Array.from({ length: 9 }, (_, i) => ({
        questionId: `phq9-${i + 1}`,
        score: 2,
      }));

      const res = await request(app.getHttpServer())
        .post('/api/assessment/submit?type=depression')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ answers })
        .expect(201);

      expect(res.body.type).toBe('depression');
      expect(res.body.maxScore).toBe(27);
    });

    it('should reject invalid answers (score out of range)', async () => {
      const answers = [{ questionId: 'stress-1', score: 10 }];

      await request(app.getHttpServer())
        .post('/api/assessment/submit?type=stress')
        .set('Authorization', `Bearer ${jwtToken}`)
        .send({ answers })
        .expect(400);
    });
  });
});
