import { initTRPC } from "@trpc/server";
import superjson from "superjson";
import type { TrpcContext } from "./context";

const t = initTRPC.context<TrpcContext>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

const bypassAuth = t.middleware(async opts => {
  const { ctx, next } = opts;

  // We ensure context has the mock user from createContext
  return next({
    ctx: {
      ...ctx,
      user: ctx.user!,
    },
  });
});

export const protectedProcedure = t.procedure.use(bypassAuth);

export const adminProcedure = t.procedure.use(bypassAuth);
