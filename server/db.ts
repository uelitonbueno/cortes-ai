
export async function listCreditTransactions(ownerId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.ownerId, ownerId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(50);
}

export async function getInfrastructureStats() {
  const db = await getDb();
  if (!db) return null;
  
  const [jobStats] = await db
    .select({
      total: sql<number>`count(*)`,
      failed: sql<number>`count(case when status = 'failed' then 1 end)`,
      queued: sql<number>`count(case when status = 'queued' then 1 end)`,
    })
    .from(processingJobs);

  const [videoStats] = await db
    .select({
      totalVideos: sql<number>`count(*)`,
      totalDuration: sql<number>`sum(${sourceVideos.durationSeconds})`,
    })
    .from(sourceVideos);

  return {
    jobs: jobStats,
    videos: videoStats,
    timestamp: new Date(),
  };
}

export async function processReferral(code: string, newUserId: number) {
  const db = await getDb();
  if (!db) return null;
  
  const referrer = await db.select().from(userWallets).where(eq(userWallets.referralCode, code)).limit(1);
  if (!referrer[0]) return null;

  await db.transaction(async (tx) => {
    await tx.update(userWallets)
      .set({ referredBy: referrer[0].ownerId, creditsBalance: sql`${userWallets.creditsBalance} + 50` })
      .where(eq(userWallets.ownerId, newUserId));
    
    await tx.update(userWallets)
      .set({ creditsBalance: sql`${userWallets.creditsBalance} + 100` })
      .where(eq(userWallets.ownerId, referrer[0].ownerId));
    
    await tx.insert(creditTransactions).values([
      { ownerId: newUserId, amount: 50, type: "referral_bonus", description: "Bônus de boas-vindas por indicação" },
      { ownerId: referrer[0].ownerId, amount: 100, type: "referral_bonus", description: "Bônus por indicação de novo usuário" },
    ]);
  });
  
  return { success: true };
}

export async function handlePaymentWebhook(ownerId: number, amountCredits: number, transactionId: string) {
  const db = await getDb();
  if (!db) return null;

  await db.transaction(async (tx) => {
    await tx.update(userWallets)
      .set({ creditsBalance: sql`${userWallets.creditsBalance} + ${amountCredits}`, planType: "pro" })
      .where(eq(userWallets.ownerId, ownerId));
    
    await tx.insert(creditTransactions).values({
      ownerId,
      amount: amountCredits,
      type: "purchase",
      description: `Compra de créditos - Transação ${transactionId}`,
    });
  });
  
  return { success: true };
}
