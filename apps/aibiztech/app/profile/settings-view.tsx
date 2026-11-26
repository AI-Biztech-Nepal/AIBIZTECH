import 'lenis/dist/lenis.css';
import { Fragment } from 'react';
import { ReactLenis } from 'lenis/react';
import { roleName } from '@/lib/business';
import type { Org } from '@/lib/supabase';
import a from '../account.module.css';
import { updateProfile } from '../actions';
import { Notices } from '../dashboard-view';
import page from '../dashboard.module.css';
import s from '../plans/plans.module.css';

type Props = {
  name: string;
  email: string;
  phone: string;
  org: Org | null;
  services: { key: string; name: string }[];
  error?: string;
  message?: string;
  preview?: boolean; // look only: nothing is saved
};

export function SettingsView({ name, email, phone, org, services, error, message, preview = false }: Props) {
  return (
    <div className={`${page.page} ${a.page}`}>
      <ReactLenis root options={{ anchors: true }} />
      <div className={page.head}>
        <div>
          <h1>Settings</h1>
          <p className={page.sub}>Your profile and what you have access to.</p>
        </div>
      </div>

      <Notices error={error} message={message} />

      <div className={a.sheet}>
        <section className={a.section} aria-labelledby="profile-title">
          <div className={a.about}>
            <h2 id="profile-title">Your profile</h2>
            <p>The name and phone number kept for your account.</p>
          </div>
          <div className={a.body}>
            <form action={preview ? undefined : updateProfile} className={a.form}>
              <div className={a.fields}>
                <label>Full name<input name="full_name" defaultValue={name} maxLength={120} autoComplete="off" required /></label>
                <label>Phone<input name="phone" type="tel" defaultValue={phone} pattern="\+?[0-9][0-9 \-]{6,19}" title="Digits, optionally starting with +" autoComplete="off" /></label>
              </div>
              <button type={preview ? 'button' : 'submit'} className={`${s.button} ${s.primary}`}>Save profile</button>
            </form>
          </div>
        </section>

        <section className={a.section} aria-labelledby="account-title">
          <div className={a.about}>
            <h2 id="account-title">Account</h2>
            <p>{org ? 'An owner or admin can change your roles.' : 'You are not part of a business yet.'}</p>
          </div>
          <div className={a.body}>
            <dl className={a.facts}>
              <dt>Email</dt><dd>{email || '—'}</dd>
              {org && <><dt>Business</dt><dd>{org.name}</dd><dt>Your role</dt><dd>{roleName(org.org_role)}</dd></>}
              {org && services.filter((svc) => org.services[svc.key]).map((svc) => (
                <Fragment key={svc.key}><dt>{svc.name} role</dt><dd>{roleName(org.services[svc.key])}</dd></Fragment>
              ))}
            </dl>
          </div>
        </section>
      </div>
    </div>
  );
}
