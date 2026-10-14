import type { AuthResponse, DashboardDto, ExpenseCategoryDto } from '@credit-follow/shared';
import type { Express } from 'express';
import { Types } from 'mongoose';
import request from 'supertest';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { ExpenseCategoryModel, ExpenseTransactionModel, UserModel } from '../models/index.js';
import {
  bearer,
  createClock,
  createTestApp,
  devSignIn,
  startTestDatabase,
} from '../test/helpers.js';

// "Now" is Wednesday 2026-10-14 12:00 in Israel. Default cycle: Oct 1 – Oct 31.
const clock = createClock('2026-10-14T09:00:00Z');
let stopDb: () => Promise<void>;
let app: Express;
let alice: AuthResponse;
let bob: AuthResponse;
let categories: Record<string, ExpenseCategoryDto>;
const txIds: Record<string, string> = {};

const auth = (session: AuthResponse) => bearer(session);

beforeAll(async () => {
  stopDb = await startTestDatabase();
  app = createTestApp({ now: clock.now });
  alice = await devSignIn(app, 'alice');
  bob = await devSignIn(app, 'bob');
});

afterAll(async () => {
  await stopDb();
});

describe('onboarding', () => {
  const valid = {
    averageMonthlyIncomeMinor: 1_500_000,
    fixedExpenses: [{ name: 'שכר דירה', monthlyBudgetMinor: 500_000 }],
    variableExpenses: [
      { name: 'סופר', monthlyBudgetMinor: 250_000 },
      { name: 'דלק', monthlyBudgetMinor: 80_000 },
    ],
    monthlySavingsGoalMinor: 200_000,
  };

  it('rejects invalid data with field paths', async () => {
    const res = await request(app)
      .post('/onboarding')
      .set(...auth(alice))
      .send({ ...valid, monthlySavingsGoalMinor: 2_000_000 });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ path: 'monthlySavingsGoalMinor' });
  });

  it('rejects the same name as a fixed expense and a variable budget', async () => {
    const res = await request(app)
      .post('/onboarding')
      .set(...auth(alice))
      .send({
        ...valid,
        variableExpenses: [...valid.variableExpenses, { name: 'שכר דירה', monthlyBudgetMinor: 1 }],
      });
    expect(res.status).toBe(400);
    expect(res.body.error.details[0]).toMatchObject({ path: 'variableExpenses.2.name' });
  });

  it('saves income, fixed expenses, variable budgets and the savings goal', async () => {
    expect(alice.user.onboardingCompleted).toBe(false);
    const res = await request(app)
      .post('/onboarding')
      .set(...auth(alice))
      .send(valid)
      .expect(201);
    expect(res.body).toMatchObject({
      onboardingCompleted: true,
      finance: { averageMonthlyIncomeMinor: 1_500_000, monthlySavingsGoalMinor: 200_000 },
    });

    const list = await request(app)
      .get('/categories')
      .set(...auth(alice))
      .expect(200);
    expect(
      list.body.map((c: ExpenseCategoryDto) => [c.name, c.kind, c.monthlyBudgetMinor, c.sortOrder]),
    ).toEqual([
      ['שכר דירה', 'fixed', 500_000, 0],
      ['סופר', 'variable', 250_000, 1],
      ['דלק', 'variable', 80_000, 2],
    ]);
    categories = Object.fromEntries(list.body.map((c: ExpenseCategoryDto) => [c.name, c]));
  });

  it('cannot be completed twice', async () => {
    const res = await request(app)
      .post('/onboarding')
      .set(...auth(alice))
      .send(valid);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ONBOARDING_COMPLETED');
  });
});

describe('categories', () => {
  it('creates a category at the end of the list and rejects duplicates', async () => {
    const res = await request(app)
      .post('/categories')
      .set(...auth(alice))
      .send({ name: 'בילויים', monthlyBudgetMinor: 50_000 })
      .expect(201);
    expect(res.body).toMatchObject({ sortOrder: 3, isArchived: false, kind: 'variable' });
    categories['בילויים'] = res.body;

    const dup = await request(app)
      .post('/categories')
      .set(...auth(alice))
      .send({ name: 'בילויים' });
    expect(dup.status).toBe(409);
  });

  it('edits name and budget', async () => {
    const res = await request(app)
      .patch(`/categories/${categories['דלק']!.id}`)
      .set(...auth(alice))
      .send({ name: 'דלק ורכב', monthlyBudgetMinor: 90_000 })
      .expect(200);
    expect(res.body).toMatchObject({ name: 'דלק ורכב', monthlyBudgetMinor: 90_000 });
  });
});

describe('transactions', () => {
  const create = (body: Record<string, unknown>) =>
    request(app)
      .post('/transactions')
      .set(...auth(alice))
      .send(body);

  it('records expenses with derived statuses', async () => {
    const superMarket = categories['סופר']!.id;
    const rent = categories['שכר דירה']!.id;
    const fuel = categories['דלק']!.id;

    const charged = await create({
      categoryId: superMarket,
      amountMinor: 120_000,
      occurredOn: '2026-10-05',
    }).expect(201);
    expect(charged.body).toMatchObject({
      status: 'charged',
      chargeOn: '2026-10-10',
      paymentMethod: 'credit_card',
      currency: 'ILS',
    });
    txIds.charged = charged.body.id;

    const pending = await create({
      categoryId: superMarket,
      amountMinor: 30_000,
      occurredOn: '2026-10-12',
      description: 'קניות שבועיות',
    }).expect(201);
    expect(pending.body).toMatchObject({
      status: 'pending',
      chargeOn: '2026-11-10',
      occurredOn: '2026-10-12',
    });
    txIds.pending = pending.body.id;

    const cash = await create({
      categoryId: fuel,
      amountMinor: 25_000,
      occurredOn: '2026-10-13',
      paymentMethod: 'cash',
    }).expect(201);
    expect(cash.body).toMatchObject({ status: 'paid', chargeOn: null });
    txIds.cash = cash.body.id;

    await create({
      categoryId: rent,
      amountMinor: 500_000,
      occurredOn: '2026-10-01',
      paymentMethod: 'bank_transfer',
    }).expect(201);
    // Previous cycle (September) — must not count in October.
    const previous = await create({
      categoryId: superMarket,
      amountMinor: 99_900,
      occurredOn: '2026-09-30',
    }).expect(201);
    txIds.previous = previous.body.id;
  });

  it('validates input', async () => {
    const superMarket = categories['סופר']!.id;
    expect(
      (await create({ categoryId: superMarket, amountMinor: 0, occurredOn: '2026-10-01' })).status,
    ).toBe(400);
    expect(
      (await create({ categoryId: superMarket, amountMinor: 100, occurredOn: '2026-02-30' }))
        .status,
    ).toBe(400);
    expect(
      (
        await create({
          categoryId: '507f1f77bcf86cd799439011',
          amountMinor: 100,
          occurredOn: '2026-10-01',
        })
      ).status,
    ).toBe(400);
  });

  it('lists the current and previous cycle', async () => {
    const current = await request(app)
      .get('/transactions')
      .set(...auth(alice))
      .expect(200);
    expect(current.body.cycle).toMatchObject({ startDate: '2026-10-01', endDate: '2026-10-31' });
    expect(current.body.transactions).toHaveLength(4);
    expect(current.body.totalMinor).toBe(675_000);
    expect(current.body.transactions.map((t: { occurredOn: string }) => t.occurredOn)).toEqual([
      '2026-10-13',
      '2026-10-12',
      '2026-10-05',
      '2026-10-01',
    ]);

    const previous = await request(app)
      .get('/transactions?cycleOffset=-1')
      .set(...auth(alice))
      .expect(200);
    expect(previous.body.transactions.map((t: { id: string }) => t.id)).toEqual([txIds.previous]);

    const filtered = await request(app)
      .get(`/transactions?categoryId=${categories['סופר']!.id}`)
      .set(...auth(alice))
      .expect(200);
    expect(filtered.body.totalMinor).toBe(150_000);
  });

  it('edits and deletes a transaction', async () => {
    const edited = await request(app)
      .patch(`/transactions/${txIds.cash}`)
      .set(...auth(alice))
      .send({ amountMinor: 26_000, description: 'תדלוק' })
      .expect(200);
    expect(edited.body).toMatchObject({
      amountMinor: 26_000,
      description: 'תדלוק',
      paymentMethod: 'cash',
    });

    const cleared = await request(app)
      .patch(`/transactions/${txIds.cash}`)
      .set(...auth(alice))
      .send({ amountMinor: 25_000, description: '' })
      .expect(200);
    expect(cleared.body.description).toBeUndefined();

    const temp = await create({
      categoryId: categories['סופר']!.id,
      amountMinor: 1_000,
      occurredOn: '2026-10-14',
    }).expect(201);
    await request(app)
      .delete(`/transactions/${temp.body.id}`)
      .set(...auth(alice))
      .expect(204);
    expect(
      (
        await request(app)
          .get(`/transactions/${temp.body.id}`)
          .set(...auth(alice))
      ).status,
    ).toBe(404);
  });
});

describe('dashboard', () => {
  it('summarizes the cycle exactly', async () => {
    const res = await request(app)
      .get('/dashboard')
      .set(...auth(alice))
      .expect(200);
    const body = res.body as DashboardDto;
    expect(body.cycle).toMatchObject({
      startDate: '2026-10-01',
      endDate: '2026-10-31',
      daysRemaining: 18,
    });
    expect(body.summary).toMatchObject({
      incomeMinor: 1_500_000,
      fixedExpensesMinor: 500_000, // rent
      incomeAfterFixedMinor: 1_000_000,
      fixedExceedsIncome: false,
      savingsGoalMinor: 200_000,
      availableForVariableMinor: 800_000,
      variableBudgetMinor: 390_000, // 250k + 90k + 50k
      variableSpentMinor: 175_000, // groceries 150k + fuel 25k (rent payment excluded)
      remainingVariableBudgetMinor: 215_000, // the "נותר להוציא" figure
      overspentMinor: 0,
      variableBudgetUsedPercent: 45,
      unallocatedMinor: 410_000, // 1,000,000 − 200,000 − 390,000
      variableOverAllocatedMinor: 0,
      fixedRecordedMinor: 500_000, // rent payment recorded, not deducted again
      projectedSavingsMinor: 610_000, // 1,000,000 − 390,000
      savingsOnTrack: true,
      dailyAllowanceMinor: 11_944, // floor(215,000 / 18)
    });
    expect(body.summary.fixedExpenses).toEqual([
      {
        id: categories['שכר דירה']!.id,
        name: 'שכר דירה',
        isArchived: false,
        amountMinor: 500_000,
        recordedMinor: 500_000,
      },
    ]);
    const superMarket = body.summary.categories.find((c) => c.name === 'סופר');
    expect(superMarket).toMatchObject({
      budgetMinor: 250_000,
      spentMinor: 150_000,
      remainingMinor: 100_000,
      usedRatio: 0.6,
      usedPercent: 60,
      status: 'ok',
    });
    // A category with no transactions shows its full budget as remaining.
    const fun = body.summary.categories.find((c) => c.name === 'בילויים');
    expect(fun).toMatchObject({ budgetMinor: 50_000, spentMinor: 0, remainingMinor: 50_000 });
    // Each transaction is counted once: category spending adds up to the total.
    const categorySum = body.summary.categories.reduce((sum, c) => sum + c.spentMinor, 0);
    expect(categorySum).toBe(body.summary.variableSpentMinor);
    expect(body.summary.categories.map((c) => c.name)).not.toContain('שכר דירה');
    expect(body.pendingChargesMinor).toBe(30_000);
    expect(body.nextCreditCardChargeOn).toBe('2026-11-10');
    expect(body.recentTransactions).toHaveLength(4);
  });

  it('keeps spending of archived categories and blocks new expenses on them', async () => {
    const fuel = categories['דלק']!.id;
    await request(app)
      .patch(`/categories/${fuel}`)
      .set(...auth(alice))
      .send({ isArchived: true })
      .expect(200);

    const active = await request(app)
      .get('/categories')
      .set(...auth(alice))
      .expect(200);
    expect(active.body.map((c: ExpenseCategoryDto) => c.id)).not.toContain(fuel);
    const all = await request(app)
      .get('/categories?includeArchived=true')
      .set(...auth(alice))
      .expect(200);
    expect(all.body.at(-1)).toMatchObject({ id: fuel, isArchived: true });

    const dash = (
      await request(app)
        .get('/dashboard')
        .set(...auth(alice))
        .expect(200)
    ).body as DashboardDto;
    expect(dash.summary.variableSpentMinor).toBe(175_000);
    expect(dash.summary.variableBudgetMinor).toBe(300_000);
    expect(dash.summary.categories.find((c) => c.id === fuel)).toMatchObject({
      isArchived: true,
      budgetMinor: 0,
      spentMinor: 25_000,
    });

    const blocked = await request(app)
      .post('/transactions')
      .set(...auth(alice))
      .send({ categoryId: fuel, amountMinor: 100, occurredOn: '2026-10-14' });
    expect(blocked.status).toBe(400);

    await request(app)
      .patch(`/categories/${fuel}`)
      .set(...auth(alice))
      .send({ isArchived: false })
      .expect(200);
  });
});

describe('income and financial cycle settings', () => {
  it('updates income and validates the savings goal against it', async () => {
    const tooHigh = await request(app)
      .put('/me/finance')
      .set(...auth(alice))
      .send({ monthlySavingsGoalMinor: 1_600_000 });
    expect(tooHigh.status).toBe(400);

    const res = await request(app)
      .put('/me/finance')
      .set(...auth(alice))
      .send({ averageMonthlyIncomeMinor: 1_600_000 })
      .expect(200);
    expect(res.body.finance).toEqual({
      averageMonthlyIncomeMinor: 1_600_000,
      monthlySavingsGoalMinor: 200_000,
    });
  });

  it('moves the cycle to the salary day and changes the dashboard', async () => {
    const settings = {
      anchor: 'salary',
      startDay: 1,
      salaryDay: 10,
      creditCardChargeDay: 2,
      timeZone: 'Asia/Jerusalem',
    };
    const res = await request(app)
      .put('/me/financial-cycle')
      .set(...auth(alice))
      .send(settings)
      .expect(200);
    expect(res.body.preferences.financialCycle).toEqual(settings);

    const dash = (
      await request(app)
        .get('/dashboard')
        .set(...auth(alice))
        .expect(200)
    ).body as DashboardDto;
    expect(dash.cycle).toMatchObject({ startDate: '2026-10-10', endDate: '2026-11-09' });
    // Only Oct 12 (30,000) and Oct 13 (25,000) fall in Oct 10 – Nov 9.
    expect(dash.summary.variableSpentMinor).toBe(55_000);
    expect(dash.nextCreditCardChargeOn).toBe('2026-11-02');

    const bad = await request(app)
      .put('/me/financial-cycle')
      .set(...auth(alice))
      .send({ ...settings, timeZone: 'Nowhere/City' });
    expect(bad.status).toBe(400);
    const badDay = await request(app)
      .put('/me/financial-cycle')
      .set(...auth(alice))
      .send({ ...settings, salaryDay: 32 });
    expect(badDay.status).toBe(400);
  });
});

describe('fixed expenses', () => {
  let insuranceId: string;
  const dashboard = async () =>
    (
      await request(app)
        .get('/dashboard')
        .set(...auth(alice))
        .expect(200)
    ).body as DashboardDto;

  it('creates, lists and edits fixed expenses separately from variable budgets', async () => {
    const created = await request(app)
      .post('/categories')
      .set(...auth(alice))
      .send({ name: 'ביטוח רכב', kind: 'fixed', monthlyBudgetMinor: 30_000 })
      .expect(201);
    expect(created.body).toMatchObject({ kind: 'fixed', monthlyBudgetMinor: 30_000 });
    insuranceId = created.body.id;

    const fixedList = await request(app)
      .get('/categories?kind=fixed')
      .set(...auth(alice))
      .expect(200);
    expect(fixedList.body.map((c: ExpenseCategoryDto) => c.name)).toEqual([
      'שכר דירה',
      'ביטוח רכב',
    ]);
    const variableList = await request(app)
      .get('/categories?kind=variable')
      .set(...auth(alice))
      .expect(200);
    expect(variableList.body.every((c: ExpenseCategoryDto) => c.kind === 'variable')).toBe(true);

    const edited = await request(app)
      .patch(`/categories/${insuranceId}`)
      .set(...auth(alice))
      .send({ monthlyBudgetMinor: 35_000, kind: 'variable' })
      .expect(200);
    // kind is immutable: the update ignores it.
    expect(edited.body).toMatchObject({ monthlyBudgetMinor: 35_000, kind: 'fixed' });

    const dash = await dashboard();
    expect(dash.summary.fixedExpensesMinor).toBe(535_000);
    expect(dash.summary.incomeAfterFixedMinor).toBe(1_600_000 - 535_000);
    expect(dash.summary.unallocatedMinor).toBe(1_600_000 - 535_000 - 200_000 - 390_000);
  });

  it('rejects a variable budget with the same name as a fixed expense', async () => {
    const dup = await request(app)
      .post('/categories')
      .set(...auth(alice))
      .send({ name: 'ביטוח רכב', kind: 'variable' });
    expect(dup.status).toBe(409);
  });

  it('does not deduct a payment recorded against a fixed expense twice', async () => {
    const before = await dashboard();
    await request(app)
      .post('/transactions')
      .set(...auth(alice))
      .send({ categoryId: insuranceId, amountMinor: 35_000, occurredOn: '2026-10-14' })
      .expect(201);
    const after = await dashboard();
    expect(after.summary.variableSpentMinor).toBe(before.summary.variableSpentMinor);
    expect(after.summary.remainingVariableBudgetMinor).toBe(
      before.summary.remainingVariableBudgetMinor,
    );
    expect(after.summary.incomeAfterFixedMinor).toBe(before.summary.incomeAfterFixedMinor);
    expect(after.summary.fixedRecordedMinor).toBe(before.summary.fixedRecordedMinor + 35_000);
    expect(after.summary.fixedExpenses.find((f) => f.id === insuranceId)).toMatchObject({
      amountMinor: 35_000,
      recordedMinor: 35_000,
    });
  });

  it('archives a fixed expense: it leaves the plan, history is kept', async () => {
    await request(app)
      .patch(`/categories/${insuranceId}`)
      .set(...auth(alice))
      .send({ isArchived: true })
      .expect(200);
    const dash = await dashboard();
    expect(dash.summary.fixedExpensesMinor).toBe(500_000);
    expect(dash.summary.fixedExpenses.find((f) => f.id === insuranceId)).toMatchObject({
      isArchived: true,
      amountMinor: 0,
      recordedMinor: 35_000,
    });
    const active = await request(app)
      .get('/categories?kind=fixed')
      .set(...auth(alice))
      .expect(200);
    expect(active.body.map((c: ExpenseCategoryDto) => c.id)).not.toContain(insuranceId);
    expect(await ExpenseTransactionModel.countDocuments({ categoryId: insuranceId })).toBe(1);
    // Clean up so later assertions on alice's transaction count are unchanged.
    await ExpenseTransactionModel.deleteMany({ categoryId: insuranceId });
  });

  it('treats legacy categories without a kind as variable budgets', async () => {
    const legacy = await ExpenseCategoryModel.collection.insertOne({
      userId: new Types.ObjectId(alice.user.id),
      name: 'קטגוריה ישנה',
      monthlyBudgetMinor: 10_000,
      sortOrder: 99,
      isArchived: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    });
    const variable = await request(app)
      .get('/categories?kind=variable')
      .set(...auth(alice))
      .expect(200);
    expect(variable.body.find((c: ExpenseCategoryDto) => c.name === 'קטגוריה ישנה')).toMatchObject({
      kind: 'variable',
    });
    const dash = await dashboard();
    expect(dash.summary.variableBudgetMinor).toBe(390_000 + 10_000);
    await ExpenseCategoryModel.collection.deleteOne({ _id: legacy.insertedId });
  });

  it('isolates fixed expenses between users', async () => {
    const rentId = categories['שכר דירה']!.id;
    const patch = await request(app)
      .patch(`/categories/${rentId}`)
      .set(...auth(bob))
      .send({ monthlyBudgetMinor: 1 });
    expect(patch.status).toBe(404);
    const bobFixed = await request(app)
      .get('/categories?kind=fixed')
      .set(...auth(bob));
    expect(bobFixed.body).toEqual([]);
    expect((await dashboard()).summary.fixedExpensesMinor).toBe(500_000);
  });
});

describe('data isolation', () => {
  it("never exposes or modifies another user's data", async () => {
    const aliceTx = txIds.pending!;
    const aliceCategory = categories['סופר']!.id;

    expect(
      (
        await request(app)
          .get(`/transactions/${aliceTx}`)
          .set(...auth(bob))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/transactions/${aliceTx}`)
          .set(...auth(bob))
          .send({ amountMinor: 1 })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .delete(`/transactions/${aliceTx}`)
          .set(...auth(bob))
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .patch(`/categories/${aliceCategory}`)
          .set(...auth(bob))
          .send({ name: 'x' })
      ).status,
    ).toBe(404);
    expect(
      (
        await request(app)
          .post('/transactions')
          .set(...auth(bob))
          .send({ categoryId: aliceCategory, amountMinor: 100, occurredOn: '2026-10-14' })
      ).status,
    ).toBe(400);
    expect(
      (
        await request(app)
          .get('/categories')
          .set(...auth(bob))
      ).body,
    ).toEqual([]);
    expect(
      (
        await request(app)
          .get('/dashboard')
          .set(...auth(bob))
      ).body.summary.variableSpentMinor,
    ).toBe(0);
  });

  it('ignores client-supplied user ids', async () => {
    const bobCategory = await request(app)
      .post('/categories')
      .set(...auth(bob))
      .send({ name: 'שלי', userId: alice.user.id })
      .expect(201);
    const doc = await ExpenseCategoryModel.findById(bobCategory.body.id);
    expect(doc?.userId.toString()).toBe(bob.user.id);
  });
});

describe('account deletion', () => {
  it('deletes the user, their data and their sessions', async () => {
    await request(app)
      .delete('/me')
      .set(...auth(bob))
      .expect(204);
    expect(await UserModel.exists({ _id: bob.user.id })).toBeNull();
    expect(await ExpenseCategoryModel.countDocuments({ userId: bob.user.id })).toBe(0);
    expect(
      (
        await request(app)
          .get('/me')
          .set(...auth(bob))
      ).status,
    ).toBe(401);
    // Alice is unaffected.
    expect(await ExpenseTransactionModel.countDocuments({ userId: alice.user.id })).toBe(5);
  });
});
