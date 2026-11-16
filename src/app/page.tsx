import { MediaFeed } from "@/components/media-feed";
export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const params = await searchParams;
  return (
    <MediaFeed
      query={typeof params.q === "string" ? params.q.slice(0, 200) : ""}
    />
  );
}
