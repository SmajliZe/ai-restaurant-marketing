'use client';

import { useState, useTransition } from 'react';

import {
  PanelHeading,
  StoryPanel,
  TextWithHashtagsPanel,
} from '@/components/content-generation/generated-content-result';
import { updateCampaignStatus } from '@/modules/content-campaign/actions';
import type { Campaign, CampaignStatus } from '@/modules/content-campaign/types';

const STATUSES: CampaignStatus[] = ['draft', 'active', 'completed'];

const STATUS_LABELS: Record<CampaignStatus, string> = {
  draft: 'Draft',
  active: 'Active',
  completed: 'Completed',
};

type CampaignItemProps = {
  campaign: Campaign;
  /** Lets the list update optimistically without re-fetching every campaign. */
  onStatusChange: (campaignId: string, status: CampaignStatus) => void;
};

/**
 * One row of the campaign list: name, occasion and a status control,
 * collapsed by default. Expanding it shows the full package - description,
 * offer, caption, hashtags, story and call to action - reusing
 * `TextWithHashtagsPanel` and `StoryPanel` from generated-content-result.tsx
 * for the caption and story, since a campaign's caption and story are the
 * same shape a fresh generation's are; there is no second copy of that
 * rendering here.
 */
export function CampaignItem({ campaign, onStatusChange }: CampaignItemProps) {
  const [expanded, setExpanded] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleStatusChange(status: CampaignStatus) {
    // Optimistic, the same way the calendar's completed checkbox is: the
    // control updates immediately, and the request that makes it durable
    // happens in the background. If the campaign turns out not to be the
    // caller's own, the server quietly no-ops and the next full load shows
    // the real state.
    onStatusChange(campaign.id, status);
    startTransition(async () => {
      await updateCampaignStatus(campaign.id, status);
    });
  }

  return (
    <li
      id={campaign.id}
      className="flex flex-col gap-4 border-b border-slate-800 py-4 last:border-b-0"
    >
      <div className="flex items-center gap-4">
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="flex flex-1 items-center gap-4 text-left"
          aria-expanded={expanded}
        >
          <div className="flex flex-1 flex-col">
            <span className="font-medium text-slate-100">{campaign.name}</span>
            <span className="text-xs text-slate-500">
              {campaign.occasion} · {formatDate(campaign.createdAt)}
            </span>
          </div>
        </button>

        <select
          value={campaign.status}
          onChange={(event) => handleStatusChange(event.target.value as CampaignStatus)}
          disabled={isPending}
          aria-label={`Status for ${campaign.name}`}
          className="bg-surface-muted rounded-md px-2 py-1 text-xs text-slate-300 disabled:opacity-50"
        >
          {STATUSES.map((status) => (
            <option key={status} value={status}>
              {STATUS_LABELS[status]}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          className="text-accent shrink-0 text-sm"
        >
          {expanded ? 'Hide' : 'View'}
        </button>
      </div>

      {expanded && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-300">{campaign.description}</p>

          <div className="flex flex-col gap-1">
            <PanelHeading>Offer</PanelHeading>
            <p className="text-slate-300">{campaign.offer}</p>
          </div>

          <div className="flex flex-col gap-2">
            <PanelHeading>Caption</PanelHeading>
            <TextWithHashtagsPanel text={campaign.caption} hashtags={campaign.hashtags} />
          </div>

          <div className="flex flex-col gap-2">
            <PanelHeading>Story</PanelHeading>
            <StoryPanel story={campaign.story} />
          </div>

          <div className="flex flex-col gap-1">
            <PanelHeading>Call to action</PanelHeading>
            <p className="text-slate-300">{campaign.cta}</p>
          </div>

          <div className="flex flex-col gap-1">
            <PanelHeading>Suggested duration</PanelHeading>
            <p className="text-slate-300">{campaign.durationSuggestion}</p>
          </div>
        </div>
      )}
    </li>
  );
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(date);
}
