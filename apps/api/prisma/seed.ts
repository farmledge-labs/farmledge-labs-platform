import { PrismaClient, Commodity, Grade, TokenStatus } from '@prisma/client';

const prisma = new PrismaClient();

async function main(): Promise<void> {
  console.log('🌱 Seeding database with Nigerian agricultural test data...');

  // ─── Farmers ──────────────────────────────────────────────────────────────

  const aminuMusa = await prisma.farmer.upsert({
    where: { phone: '08123456789' },
    update: {},
    create: {
      fullName: 'Aminu Musa',
      phone: '08123456789',
      stellarWallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890001',
      bvnVerified: true,
    },
  });

  const fatimaBello = await prisma.farmer.upsert({
    where: { phone: '08134567890' },
    update: {},
    create: {
      fullName: 'Fatima Bello',
      phone: '08134567890',
      stellarWallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890002',
      bvnVerified: true,
    },
  });

  const chukwuemekaObi = await prisma.farmer.upsert({
    where: { phone: '08145678901' },
    update: {},
    create: {
      fullName: 'Chukwuemeka Obi',
      phone: '08145678901',
      stellarWallet: 'GABCDEFGHIJKLMNOPQRSTUVWXYZ012345678901234567890003',
      bvnVerified: false,
    },
  });

  console.log(`  ✔ Farmers: ${aminuMusa.fullName}, ${fatimaBello.fullName}, ${chukwuemekaObi.fullName}`);

  // ─── Warehouses ───────────────────────────────────────────────────────────

  const kanoCentral = await prisma.warehouse.upsert({
    where: { custodianWallet: 'GCUSTODIAN1KANOABCDEFGHIJKLMNOPQRSTUVWXYZ01234567' },
    update: {},
    create: {
      name: 'Kano Central Grain Store',
      location: 'Fagge LGA',
      state: 'Kano',
      certified: true,
      capacityTonnes: 5000,
      custodianWallet: 'GCUSTODIAN1KANOABCDEFGHIJKLMNOPQRSTUVWXYZ01234567',
    },
  });

  const kadunaDepot = await prisma.warehouse.upsert({
    where: { custodianWallet: 'GCUSTODIAN2KADUNAABCDEFGHIJKLMNOPQRSTUVWXYZ012345' },
    update: {},
    create: {
      name: 'Kaduna Agricultural Depot',
      location: 'Chikun LGA',
      state: 'Kaduna',
      certified: true,
      capacityTonnes: 3000,
      custodianWallet: 'GCUSTODIAN2KADUNAABCDEFGHIJKLMNOPQRSTUVWXYZ012345',
    },
  });

  console.log(`  ✔ Warehouses: ${kanoCentral.name}, ${kadunaDepot.name}`);

  // ─── Tokens ───────────────────────────────────────────────────────────────
  // Invariant: totalWeightKg === bagCount * weightPerBagKg (enforced at application layer)

  // 1. Active maize token — Aminu @ Kano
  await prisma.token.upsert({
    where: { tokenId: 'KN-2026-000001' },
    update: {},
    create: {
      tokenId: 'KN-2026-000001',
      commodity: Commodity.MAIZE_WHITE,
      grade: Grade.Grade_A,
      bagCount: 40,
      weightPerBagKg: 100,
      totalWeightKg: 40 * 100, // 4000
      status: TokenStatus.active,
      isLocked: false,
      txHash: 'TX001ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF01',
      stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/TX001ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF01',
      farmerId: aminuMusa.id,
      warehouseId: kanoCentral.id,
    },
  });

  // 2. Active sesame token — locked against a loan — Fatima @ Kano
  await prisma.token.upsert({
    where: { tokenId: 'KD-2026-000002' },
    update: {},
    create: {
      tokenId: 'KD-2026-000002',
      commodity: Commodity.SESAME,
      grade: Grade.Grade_A,
      bagCount: 20,
      weightPerBagKg: 50,
      totalWeightKg: 20 * 50, // 1000
      status: TokenStatus.active,
      isLocked: true,
      lockedByLenderId: 'LENDER-ACCESS-BANK-001',
      loanReference: 'LOAN-2026-001',
      txHash: 'TX002ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF02',
      stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/TX002ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF02',
      farmerId: fatimaBello.id,
      warehouseId: kanoCentral.id,
    },
  });

  // 3. Transferred maize token — Aminu @ Kaduna
  await prisma.token.upsert({
    where: { tokenId: 'KN-2026-000003' },
    update: {},
    create: {
      tokenId: 'KN-2026-000003',
      commodity: Commodity.MAIZE_YELLOW,
      grade: Grade.Grade_B,
      bagCount: 30,
      weightPerBagKg: 80,
      totalWeightKg: 30 * 80, // 2400
      status: TokenStatus.transferred,
      isLocked: false,
      txHash: 'TX003ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF03',
      stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/TX003ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF03',
      farmerId: aminuMusa.id,
      warehouseId: kadunaDepot.id,
    },
  });

  // 4. Exited maize token — Fatima @ Kaduna
  await prisma.token.upsert({
    where: { tokenId: 'KD-2026-000004' },
    update: {},
    create: {
      tokenId: 'KD-2026-000004',
      commodity: Commodity.MAIZE_WHITE,
      grade: Grade.Grade_C,
      bagCount: 50,
      weightPerBagKg: 100,
      totalWeightKg: 50 * 100, // 5000
      status: TokenStatus.exited,
      isLocked: false,
      exitDate: new Date('2026-04-01'),
      txHash: 'TX004ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF04',
      stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/TX004ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF04',
      farmerId: fatimaBello.id,
      warehouseId: kadunaDepot.id,
    },
  });

  // 5. Active sesame token — Chukwuemeka @ Kano
  await prisma.token.upsert({
    where: { tokenId: 'KN-2026-000005' },
    update: {},
    create: {
      tokenId: 'KN-2026-000005',
      commodity: Commodity.SESAME,
      grade: Grade.Grade_B,
      bagCount: 25,
      weightPerBagKg: 50,
      totalWeightKg: 25 * 50, // 1250
      status: TokenStatus.active,
      isLocked: false,
      txHash: 'TX005ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF05',
      stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/TX005ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF05',
      farmerId: chukwuemekaObi.id,
      warehouseId: kanoCentral.id,
    },
  });

  // 6. Active maize token — Chukwuemeka @ Kaduna
  await prisma.token.upsert({
    where: { tokenId: 'KD-2026-000006' },
    update: {},
    create: {
      tokenId: 'KD-2026-000006',
      commodity: Commodity.MAIZE_YELLOW,
      grade: Grade.Grade_A,
      bagCount: 60,
      weightPerBagKg: 100,
      totalWeightKg: 60 * 100, // 6000
      status: TokenStatus.active,
      isLocked: false,
      txHash: 'TX006ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF06',
      stellarExplorerLink: 'https://stellar.expert/explorer/testnet/tx/TX006ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789ABCDEF06',
      farmerId: chukwuemekaObi.id,
      warehouseId: kadunaDepot.id,
    },
  });

  console.log('  ✔ Tokens: KN-2026-000001 through KD-2026-000006 (active, locked, transferred, exited)');
  console.log('✅ Seeding complete.');
}

main()
  .catch((err: unknown) => {
    console.error('❌ Seed failed:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
