'use client';

import { useState } from 'react';
import s from './login.module.css';

// What the apps look like, with made-up figures: it is labelled as an example, never as anyone's real numbers
const SCREENS = [
  {
    name: 'Attendance',
    figures: [['Present today', '46 / 50', 'staff'], ['Late', '3', 'today'], ['On leave', '1', 'approved']],
    rows: [['Sample employee A', 'Office · fingerprint', '08:54'], ['Sample employee B', 'Branch · mobile', '08:58']],
  },
  {
    name: 'Finance',
    figures: [['Sales', 'Rs 8,40,000', 'this month'], ['To receive', 'Rs 1,25,000', 'from customers'], ['To give', 'Rs 60,000', 'to vendors']],
    rows: [['Sample customer', 'Payment received', 'Rs 15,000'], ['Sample vendor', 'Payment given', 'Rs 8,500']],
  },
  {
    name: 'Stock',
    figures: [['Items in stock', '320', 'now'], ['Low stock', '7', 'to reorder'], ['Sold', '42', 'this month']],
    rows: [['Sample item 1', 'Ready to sell', '24 left'], ['Sample item 2', 'Reorder soon', '3 left']],
  },
];

const APPS = [
  ['HRIS', 'hris.jpg'], ['Finance', 'finance.jpg'], ['Sales', 'sales.jpg'], ['Inventory', 'inventory.jpg'],
  ['Marketing', 'marketing.jpg'], ['Service', 'service.jpg'], ['Sanakhat', 'sanakhat.jpg'], ['AI Assistant', 'hanuman.png'],
];

export function Showcase() {
  const [shown, setShown] = useState(0);
  const screen = SCREENS[shown];
  return (
    <aside className={s.showcase} aria-label="What is inside AIBIZTECH">
      <div className={s.pitch}>
        <p className={s.tagline}>Unified operations suite</p>
        <h2>Run your entire business from <em>one intelligent hub.</em></h2>
        <p>Staff attendance, money in and out, and stock, together with one sign-in.</p>
      </div>

      <div className={s.demo}>
        <div className={s.tabs} role="group" aria-label="Choose an example">
          {SCREENS.map((x, i) => (
            <button key={x.name} type="button" aria-pressed={i === shown} onClick={() => setShown(i)}>{x.name}</button>
          ))}
        </div>
        <div className={s.window}>
          <div className={s.windowBar}>
            <span className={s.dots} aria-hidden="true"><i /><i /><i /></span>
            <span>{screen.name}</span>
            <span className={s.sample}>Example data</span>
          </div>
          <dl className={s.figures}>
            {screen.figures.map(([label, value, note]) => (
              <div key={label}><dt>{label}</dt><dd>{value}</dd><dd>{note}</dd></div>
            ))}
          </dl>
          <ul className={s.rows}>
            {screen.rows.map(([who, what, value]) => (
              <li key={who}><span><strong>{who}</strong><small>{what}</small></span><b>{value}</b></li>
            ))}
          </ul>
        </div>
      </div>

      <ul className={s.apps}>
        {APPS.map(([name, file]) => (
          // eslint-disable-next-line @next/next/no-img-element
          <li key={name}><img src={`/apps/${file}`} alt="" width={40} height={40} /><span>{name}</span></li>
        ))}
      </ul>
    </aside>
  );
}
