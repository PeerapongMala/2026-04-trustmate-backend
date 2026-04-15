import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { PostsModule } from './modules/posts/posts.module';
import { MoodModule } from './modules/mood/mood.module';
import { TodayCardModule } from './modules/today-card/today-card.module';
import { ChatModule } from './modules/chat/chat.module';
import { AssessmentModule } from './modules/assessment/assessment.module';
import { BookingModule } from './modules/booking/booking.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PostsModule,
    MoodModule,
    TodayCardModule,
    ChatModule,
    AssessmentModule,
    BookingModule,
    AdminModule,
  ],
})
export class AppModule {}
