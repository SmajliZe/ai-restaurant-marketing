'use client';

import { useState, useTransition } from 'react';

import { CampaignItem } from '@/components/content-campaign/campaign-item';
import { generateCampaign } from '@/modules/content-campaign/actions';
import type { Campaign, CampaignStatus } from '@/modules/content-campaign/types';

const OCCASION_OPTIONS = [
  'Weekend Promotion',
  'Happy Hour',
  'Pizza Day',
  'Holiday Campaign',
  'Local Event',
] as const;

const CUSTOM_OPTION = 'Custom occasion';

type CampaignsPanelProps = {
  /** What the page found on load. */
  initialCampaigns: Campaign[];
};

export function CampaignsPanel({ initialCampaigns }: CampaignsPanelProps) {
  const [campaigns, setCampaigns] = useState(initialCampaigns);
  const [selected, setSelected] = useState<string>(OCCASION_OPTIONS[0]);
  const [customOccasion, setCustomOccasion] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const isCustom = selected === CUSTOM_OPTION;
  const occasion = isCustom ? customOccasion.trim() : selected;

  function handleGenerate() {
    if (occasion === '') {
      setMessage('Enter an occasion to build a campaign for.');
      return;
    }

    setMessage(null);
    startTransition(async () => {
      const result = await generateCampaign(occasion);
      if (result.status === 'rejected') {
        setMessage(result.message);
        return;
      }
      setCampaigns((current) => [result.campaign, ...current]);
      if (isCustom) {
        setCustomOccasion('');
      }
    });
  }

  function handleStatusChange(campaignId: string, status: CampaignStatus) {
    setCampaigns((current) =>
      current.map((campaign) => (campaign.id === campaignId ? { ...campaign, status } : campaign)),
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="occasion"
            className="text-xs font-medium tracking-widest text-slate-500 uppercase"
          >
            Occasion
          </label>
          <select
            id="occasion"
            value={selected}
            onChange={(event) => setSelected(event.target.value)}
            className="bg-surface-muted rounded-lg px-3 py-2 text-sm text-slate-100"
          >
            {OCCASION_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
            <option value={CUSTOM_OPTION}>{CUSTOM_OPTION}</option>
          </select>
        </div>

        {isCustom && (
          <div className="flex flex-col gap-1">
            <label
              htmlFor="custom-occasion"
              className="text-xs font-medium tracking-widest text-slate-500 uppercase"
            >
              Describe the occasion
            </label>
            <input
              id="custom-occasion"
              type="text"
              value={customOccasion}
              onChange={(event) => setCustomOccasion(event.target.value)}
              placeholder="e.g. Local team's championship win"
              className="bg-surface-muted rounded-lg px-3 py-2 text-sm text-slate-100"
            />
          </div>
        )}

        <button
          type="button"
          onClick={handleGenerate}
          disabled={isPending}
          className="bg-accent w-fit rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950 transition-opacity disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isPending ? 'Working…' : 'Generate campaign'}
        </button>
      </div>

      {message !== null && (
        <p
          role="alert"
          className="rounded-lg border border-rose-900/60 bg-rose-950/30 p-4 text-sm text-rose-200"
        >
          {message}
        </p>
      )}

      {campaigns.length === 0 ? (
        <p className="text-sm text-slate-400">
          No campaigns yet. Pick an occasion above and generate the first one.
        </p>
      ) : (
        <ul className="flex flex-col">
          {campaigns.map((campaign) => (
            <CampaignItem
              key={campaign.id}
              campaign={campaign}
              onStatusChange={handleStatusChange}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
