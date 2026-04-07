import type { CreateExpressContextOptions } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";

export type TrpcContext = {
  req: CreateExpressContextOptions["req"];
  res: CreateExpressContextOptions["res"];
  user: User | null;
};

export async function createContext(
  opts: CreateExpressContextOptions
): Promise<TrpcContext> {
  // Authentication is disabled as per user request.
  // Returning a mock user with ID 1.
  const user: User = {
    id: 1,
    openId: "mock-user",
    name: "Usuário Padrão",
    email: "admin@example.com",
    role: "admin" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
    loginMethod: "mock",
  };

  return {
    req: opts.req,
    res: opts.res,
    user,
  };
}
