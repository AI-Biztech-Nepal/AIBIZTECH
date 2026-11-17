'use client';

import { useRef, useState, type KeyboardEvent } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganization } from '../actions';
import { ServiceLogo } from '../icons';
import { FIELDS, MAX_PHOTO_BYTES, validatePhoto, type Details } from '@/lib/org-details';

const STEPS = ['Company', 'Apps', 'Confirm'];
const LAST = STEPS.length - 1;
const PHONE_PATTERN = '\+?[0-9][0-9 \-]{6,19}';
const blank = Object.fromEntries(FIELDS.map((f) => [f, ''])) as Details;

function Create() {
  const { pending } = useFormStatus();
  return <button disabled={pending}>{pending ? 'Creating…' : 'Create organization'}</button>;
}

// Entries live only in this component's state, so leaving the flow (success, error redirect, reload) starts clean
export function Wizard({ initial, services }: { initial: { name: string; address: string; phone: string; email: string }; services: { key: string; name: string }[] }) {
  const [step, setStep] = useState(0);
  // Organization details come from sign-up; the owner is the person who signed up, so they start prefilled
  const [v, setV] = useState<Details>({
    ...blank,
    ...initial,
    name: '', // company name is asked here; the signed-up person's name is the owner's
    owner_name: initial.name, owner_address: initial.address, owner_phone: initial.phone, owner_email: initial.email,
  });
  const [photoName, setPhotoName] = useState('');
  const [picked, setPicked] = useState<string[]>([]);
  const [pickError, setPickError] = useState('');
  const toggle = (k: string) => setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  const form = useRef<HTMLFormElement>(null);
  const set = (f: keyof Details) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [f]: e.target.value }));
  const text = (f: keyof Details, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <label>{label}<input name={f} value={v[f]} onChange={set(f)} autoComplete="off" maxLength={120} required {...extra} /></label>
  );

  function next() {
    if (step === 1) {
      if (!picked.length) return setPickError('Tick at least one app to continue.');
      setPickError('');
      return setStep(2);
    }
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
        {/* Everything about the owner comes from sign-up, so it is sent along without asking again */}
        {(['address', 'phone', 'email', 'owner_name', 'owner_address', 'owner_phone', 'owner_email'] as const).map((f) => <input key={f} type="hidden" name={f} value={v[f]} />)}

        <fieldset hidden={step !== 0}>
          <legend>Company details</legend>
          {text('name', 'Company name', { autoComplete: 'organization', placeholder: 'Your company or business name' })}
          {text('pan_no', 'PAN number', { inputMode: 'numeric', pattern: '[0-9]{9}', maxLength: 9, title: 'Exactly 9 digits' })}
          <label>PAN card photo (optional)
            <input name="pan_photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} />
          </label>
          <small>JPG, PNG or WebP, up to {MAX_PHOTO_BYTES / 1024 / 1024} MB.</small>
        </fieldset>

        <fieldset hidden={step !== 1}>
          <legend>Which apps do you need?</legend>
          <small>Tick the ones you want. Each starts with a free 15-day trial, and you can add more later.</small>
          <div className="app-picker">
            {services.map((s) => (
              <label key={s.key} className={`pick${picked.includes(s.key) ? ' on' : ''}`}>
                <input type="checkbox" name="apps" value={s.key} checked={picked.includes(s.key)} onChange={() => toggle(s.key)} />
                <ServiceLogo svc={s} />
                <span>{s.name}</span>
              </label>
            ))}
          </div>
          {pickError && <p role="alert" className="error">{pickError}</p>}
        </fieldset>

        <fieldset hidden={step !== 2}>
          <legend>Review</legend>
          <dl>
            {row('Company', v.name)}{row('Apps', services.filter((s) => picked.includes(s.key)).map((s) => s.name).join(', '))}
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
