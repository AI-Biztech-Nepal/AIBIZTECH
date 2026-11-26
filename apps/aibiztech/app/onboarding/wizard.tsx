'use client';

import { useRef, useState, type ChangeEvent, type FormEvent, type InputHTMLAttributes, type KeyboardEvent, type ReactNode } from 'react';
import { useFormStatus } from 'react-dom';
import { createOrganization } from '../actions';
import { ServiceLogo } from '../icons';
import { FIELDS, MAX_PHOTO_BYTES, PAN, validatePhoto, type Details } from '@/lib/org-details';
import { TRIAL_DAYS } from '@/lib/signup';
import s from './onboarding.module.css';

const STEPS = ['Business details', 'Apps', 'Review'];
const LAST = STEPS.length - 1;
const blank = Object.fromEntries(FIELDS.map((f) => [f, ''])) as Details;

function Create() {
  const { pending } = useFormStatus();
  return <button className={s.primary} disabled={pending}>{pending ? 'Creating…' : 'Create workspace'}</button>;
}

type Props = {
  initial: { name: string; address: string; phone: string; email: string; business: string };
  services: { key: string; name: string }[];
  another?: boolean; // this person already has a business
  error?: string;
  preview?: boolean; // look only: nothing is sent to the server
};

// Entries live only in this component's state, so leaving the flow (success, error redirect, reload) starts clean
export function Wizard({ initial, services, another = false, error, preview = false }: Props) {
  const [step, setStep] = useState(0);
  // Organization details come from sign-up; the owner is the person who signed up, so they start prefilled
  const { business, ...me } = initial;
  const [v, setV] = useState<Details>({
    ...blank,
    ...me,
    name: business, // the signed-up person's own name is the owner's
    owner_name: me.name, owner_address: me.address, owner_phone: me.phone, owner_email: me.email,
  });
  // Accounts that gave no personal address use the business address for the owner
  const ownerAddress = v.owner_address || v.address;
  const [tried, setTried] = useState(false);
  const [photo, setPhoto] = useState({ name: '', problem: '' });
  const [picked, setPicked] = useState<string[]>([]);
  const [pickError, setPickError] = useState('');
  const [note, setNote] = useState('');
  const toggle = (k: string) => {
    setPickError('');
    setPicked((p) => (p.includes(k) ? p.filter((x) => x !== k) : [...p, k]));
  };
  const form = useRef<HTMLFormElement>(null);
  const set = (f: keyof Details) => (e: { target: { value: string } }) => setV((p) => ({ ...p, [f]: e.target.value }));

  // What stops the first step, in the order the fields appear
  const problems = {
    name: v.name.trim() ? '' : 'Enter your business name.',
    address: v.address.trim() ? '' : 'Enter the business address.',
    pan_no: PAN.test(v.pan_no) ? '' : 'PAN must be exactly 9 digits.',
    pan_photo: photo.problem,
  };

  function next() {
    if (step === 0) {
      setTried(true);
      const first = Object.entries(problems).find(([, problem]) => problem)?.[0];
      if (first) return (form.current?.elements.namedItem(first) as HTMLInputElement).focus();
    }
    if (step === 1) {
      if (!picked.length) return setPickError('Tick at least one app to continue.');
      setPickError('');
    }
    setStep(step + 1);
  }

  function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    setPhoto({ name: file?.name ?? '', problem: (file && validatePhoto(file)) || '' });
  }

  // Enter must move forward, not submit a half-filled form
  function onKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && step < LAST && (e.target as HTMLElement).tagName === 'INPUT') {
      e.preventDefault();
      next();
    }
  }

  function stay(e: FormEvent) {
    e.preventDefault();
    setNote('Preview only: nothing was saved.');
  }

  const field = (f: 'name' | 'address' | 'pan_no', label: string, extra: InputHTMLAttributes<HTMLInputElement>, hint?: ReactNode) => {
    const wrong = tried ? problems[f] : '';
    return (
      <div className={s.field}>
        <label htmlFor={f}>{label}</label>
        <input id={f} name={f} value={v[f]} onChange={set(f)} autoComplete="off" maxLength={120} required aria-invalid={!!wrong} aria-describedby={wrong ? `${f}-error` : undefined} {...extra} />
        {wrong ? <span id={`${f}-error`} className={s.problem} role="alert">{wrong}</span> : hint}
      </div>
    );
  };

  const left = 9 - v.pan_no.length;
  const panHint = PAN.test(v.pan_no)
    ? <span className={s.good}>✓ Looks right</span>
    : <span className={s.hint}>{v.pan_no ? `${left} more digit${left === 1 ? '' : 's'}` : 'Required to create the business.'}</span>;

  const [title, sub] = [
    another
      ? ['Add another business', 'Each business is its own organization with its own apps, team and PAN.']
      : ['Welcome to your business workspace.', 'Let’s get your business organized. Set up your workspace in just a few steps.'],
    ['Which apps do you need?', `Tick the ones you want. Each starts with a free ${TRIAL_DAYS}-day trial, and you can add more later.`],
    ['Check and create', 'Make sure these details are right.'],
  ][step];

  const row = (label: string, value: string) => <><dt>{label}</dt><dd>{value || '—'}</dd></>;

  return (
    <div className={s.layout}>
      <nav className={s.steps} aria-label="Setup steps">
        <ol>
          {STEPS.map((label, i) => (
            <li key={label} className={i < step ? s.done : undefined}>
              <button type="button" disabled={i > step} aria-current={i === step ? 'step' : undefined} onClick={() => setStep(i)}>
                <span className={s.dot} aria-hidden="true">{i < step ? '✓' : i + 1}</span>{label}
              </button>
            </li>
          ))}
        </ol>
      </nav>

      <div className={s.content}>
        {error && <p className={s.banner} role="alert">{error}</p>}
        <div className={s.heading}>
          <h1>{title}</h1>
          <p className={s.sub}>{sub}</p>
        </div>

        <form ref={form} className={s.form} noValidate action={preview ? undefined : createOrganization} onSubmit={preview ? stay : undefined} onKeyDown={onKeyDown}>
          {/* Everything about the owner comes from sign-up, so it is sent along without asking again */}
          {(['phone', 'email', 'owner_name', 'owner_phone', 'owner_email'] as const).map((f) => <input key={f} type="hidden" name={f} value={v[f]} />)}
          <input type="hidden" name="owner_address" value={ownerAddress} />

          <section className={s.card} hidden={step !== 0} aria-labelledby="business-title">
            <h2 id="business-title">Business details</h2>
            <div className={`${s.body} ${s.grid}`}>
              {field('name', 'Business name', { autoComplete: 'organization', placeholder: 'Your company or business name' })}
              {field('address', 'Business address', { autoComplete: 'street-address', maxLength: 200 })}
              {field('pan_no', 'PAN number', { inputMode: 'numeric', maxLength: 9, placeholder: '9 digits', onChange: (e) => setV((p) => ({ ...p, pan_no: e.target.value.replace(/\D/g, '').slice(0, 9) })) }, panHint)}
              <div className={s.field}>
                <label htmlFor="pan_photo">PAN card photo <span>(optional)</span></label>
                <input id="pan_photo" name="pan_photo" type="file" accept="image/jpeg,image/png,image/webp" onChange={onPhoto} aria-invalid={!!photo.problem} />
                {photo.problem
                  ? <span className={s.problem} role="alert">{photo.problem}</span>
                  : <span className={s.hint}>JPG, PNG or WebP, up to {MAX_PHOTO_BYTES / 1024 / 1024} MB.</span>}
              </div>
            </div>
          </section>

          <section className={s.card} hidden={step !== 1} aria-labelledby="apps-title">
            <h2 id="apps-title">Apps</h2>
            <div className={s.body}>
              <div className="app-picker">
                {services.map((svc) => (
                  <label key={svc.key} className={`pick${picked.includes(svc.key) ? ' on' : ''}`}>
                    <input type="checkbox" name="apps" value={svc.key} checked={picked.includes(svc.key)} onChange={() => toggle(svc.key)} />
                    <ServiceLogo svc={svc} />
                    <span>{svc.name}</span>
                  </label>
                ))}
              </div>
              {pickError && <p role="alert" className={s.problem}>{pickError}</p>}
            </div>
          </section>

          <section className={s.card} hidden={step !== 2} aria-labelledby="review-title">
            <h2 id="review-title">Review</h2>
            <div className={s.body}>
              <dl>
                {row('Business', v.name)}{row('Business address', v.address)}{row('Apps', services.filter((svc) => picked.includes(svc.key)).map((svc) => svc.name).join(', '))}
                {row('Owner', v.owner_name)}{row('Owner address', ownerAddress)}{row('Owner phone', v.owner_phone)}{row('Owner email', v.owner_email)}
                {row('PAN', v.pan_no)}{row('PAN photo', photo.name)}
              </dl>
            </div>
          </section>

          <div className={s.nav}>
            <button type="button" className={s.back} disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < LAST ? <button type="button" className={s.primary} onClick={next}>Continue</button> : <Create />}
          </div>
        </form>
        {note && <p className={s.note} role="status">{note}</p>}
      </div>
    </div>
  );
}
