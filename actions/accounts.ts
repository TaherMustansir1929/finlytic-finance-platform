"use server";

import { db } from "@/lib/prisma";
import { auth } from "@clerk/nextjs/server";
import { revalidatePath } from "next/cache";

interface SerializableTransaction {
  [key: string]: any;
  balance?: number;
  amount?: number;
}

interface TransactionLike {
  [key: string]: any;
  balance?: { toNumber: () => number };
  amount?: { toNumber: () => number };
}

const serializeTransaction = (obj: TransactionLike): SerializableTransaction => {
  const { balance, amount, ...rest } = obj;
  const serialized: SerializableTransaction = { ...rest };

  if (balance) {
    serialized.balance = balance.toNumber();
  }

  if (amount) {
    serialized.amount = amount.toNumber();
  }

  return serialized;
};

export async function updateDefaultAccount(accountId: string) {
  try {
    const { userId } = await auth();
    if (!userId) throw new Error("Unauthorized");

    const user = await db.user.findUnique({
      where: { clerkUserId: userId },
    });

    if (!user) throw new Error("User not found");

    await db.account.updateMany({
      where: { userId: user.id, isDefault: true },
      data: { isDefault: false },
    });

    const account = await db.account.update({
      where: { id: accountId, userId: user.id },
      data: { isDefault: true },
    });

    revalidatePath("/dashboard");

    return {success: true, account: serializeTransaction(account)};
  } catch (error) {
    return {success : false, error: error instanceof Error ? error.message : String(error)};
  }
}
