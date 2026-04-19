import 'dotenv/config';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  const prisma = new PrismaClient({ adapter });

  console.log('🌱 Seeding...');

  // ==================== Today Card Questions ====================
  const todayQuestions = [
    { question: 'วันนี้มีเรื่องอะไรที่ทำให้คุณยิ้มได้บ้าง?', daysFromNow: 0 },
    {
      question: 'ถ้าเขียนจดหมายถึงตัวเองในอนาคต คุณอยากบอกอะไร?',
      daysFromNow: 1,
    },
    {
      question: 'สิ่งเล็ก ๆ ที่ทำให้คุณรู้สึกขอบคุณในวันนี้คืออะไร?',
      daysFromNow: 2,
    },
    {
      question: 'ถ้าวันนี้เป็นสีอะไร คุณจะเลือกสีอะไร เพราะอะไร?',
      daysFromNow: 3,
    },
    {
      question: 'มีใครที่คุณอยากบอกว่า "ขอบคุณ" วันนี้บ้างไหม?',
      daysFromNow: 4,
    },
    {
      question: 'ถ้าคุณพูดกับตัวเองได้หนึ่งประโยค คุณจะพูดว่าอะไร?',
      daysFromNow: 5,
    },
  ];

  for (const q of todayQuestions) {
    const date = new Date();
    date.setDate(date.getDate() + q.daysFromNow);
    date.setHours(0, 0, 0, 0);

    await prisma.todayQuestion.upsert({
      where: { date },
      update: { question: q.question },
      create: { question: q.question, date },
    });
  }
  console.log(`✅ Today Card questions: ${todayQuestions.length} ข้อ`);

  // ==================== Assessment: ความเครียด (PSS-10) ====================
  const stressQuestions = [
    'ในวันที่มีเรื่องไม่คาดคิดเกิดขึ้น คุณสังเกตตัวเองไหมว่า รู้สึกหงุดหงิดหรือเสียอารมณ์ขึ้นมามากแค่ไหน',
    'และในช่วงเวลานั้น คุณเคยรู้สึกไหมว่าบางสิ่งในชีวิตเริ่มควบคุมไม่ได้ หรือเหมือนสิ่งที่สำคัญกำลังค่อย ๆ หลุดมือไป',
    'เมื่อวันเวลาผ่านไป ความประหม่า ความกระสับกระส่าย หรือความเครียดแทรกเข้ามาในใจคุณบ่อยแค่ไหน',
    'ท่ามกลางความรู้สึกเหล่านั้น คุณยังรู้สึกมั่นใจในตัวเองแค่ไหน ว่าพอจะรับมือกับปัญหาต่าง ๆ ได้',
    'เมื่อมองภาพรวมของชีวิตในช่วงนี้ คุณรู้สึกไหมว่าสิ่งต่าง ๆ กำลังค่อย ๆ เดินไปในทิศทางที่คุณต้องการ',
    'แล้วมีช่วงเวลาไหนบ้างไหม ที่แม้แต่เรื่องที่เคยจัดการได้ กลับรู้สึกหนักเกินจะรับมือ',
    'เมื่อมีเรื่องราวเข้ามากวนใจ คุณสามารถจัดการกับความคิด และความรู้สึกเหล่านั้นได้ดีแค่ไหน',
    'และในสถานการณ์ต่าง ๆ ที่ต้องเผชิญ คุณรู้สึกว่ายังควบคุมสิ่งที่เกิดขึ้นรอบตัวได้มากน้อยเพียงใด',
    'เมื่อเจอสิ่งที่อยู่นอกเหนือการควบคุม คุณพบว่าตัวเองรู้สึกโกรธหรือหงุดหงิดบ่อยแค่ไหน',
    'และเมื่อทุกอย่างถาโถมเข้ามาพร้อมกัน คุณรู้สึกไหมว่าปัญหาเหล่านั้นกำลังทับถมจนยากที่จะเอาชนะ',
  ];

  for (let i = 0; i < stressQuestions.length; i++) {
    await prisma.assessmentQuestion.upsert({
      where: { id: `stress-${i + 1}` },
      update: { text: stressQuestions[i], order: i + 1 },
      create: { id: `stress-${i + 1}`, text: stressQuestions[i], order: i + 1 },
    });
  }
  console.log(`✅ Stress assessment: ${stressQuestions.length} ข้อ`);

  // ==================== Assessment: ซึมเศร้า (PHQ-9) ====================
  const depressionQuestions = [
    'ช่วงนี้พอตื่นขึ้นมาแล้วรู้สึกว่าสิ่งที่เคยทำแล้วมีความสุข กลับค่อย ๆ จืดจางลงไปโดยไม่รู้ตัว',
    'บางวันก็มีความรู้สึกหม่นหมองหรือท้อแท้อยากนั่งอยู่เงียบ ๆ โดยไม่รู้ว่ามันเริ่มเป็นแบบนี้ตั้งแต่เมื่อไหร่',
    'พยายามนอนเท่าไหร่ก็ไม่หลับ พอหลับก็สะดุ้งตื่นกลางดึก หรือบางวันก็นอนยาวผิดปกติแต่ตื่นมากลับไม่รู้สึกว่าได้พักเลย',
    'รู้สึกเหนื่อยง่ายเหมือนมีอะไรมาถ่วงตัวไว้ แม้แต่เรื่องที่ไม่น่าจะยากก็ต้องฝืนตัวเองมากกว่าเดิม',
    'บางวันเห็นอาหารที่ชอบแล้วรู้สึกไม่อยากกินเลย หรือบางวันกลับกินมากจนเกินไป',
    'เหมือนมีเสียงเบา ๆ ในหัวถามว่า "เราดีพอไหม" กลัวว่าจะทำให้คนอื่นผิดหวังจัง ความรู้สึกนี้สลัดออกยากเหลือเกิน',
    'เวลาตั้งใจจะทำอะไรสักอย่าง แต่กลับไม่มีสมาธิเลย พยายามดึงกลับมาแล้วแต่ก็จดจ่อได้ไม่นาน',
    'รู้สึกว่าตัวเองทำอะไรช้าลงจนคนอื่นสังเกตเห็น หรือบางทีก็กระสับกระส่ายจนทำตัวไม่ถูก',
    'ในวันที่มันหนักเกินจะรับไหว... มีความคิดแวบขึ้นมาว่าอยากทำร้ายตัวเองเพื่อให้ความเจ็บปวดนี้มันหยุดลงสักที หรือรู้สึกว่าถ้าไม่มีเราอยู่คงดีกว่า',
  ];

  for (let i = 0; i < depressionQuestions.length; i++) {
    await prisma.assessmentQuestion.upsert({
      where: { id: `phq9-${i + 1}` },
      update: { text: depressionQuestions[i], order: i + 101 },
      create: {
        id: `phq9-${i + 1}`,
        text: depressionQuestions[i],
        order: i + 101,
      },
    });
  }
  console.log(
    `✅ Depression assessment (PHQ-9): ${depressionQuestions.length} ข้อ`,
  );

  // ==================== Admin User ====================
  const bcrypt = await import('bcrypt');
  const adminPassword = await bcrypt.hash('admin1234', 10);
  await prisma.user.upsert({
    where: { email: 'admin@trustmate.app' },
    update: { role: 'admin' },
    create: {
      email: 'admin@trustmate.app',
      password: adminPassword,
      alias: 'Admin',
      role: 'admin',
    },
  });
  console.log('✅ Admin user: admin@trustmate.app / admin1234');

  // ==================== Therapists + Time Slots ====================
  const therapistsData = [
    {
      name: 'พญ. ใจดี สุขสบาย',
      title: 'จิตแพทย์ทั่วไป',
      specialties: [
        'ปัญหาครอบครัว',
        'การเลี้ยงลูก',
        'ปัญหาวัยรุ่น',
        'ปัญหาความสัมพันธ์',
      ],
      location: 'กรุงเทพฯ',
      clinic: 'รพ. จิตเวชนครพิงค์',
      pricePerSlot: 1500,
      avgRating: 4.8,
      reviewCount: 24,
    },
    {
      name: 'นพ. สมชาย รักษาใจ',
      title: 'จิตแพทย์เด็กและวัยรุ่น',
      specialties: ['ซึมเศร้า', 'วิตกกังวล', 'ADHD', 'ปัญหาการเรียน'],
      location: 'กรุงเทพฯ',
      clinic: 'รพ. ศิริราช',
      pricePerSlot: 2000,
      avgRating: 4.9,
      reviewCount: 56,
    },
    {
      name: 'ผศ.ดร. ปรียา จิตวิทยา',
      title: 'นักจิตวิทยาคลินิก',
      specialties: ['ความเครียด', 'Burnout', 'ปัญหาการทำงาน', 'CBT'],
      location: 'เชียงใหม่',
      clinic: 'คลินิกใจสบาย',
      pricePerSlot: 1200,
      avgRating: 4.7,
      reviewCount: 18,
    },
  ];

  for (const t of therapistsData) {
    // Check if therapist with this name already exists
    const existing = await prisma.therapist.findFirst({
      where: { name: t.name },
    });
    const therapist = existing || (await prisma.therapist.create({ data: t }));
    if (!existing) {
      console.log(`✅ Therapist: ${therapist.name}`);
    } else {
      console.log(`⏭️  Therapist already exists: ${therapist.name}`);
    }

    // Create time slots for next 14 days
    const now = new Date();
    const timeSlotTemplates = [
      { startTime: '17:00', endTime: '17:30' },
      { startTime: '17:30', endTime: '18:00' },
      { startTime: '18:00', endTime: '18:30' },
      { startTime: '18:30', endTime: '19:00' },
      { startTime: '19:00', endTime: '19:30' },
      { startTime: '19:30', endTime: '20:00' },
    ];

    let slotCount = 0;
    for (let dayOffset = 1; dayOffset <= 14; dayOffset++) {
      const date = new Date(now);
      date.setDate(date.getDate() + dayOffset);
      date.setHours(0, 0, 0, 0);

      if (date.getDay() === 0) continue; // Skip Sundays

      for (const ts of timeSlotTemplates) {
        await prisma.timeSlot.upsert({
          where: {
            therapistId_date_startTime: {
              therapistId: therapist.id,
              date,
              startTime: ts.startTime,
            },
          },
          update: {},
          create: {
            therapistId: therapist.id,
            date,
            startTime: ts.startTime,
            endTime: ts.endTime,
          },
        });
        slotCount++;
      }
    }
    console.log(`   ${slotCount} time slots`);
  }

  await prisma.$disconnect();
  console.log('🎉 Seed complete!');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
