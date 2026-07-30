import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-4 px-6">
      <p className="text-accent text-sm font-medium tracking-widest uppercase">
        AI Restaurant Marketing
      </p>
      <h1 className="text-4xl font-semibold text-balance">Photos of your food, ready to post</h1>
      <p className="text-slate-400">
        Upload a dish and get back an Instagram caption, hashtags, and a feed-ready crop.
      </p>
      <Link
        href="/generate"
        className="bg-accent w-fit rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950"
      >
        Generate a caption
      </Link>
    </main>
  );
}
