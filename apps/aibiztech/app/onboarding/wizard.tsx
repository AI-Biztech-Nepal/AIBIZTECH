'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganization } from '../actions';
import { FIELDS, MAX_PHOTO_BYTES, validatePhoto, type Details } from '@/lib/org-details';

const STEPS = ['Organization', 'Owner', 'PAN', 'Confirm'];
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
  const form = useRef<HTMLFormElement>(null);
  const set = (f: keyof Details) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [f]: e.target.value }));
  const text = (f: keyof Details, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input name={f} value={v[f]} onChange={set(f)} autoComplete="off" maxLength={120} required {...extra} /></label>
  );

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
        <p>Step {step + 1} of {STEPS.length}: {STEPS[step]}</p>
      </div>

      <form ref={form} action={createOrganization} onKeyDown={onKeyDown}>
        <fieldset hidden={step !== 0}>
          <legend>Organization details</legend>
          {text('name', 'Organization name', { autoComplete: 'organization' })}
          {text('address', 'Address')}
          {text('phone', 'Phone number', { type: 'tel', pattern: PHONE_PATTERN, title: 'Digits, optionally starting with +' })}
          {text('email', 'Email', { type: 'email' })}
        </fieldset>

        <fieldset hidden={step !== 1}>
          <legend>Owner details</legend>
          {text('owner_name', 'Owner full name')}
          {text('owner_address', 'Owner address')}
          {text('owner_phone', 'Owner phone number', { type: 'tel', pattern: PHONE_PATTERN, title: 'Digits, optionally starting with +' })}
          {text('owner_email', 'Owner email', { type: 'email' })}
        </fieldset>

        <fieldset hidden={step !== 2}>
          <legend>Registered PAN</legend>
          {text('pan_no', 'PAN number', { inputMode: 'numeric', pattern: '[0-9]{9}', maxLength: 9, title: 'Exactly 9 digits' })}
          <label>PAN card photo (optional)
            <input name="pan_photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} />
          </label>
          <small>JPG, PNG or WebP, up to {MAX_PHOTO_BYTES / 1024 / 1024} MB.</small>
        </fieldset>

        <fieldset hidden={step !== 3}>
          <legend>Review</legend>
          <dl>
            {row('Organization', v.name)}{row('Address', v.address)}{row('Phone', v.phone)}{row('Email', v.email)}
            {row('Owner', v.owner_name)}{row('Owner address', v.owner_address)}{row('Owner phone', v.owner_phone)}{row('Owner email', v.owner_email)}
            {row('PAN', v.pan_no)}{row('PAN photo', photoName)}
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
