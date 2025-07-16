"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

const serializeTransaction = (obj) => {
  const { balance, amount, ...rest } = obj;
  const serialized = { ...rest };

  if (balance) {
    serialized.balance = balance.toNumber();
  }

  if (amount) {
    serialized.amount = amount.toNumber();
  }

  return serialized;
};

interface CreateAccountData {
  name: string;
  balance: number | string;
  isDefault?: boolean;
  [key: string]: unknown;
}

interface CreateAccountResult {
  success: boolean;
  data: Record<string, any>;
}

export async function createAccount(data: CreateAccountData): Promise<CreateAccountResult> {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    // Convert balance to float before saving
    const balanceFloat: number = parseFloat(data.balance as string);
    if (isNaN(balanceFloat)) throw new Error("Invalid balance amount");

    // Check if this is user's first account
    const existingAccounts = await db.account.findMany({
      where: { userId: user.id },
    });

    const shouldBeDefault: boolean =
      existingAccounts.length === 0 ? true : !!data.isDefault;

    //if this account is default, set all other accounts to not default
    if (shouldBeDefault) {
      await db.account.updateMany({
        where: { userId: user.id, isDefault: true },
        data: { isDefault: false },
      });
    }

    const account = await db.account.create({
      data: {
        ...data,
        balance: balanceFloat,
        userId: user.id,
        isDefault: shouldBeDefault,
      },
    });

    const serializeAccount = serializeTransaction(account);

    revalidatePath("/dashboard");
    return { success: true, data: serializeAccount };
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Failed to create account: ${error.message}`);
    } else {
      throw new Error("Failed to create account: Unknown error");
    }
  }
}

export async function getUserAccounts() {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");

  const user = await db.user.findUnique({
    where: { clerkUserId: userId },
  });

  if (!user) throw new Error("User not found");

  const accounts = await db.account.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    include: {
      _count: {
        select: { transactions: true },
      },
    },
  });

  const serializedAccounts = accounts.map(serializeTransaction);

  return serializedAccounts;
}
