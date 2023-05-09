import { User, clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { createTRPCRouter, publicProcedure } from "~/server/api/trpc";

// A procedure is a method generate function that your client calls
// A publicProcedure is a procedure that anyone can call

const filterUserForClient = (user: User) => {
  return {
    id: user.id,
    username: user.username,
    profileImageUrl: user.profileImageUrl,
  };
};

export const postsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.prisma.post.findMany({
      take: 100,
    });

    const allUsers = (
      await clerkClient.users.getUserList({
        userId: posts.map((post) => post.authorID),
        limit: 100,
      })
    ).map(filterUserForClient);

    return posts.map((post) => {
      const author = allUsers.find((user) => user.id === post.authorID);

      if (!author || !author.username) {
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Author for post not found",
        });
      }

      return {
        post,
        // This is to prevent ESLint from complaining
        author: {
          ...author,
          username: author.username,
        },
      };
    });
  }),
});
