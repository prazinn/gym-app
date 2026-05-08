// seed.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const { createUniqueMemberCode } = require('./src/utils/memberCode');
const qrService = require('./src/services/qrService');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Admin User
  const adminPassword = 'adminpassword123';
  const adminHash = await bcrypt.hash(adminPassword, 12);
  const admin = await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@gymtrack.com',
      passwordHash: adminHash,
      role: 'admin',
    },
  });
  console.log('✅ Admin user created: admin / ' + adminPassword);

  // 2. Create Staff User
  const staffHash = await bcrypt.hash('staff123', 12);
  await prisma.user.upsert({
    where: { username: 'staff' },
    update: {},
    create: {
      username: 'staff',
      email: 'staff@gymtrack.com',
      passwordHash: staffHash,
      role: 'staff',
    },
  });
  console.log('✅ Staff user created: staff / staff123');

  // 3. Create Sample Plans
  const plans = [
    { planName: 'Monthly Starter', durationDays: 30, price: 29.99, features: 'Gym Access, 1 Trainer Session' },
    { planName: 'Annual Pro', durationDays: 365, price: 299.99, features: 'Unlimited Access, All Classes, Free Locker' },
    { planName: 'Student Pass', durationDays: 30, price: 19.99, features: 'Gym Access (9am-4pm)' },
  ];

  for (const p of plans) {
    await prisma.plan.upsert({
      where: { planName: p.planName },
      update: {},
      create: p,
    });
  }
  console.log('✅ Sample plans created');

  // 4. Create Sample Members
  const sampleMembers = [
    { fullName: 'Alice Johnson', email: 'alice@example.com', heightCm: 165, weightKg: 58, planType: 'Monthly Starter' },
    { fullName: 'Bob Smith', email: 'bob@example.com', heightCm: 180, weightKg: 85, planType: 'Annual Pro' },
    { fullName: 'Charlie Brown', email: 'charlie@example.com', heightCm: 175, weightKg: 70, planType: 'Student Pass' },
    { fullName: 'Diana Prince', email: 'diana@example.com', heightCm: 172, weightKg: 64, planType: 'Annual Pro' },
    { fullName: 'Ethan Hunt', email: 'ethan@example.com', heightCm: 178, weightKg: 78, planType: 'Monthly Starter' },
  ];

  for (const m of sampleMembers) {
    const existing = await prisma.member.findUnique({ where: { email: m.email } });
    if (!existing) {
      const code = await createUniqueMemberCode();
      const member = await prisma.member.create({
        data: {
          ...m,
          memberCode: code,
          planStart: new Date(),
          planEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
      // Generate QR
      await qrService.generate(code, member.id);
    }
  }
  console.log('✅ 5 sample members created with QR codes');

  console.log('🚀 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
