import { SignInButton, useUser } from "@clerk/nextjs";
import { type NextPage } from "next";

import { api } from "~/utils/api";
import type { RouterOutputs } from "~/utils/api";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import Image from "next/image";
import { LoadingPage, LoadingSpinner } from "~/components/loading";
import { useState } from "react";
import toast from "react-hot-toast";
import Link from "next/link";
import { PageLayout } from "~/components/layout";

dayjs.extend(relativeTime);

const CreatePostWizard = () => {
  const { user } = useUser();

  const [input, setInput] = useState("");

  const ctx = api.useContext();

  const { mutate, isLoading: isPosting } = api.posts.create.useMutation({
    onSuccess: () => {
      setInput("");
      // void makes typescript not have to await a promise
      void ctx.posts.getAll.invalidate();
    },
    onError: (e) => {
      const errorMessage = e.data?.zodError?.fieldErrors.content;
      if (errorMessage && errorMessage[0]) {
        toast.error(errorMessage[0]);
      } else {
        toast.error("Failed to post! Please try again later.");
      }
    },
  });

  if (!user) {
    return null;
  }

  return (
    <div className="flex w-full gap-3">
      <Image
        className="h-14 w-14 rounded-full"
        src={user.profileImageUrl}
        alt="Profile image"
        width={56}
        height={56}
      />
      <input
        className="grow bg-transparent outline-none"
        type="text"
        placeholder="Type some emojis!"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();

            if (input) {
              mutate({ content: input });
            }
          }
        }}
        disabled={isPosting}
      />
      {!isPosting ? (
        <button onClick={() => mutate({ content: input })}>Post</button>
      ) : (
        <div className="flex items-center justify-center">
          <LoadingSpinner size={20} />
        </div>
      )}
    </div>
  );
};

// Gets the type from tRPC. [number] is changing the array to a single element
type PostWithUser = RouterOutputs["posts"]["getAll"][number];

const PostView = (props: PostWithUser) => {
  const { post, author } = props;

  return (
    <div key={post.id} className="flex gap-3 border-b border-slate-400 p-4">
      <Image
        className="h-14 w-14 rounded-full"
        src={author.profileImageUrl}
        alt={`@${author.username}'s profile picture`}
        width={56}
        height={56}
      />
      <div className="flex flex-col">
        <div className="flex gap-2 text-slate-300">
          <Link href={`/@${author.username}`}>
            <span>{`@${author.username}`}</span>
          </Link>
          <Link href={`/post/${post.id}`}>
            <span>{` . ${dayjs(post.createdAt).fromNow()}`}</span>
          </Link>
        </div>
        <span className="text-2xl">{post.content}</span>
      </div>
    </div>
  );
};

const Feed = () => {
  const { data, isLoading: postsLoading } = api.posts.getAll.useQuery();

  if (postsLoading) {
    return <LoadingPage />;
  }

  if (!data) {
    return <div>Something went wrong</div>;
  }

  return (
    <div className="flex flex-col">
      {data?.map((fullPost) => (
        <PostView {...fullPost} key={fullPost.post.id} />
      ))}
    </div>
  );
};

const Home: NextPage = () => {
  // React Query fetches data and uses its cache when the data doesn't change. Here we make the request early so in the future we can use the cache directly
  api.posts.getAll.useQuery();

  const { isLoaded: userLoaded, isSignedIn } = useUser();

  // Return empty div if both aren't loaded, since user tends to load faster
  if (!userLoaded) {
    return <div />;
  }

  return (
    <>
      <PageLayout>
        {/* Figure out why <SignIn /> doesn't work */}
        <div className="border-b border-slate-400 p-4">
          {isSignedIn ? (
            <CreatePostWizard />
          ) : (
            <div className="flex justify-center">
              <SignInButton />
            </div>
          )}
        </div>

        <Feed />
      </PageLayout>
    </>
  );
};

export default Home;
