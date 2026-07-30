'use client';

import { useActionState } from 'react';

import { SelectField, TextAreaField, TextField } from '@/components/ui/form-field';
import { TONE_OF_VOICE_VALUES, WEEKDAYS, type DayOpeningHours, type Weekday } from '@/db/schema';
import { upsertProfileAction } from '@/modules/restaurant-profile/actions';
import type { RestaurantProfile, WeeklyOpeningHours } from '@/modules/restaurant-profile/types';

export function ProfileForm({ profile }: { profile: RestaurantProfile | null }) {
  const [state, formAction, isPending] = useActionState(upsertProfileAction, { status: 'idle' });

  return (
    <form action={formAction} className="flex flex-col gap-10">
      <Section
        title="The basics"
        description="Everything here is needed before we can write for you."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Restaurant name" name="name" required defaultValue={profile?.name} />
          <TextField
            label="Cuisine type"
            name="cuisineType"
            required
            defaultValue={profile?.cuisineType}
            placeholder="Neapolitan pizza"
          />
          <TextField label="Address" name="address" required defaultValue={profile?.address} />
          <TextField
            label="Country"
            name="country"
            required
            defaultValue={profile?.country}
            placeholder="Bosnia and Herzegovina"
          />
          <TextField
            label="Language"
            name="language"
            required
            defaultValue={profile?.language}
            hint="The language posts should be written in."
            placeholder="Bosnian"
          />
          <SelectField
            label="Tone of voice"
            name="toneOfVoice"
            required
            options={TONE_OF_VOICE_VALUES}
            defaultValue={profile?.toneOfVoice ?? 'friendly'}
          />
        </div>
      </Section>

      <Section
        title="How you present"
        description="Optional, but it is what makes the captions sound like you."
      >
        <div className="flex flex-col gap-4">
          <TextAreaField
            label="Description"
            name="description"
            defaultValue={profile?.description ?? ''}
            rows={4}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Logo URL"
              name="logoUrl"
              type="url"
              defaultValue={profile?.logoUrl ?? ''}
            />
            <TextField
              label="Brand colours"
              name="brandColors"
              defaultValue={profile?.brandColors?.join(', ') ?? ''}
              hint="Hex codes separated by commas, for example #ff6b35, #0b0f14."
            />
          </div>
          <TextAreaField
            label="Target audience"
            name="targetAudience"
            defaultValue={profile?.targetAudience ?? ''}
            rows={2}
          />
        </div>
      </Section>

      <Section
        title="Opening hours"
        description="Leave a day blank if you would rather fill it in later."
      >
        <OpeningHours hours={profile?.openingHours ?? null} />
      </Section>

      <Section
        title="Contact and social"
        description="Used to sign off posts and link back to you."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Website"
            name="website"
            type="url"
            defaultValue={profile?.website ?? ''}
          />
          <TextField label="Phone" name="phone" type="tel" defaultValue={profile?.phone ?? ''} />
          <TextField
            label="Contact email"
            name="email"
            type="email"
            defaultValue={profile?.email ?? ''}
          />
          <TextField
            label="Instagram"
            name="instagramHandle"
            defaultValue={profile?.instagramHandle ?? ''}
            placeholder="@yourrestaurant"
          />
          <TextField
            label="Facebook"
            name="facebookHandle"
            defaultValue={profile?.facebookHandle ?? ''}
          />
          <TextField
            label="TikTok"
            name="tiktokHandle"
            defaultValue={profile?.tiktokHandle ?? ''}
            placeholder="@yourrestaurant"
          />
        </div>
      </Section>

      <div className="flex items-center gap-4">
        <button
          type="submit"
          disabled={isPending}
          className="bg-accent w-fit rounded-lg px-5 py-2.5 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {isPending ? 'Saving…' : 'Save profile'}
        </button>

        {state.status === 'saved' && (
          <p role="status" className="text-sm text-emerald-300">
            Profile saved.
          </p>
        )}
        {state.status === 'error' && (
          <p role="alert" className="text-sm text-rose-400">
            {state.message}
          </p>
        )}
      </div>
    </form>
  );
}

function OpeningHours({ hours }: { hours: WeeklyOpeningHours | null }) {
  return (
    <ul className="flex flex-col gap-3">
      {WEEKDAYS.map((weekday) => (
        <DayRow key={weekday} weekday={weekday} value={hours?.[weekday] ?? null} />
      ))}
    </ul>
  );
}

function DayRow({ weekday, value }: { weekday: Weekday; value: DayOpeningHours | null }) {
  const isClosed = value?.closed === true;
  const opens = value !== null && !value.closed ? value.opens : '';
  const closes = value !== null && !value.closed ? value.closes : '';

  return (
    <li className="grid grid-cols-[7rem_1fr_1fr_auto] items-center gap-3">
      <span className="text-sm text-slate-300 capitalize">{weekday}</span>
      <input
        type="time"
        name={`openingHours.${weekday}.opens`}
        defaultValue={opens}
        aria-label={`${weekday} opening time`}
        className="bg-surface-muted rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
      />
      <input
        type="time"
        name={`openingHours.${weekday}.closes`}
        defaultValue={closes}
        aria-label={`${weekday} closing time`}
        className="bg-surface-muted rounded-lg border border-slate-700 px-3 py-2 text-sm text-slate-100"
      />
      <label className="flex items-center gap-2 text-sm text-slate-400">
        <input
          type="checkbox"
          name={`openingHours.${weekday}.closed`}
          defaultChecked={isClosed}
          className="accent-accent"
        />
        Closed
      </label>
    </li>
  );
}

function Section({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <h2 className="text-lg font-medium text-slate-100">{title}</h2>
        <p className="text-sm text-slate-500">{description}</p>
      </div>
      {children}
    </section>
  );
}
