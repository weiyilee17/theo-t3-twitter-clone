import { clerkClient } from "@clerk/nextjs/server";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { Post } from "@prisma/client";

import {
  createTRPCRouter,
  privateProcedure,
  publicProcedure,
} from "~/server/api/trpc";

// A procedure is a method generate function that your client calls
// A publicProcedure is a procedure that anyone can call

import { filterUserForClient } from "~/server/helpers/filterUserForClient";

const addUserDataToPosts = async (posts: Post[]) => {
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
};

// Create a new ratelimiter, that allows 3 requests per 1 minute
const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(3, "1 m"),
  analytics: true,
});

export const postsRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const posts = await ctx.prisma.post.findMany({
      take: 100,
      orderBy: [{ createdAt: "desc" }],
    });

    return addUserDataToPosts(posts);
  }),
  getByID: publicProcedure
    .input(z.object({ id: z.string() }))
    .query(async ({ ctx, input }) => {
      const post = await ctx.prisma.post.findUnique({
        where: { id: input.id },
      });

      if (!post) {
        throw new TRPCError({ code: "NOT_FOUND" });
      }

      return (await addUserDataToPosts([post]))[0];
    }),
  getPostByUserID: publicProcedure
    .input(
      z.object({
        userID: z.string(),
      })
    )
    .query(({ ctx, input }) =>
      ctx.prisma.post
        .findMany({
          where: {
            authorID: input.userID,
          },
          take: 100,
          orderBy: [{ createdAt: "desc" }],
        })
        .then(addUserDataToPosts)
    ),
  create: privateProcedure
    .input(
      z.object({
        content: z.string().emoji("Only emojis are allowed.").min(1).max(255),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const authorID = ctx.userId;

      const { success } = await ratelimit.limit(authorID);

      if (!success) {
        throw new TRPCError({
          code: "TOO_MANY_REQUESTS",
        });
      }

      const post = await ctx.prisma.post.create({
        data: {
          authorID,
          content: input.content,
        },
      });

      return post;
    }),
});
