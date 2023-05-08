import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// A procedure is a method generate function that your client calls
// A publicProcedure is a procedure that anyone can call

export const postsRouter = createTRPCRouter({
  getAll: publicProcedure.query(({ ctx }) => {
    return ctx.prisma.post.findMany();
  }),
});
