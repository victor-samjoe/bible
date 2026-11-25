import { getDatabaseAsync } from "../db/client";
import { createOriginalReader } from "./reader";
import { createDrizzleOriginalRepository } from "./repository";

export async function getOriginalReader() {
  const database = await getDatabaseAsync();
  return createOriginalReader(database ? createDrizzleOriginalRepository(database) : null);
}
