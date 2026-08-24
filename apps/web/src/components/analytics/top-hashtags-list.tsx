import type { TopHashtag } from '@/modules/analytics/types';

type TopHashtagsListProps = {
  hashtags: TopHashtag[];
};

export function TopHashtagsList({ hashtags }: TopHashtagsListProps) {
  if (hashtags.length === 0) {
    return <p className="empty-state-text">No hashtags used yet.</p>;
  }

  return (
    <ol className="flex flex-col divide-y divide-slate-800">
      {hashtags.map((entry, index) => (
        <li key={entry.hashtag} className="flex items-center justify-between gap-4 py-3">
          <span className="flex items-center gap-3">
            <span className="w-5 shrink-0 text-sm font-medium text-slate-500">{index + 1}</span>
            <span className="font-medium text-slate-100">#{entry.hashtag}</span>
          </span>
          <span className="text-sm text-slate-400">{entry.count}</span>
        </li>
      ))}
    </ol>
  );
}
