import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';

import { HistoryEntryItem } from '@/components/content-history/history-entry-item';
import { getHistoryForCurrentUser } from '@/modules/content-history/actions';
import { auth } from '~/auth';

export const metadata: Metadata = { title: 'History' };

const PAGE_SIZE = 10;

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  // The proxy already turns anonymous visitors away; checking here is what
  // stops the page rendering if it ever stops matching this route.
  const session = await auth();
  if (!session?.user?.id) {
    redirect('/login?callbackUrl=/history');
  }

  const { page: pageParam } = await searchParams;
  const page = Math.max(1, Math.trunc(Number(pageParam)) || 1);
  const offset = (page - 1) * PAGE_SIZE;

  const result = await getHistoryForCurrentUser(PAGE_SIZE, offset);

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-16">
      <header className="flex flex-col gap-3">
        <p className="text-accent text-sm font-medium tracking-widest uppercase">History</p>
        <h1 className="text-3xl font-semibold text-balance">Everything you have generated</h1>
      </header>

      {result === null ? (
        <ProfileRequired />
      ) : result.entries.length === 0 ? (
        <p className="text-sm text-slate-400">
          {page === 1 ? 'Nothing generated yet.' : "There's nothing on this page."}
        </p>
      ) : (
        <>
          <ul className="flex flex-col">
            {result.entries.map((entry) => (
              <HistoryEntryItem key={entry.id} entry={entry} />
            ))}
          </ul>

          <Pagination page={page} pageSize={PAGE_SIZE} total={result.total} />
        </>
      )}
    </main>
  );
}

function Pagination({ page, pageSize, total }: { page: number; pageSize: number; total: number }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (totalPages <= 1) {
    return null;
  }

  return (
    <nav className="flex items-center justify-between text-sm" aria-label="History pages">
      {page > 1 ? (
        <Link
          href={`/history?page=${page - 1}`}
          className="text-accent underline-offset-4 hover:underline"
        >
          Previous
        </Link>
      ) : (
        <span />
      )}
      <span className="text-slate-500">
        Page {page} of {totalPages}
      </span>
      {page < totalPages ? (
        <Link
          href={`/history?page=${page + 1}`}
          className="text-accent underline-offset-4 hover:underline"
        >
          Next
        </Link>
      ) : (
        <span />
      )}
    </nav>
  );
}

/** Shown instead of the list, rather than redirecting - same reasoning as /generate. */
function ProfileRequired() {
  return (
    <section className="flex flex-col items-start gap-4 rounded-lg border border-amber-900/60 bg-amber-950/30 p-6">
      <h2 className="text-lg font-medium text-amber-100">Complete your Account Info first</h2>
      <p className="max-w-xl text-sm text-amber-200/80">
        There is nothing to show here until you have completed your Account Info and generated
        some content.
      </p>
      <Link
        href="/profile"
        className="bg-accent rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950"
      >
        Go to Account Info
      </Link>
    </section>
  );
}
