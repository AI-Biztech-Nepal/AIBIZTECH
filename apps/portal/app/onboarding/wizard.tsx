'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganization } from '../actions';
import { BUSINESS_TYPES, NEEDS, SERVICE_LABELS, TEAM_SIZES, recommend } from '@/lib/recommend';
import { FIELDS, MAX_PHOTO_BYTES, validatePhoto, type Details } from '@/lib/org-details';

const STEPS = ['Your business', 'What to manage', 'Team size', 'Suggestions', 'Organization', 'Owner', 'PAN', 'Confirm'];
const B = 4; // first step of the organization registration
const LAST = STEPS.length - 1;
const PHONE_PATTERN = '\+?[0-9][0-9 \-]{6,19}';
const blank = Object.fromEntries(FIELDS.map((f) => [f, ''])) as Details;

function Create() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Creating…' : 'Create organization'}</button>;
}

// Entries live only in this component's state, so leaving the flow (success, error redirect, reload) starts clean
export function Wizard() {
  const [step, setStep] = useState(0);
  const [v, setV] = useState<Details>(blank);
  const [photoName, setPhotoName] = useState('');
  const [type, setType] = useState('');
  const [needs, setNeeds] = useState<string[]>([]);
  const [touched, setTouched] = useState(false); // once the user picks needs themselves, a business type never overwrites them
  const [team, setTeam] = useState('');
  const form = useRef<HTMLFormElement>(null);
  const set = (f: keyof Details) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [f]: e.target.value }));
  const text = (f: keyof Details, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input name={f} value={v[f]} onChange={set(f)} autoComplete="off" maxLength={120} required {...extra} /></label>
  );

  const pickType = (id: string) => {
    setType(id);
    if (!touched) setNeeds([...(BUSINESS_TYPES.find((t) => t.id === id)?.needs ?? [])]);
  };
  const toggleNeed = (id: string) => {
    setTouched(true);
    form.current?.querySelectorAll<HTMLInputElement>('input[name=business_needs]').forEach((i) => i.setCustomValidity(''));
    setNeeds((n) => (n.includes(id) ? n.filter((x) => x !== id) : [...n, id]));
  };
  const suggested = recommend({ business_type: type, business_needs: needs, team_size: team });
  const names = suggested.map((k) => SERVICE_LABELS[k]);
  const list = names.length > 1 ? `${names.slice(0, -1).join(', ')} and ${names.at(-1)}` : names[0];

  // A step change must reach screen readers: move focus to the new step's heading
  const first = useRef(true);
  useEffect(() => {
    if (first.current) return void (first.current = false);
    form.current?.querySelectorAll('fieldset')[step]?.querySelector<HTMLElement>('legend')?.focus();
  }, [step]);

  function next() {
    const fieldset = form.current?.querySelectorAll('fieldset')[step];
    const bad = Array.from(fieldset?.querySelectorAll('input') ?? []).find((i) => !i.checkValidity());
    if (bad) return bad.reportValidity();
    setStep((s) => s + 1);
  }

  function onPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.setCustomValidity(file ? (validatePhoto(file) ?? '') : '');
    setPhotoName(file?.name ?? '');
    if (file) e.target.reportValidity();
  }

  // Enter must move forward, not submit a half-filled form
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && step < LAST && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      next();
    }
  }

  const row = (label: string, value: string) => <><dt>{label}</dt><dd>{value || '—'}</dd></>;

  return (
    <>
      <div className="steps">
        <progress max={STEPS.length} value={step + 1} aria-label="Setup progress" />
        <p aria-live="polite">Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      </div>

      <form ref={form} action={createOrganization} onKeyDown={onKeyDown}>
        <fieldset hidden={step !== 0}>
          <legend tabIndex={-1}>What does your business do?</legend>
          {BUSINESS_TYPES.map((t) => (
            <label key={t.id} className="choice">
              <input type="radio" name="business_type" value={t.id} checked={type === t.id} onChange={() => pickType(t.id)} required />
              {t.label}
            </label>
          ))}
        </fieldset>

        <fieldset hidden={step !== 1}>
          <legend tabIndex={-1}>What do you want to manage?</legend>
          <small>Pick all that apply.</small>
          {NEEDS.map((n) => (
            <label key={n.id} className="choice">
              <input type="checkbox" name="business_needs" value={n.id} checked={needs.includes(n.id)} onChange={() => toggleNeed(n.id)} required={!needs.length} onInvalid={(e) => e.currentTarget.setCustomValidity('Pick at least one option.')} />
              {n.label}
            </label>
          ))}
        </fieldset>

        <fieldset hidden={step !== 2}>
          <legend tabIndex={-1}>How big is your team?</legend>
          {TEAM_SIZES.map((t) => (
            <label key={t} className="choice">
              <input type="radio" name="team_size" value={t} checked={team === t} onChange={() => setTeam(t)} required />
              {t}
            </label>
          ))}
        </fieldset>

        <fieldset hidden={step !== 3}>
          <legend tabIndex={-1}>Our suggestion</legend>
          <p>{names.length ? `Based on your answers we suggest ${list}.` : 'Nothing specific yet. You can start any service from your dashboard.'}</p>
          <small>Nothing starts yet. Once your organization is verified, you start a free trial from the dashboard.</small>
        </fieldset>

        <fieldset hidden={step !== B}>
          <legend tabIndex={-1}>Organization details</legend>
          {text('name', 'Organization name', { autoComplete: 'organization' })}
          {text('address', 'Address')}
          {text('phone', 'Phone number', { type: 'tel', pattern: PHONE_PATTERN, title: 'Digits, optionally starting with +' })}
          {text('email', 'Email', { type: 'email' })}
        </fieldset>

        <fieldset hidden={step !== B + 1}>
          <legend tabIndex={-1}>Owner details</legend>
          {text('owner_name', 'Owner full name')}
          {text('owner_address', 'Owner address')}
          {text('owner_phone', 'Owner phone number', { type: 'tel', pattern: PHONE_PATTERN, title: 'Digits, optionally starting with +' })}
          {text('owner_email', 'Owner email', { type: 'email' })}
        </fieldset>

        <fieldset hidden={step !== B + 2}>
          <legend tabIndex={-1}>Registered PAN</legend>
          {text('pan_no', 'PAN number', { inputMode: 'numeric', pattern: '[0-9]{9}', maxLength: 9, title: 'Exactly 9 digits' })}
          <label>PAN card photo (optional)
            <input name="pan_photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} />
          </label>
          <small>JPG, PNG or WebP, up to {MAX_PHOTO_BYTES / 1024 / 1024} MB.</small>
        </fieldset>

        <fieldset hidden={step !== B + 3}>
          <legend tabIndex={-1}>Review</legend>
          <dl>
            {row('Organization', v.name)}{row('Address', v.address)}{row('Phone', v.phone)}{row('Email', v.email)}
            {row('Owner', v.owner_name)}{row('Owner address', v.owner_address)}{row('Owner phone', v.owner_phone)}{row('Owner email', v.owner_email)}
            {row('Business', BUSINESS_TYPES.find((t) => t.id === type)?.label ?? '')}{row('Team', team)}{row('Suggested', names.join(', '))}{row('PAN', v.pan_no)}{row('PAN photo', photoName)}
          </dl>
          <small>Your organization will be reviewed and verified before you can start any service.</small>
        </fieldset>

        <div className="nav">
          <button type="button" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>Back</button>
          {step < LAST ? <button type="button" onClick={next}>Next</button> : <Create />}
        </div>
      </form>
    </>
  );
}
