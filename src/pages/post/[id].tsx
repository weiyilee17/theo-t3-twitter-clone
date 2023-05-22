import type { NextPage, GetStaticProps } from "next";
import Head from "next/head";

import { api } from "~/utils/api";
import { PageLayout } from "~/components/layout";
import { PostView } from "~/components/post_view";
import { generateServerSideHelper } from "~/server/helpers/serverSideHelper";

const SinglePostPage: NextPage<{ id: string }> = ({ id }) => {
  const { data } = api.posts.getByID.useQuery({
    id,
  });

  if (!data) {
    return <div>404</div>;
  }

  return (
    <>
      <Head>
        <title>{`${data.post.content} - @${data.author.username}`}</title>
      </Head>

      <PageLayout>
        <PostView {...data} />
      </PageLayout>
    </>
  );
};

export const getStaticProps: GetStaticProps = async (context) => {
  const helpers = generateServerSideHelper();

  const id = context.params?.id;

  if (typeof id !== "string") {
    throw new Error("No id");
  }

  await helpers.posts.getByID.prefetch({ id });

  return {
    props: {
      trpcState: helpers.dehydrate(),
      id,
    },
  };
};

// getStaticPaths should come with getStaticPaths, so next knows which paths are valid
export const getStaticPaths = () => {
  return { paths: [], fallback: "blocking" };
};

export default SinglePostPage;
