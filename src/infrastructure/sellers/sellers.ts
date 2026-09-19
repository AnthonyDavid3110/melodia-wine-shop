import { asc, eq } from "drizzle-orm";
import { db } from "../database/client";
import { sellers } from "../database/schema";

export class SellerNotFoundError extends Error {
  constructor(id: string) {
    super(`Vendeur introuvable (${id}).`);
    this.name = "SellerNotFoundError";
  }
}

type DbHandle = Pick<typeof db, "select" | "insert" | "update">;

export interface SellerFieldsInput {
  firstName: string;
  lastName: string;
}

/** Alphabetical by last name — the reusable member roster, not campaign-ordered. */
export async function listSellers(dbHandle: DbHandle = db) {
  return dbHandle.select().from(sellers).orderBy(asc(sellers.lastName), asc(sellers.firstName));
}

export async function getSeller(id: string, dbHandle: DbHandle = db) {
  const [seller] = await dbHandle.select().from(sellers).where(eq(sellers.id, id));
  return seller ?? null;
}

export async function createSeller(input: SellerFieldsInput, dbHandle: DbHandle = db) {
  const [seller] = await dbHandle
    .insert(sellers)
    .values({ ...input, active: true })
    .returning();
  if (!seller) {
    throw new Error("createSeller: insert returned no row.");
  }
  return seller;
}

export async function updateSeller(id: string, input: SellerFieldsInput, dbHandle: DbHandle = db) {
  const [seller] = await dbHandle.update(sellers).set(input).where(eq(sellers.id, id)).returning();
  if (!seller) {
    throw new SellerNotFoundError(id);
  }
  return seller;
}

/** The normal "remove" action — never a hard delete (Gate 1 §6/§19, Gate 2A deletion policy). */
export async function setSellerActive(id: string, active: boolean, dbHandle: DbHandle = db) {
  const [seller] = await dbHandle
    .update(sellers)
    .set({ active })
    .where(eq(sellers.id, id))
    .returning();
  if (!seller) {
    throw new SellerNotFoundError(id);
  }
  return seller;
}
