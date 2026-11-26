'use client';

import { useState } from 'react';
import { npr } from '@/lib/books';
import { niceMax, shortAmount } from '@/lib/chart';
import s from './dashboard.module.css';

type Series = { name: string; values: number[] };

// Two money series over the same months: bars for amounts that happen in a month, lines for balances.
// Point at, tap or tab to a month to read it; the table shows every figure.
export function MonthChart({ months, a, b, kind }: { months: string[]; a: Series; b: Series; kind: 'bars' | 'lines' }) {
  const [at, setAt] = useState(months.length - 1);
  const [table, setTable] = useState(false);
  const max = niceMax([...a.values, ...b.values]);
  const high = (v: number) => (Math.max(v, 0) / max) * 100;
  const points = (values: number[]) => values.map((v, i) => `${((i + 0.5) / months.length) * 100},${100 - high(v)}`).join(' ');

  return (
    <div className={s.chart}>
      <div className={s.chartTop}>
        <div className={s.legend}>
          <span><i className={s.a} />{a.name}</span>
          <span><i className={s.b} />{b.name}</span>
        </div>
        <button type="button" className={s.quiet} onClick={() => setTable(!table)}>{table ? 'Show chart' : 'Show as table'}</button>
      </div>

      {table ? (
        <div className={s.scroll}>
          <table className={s.table}>
            <thead><tr><th scope="col">Month</th><th scope="col">{a.name}</th><th scope="col">{b.name}</th></tr></thead>
            <tbody>{months.map((m, i) => <tr key={i}><th scope="row">{m}</th><td>{npr(a.values[i])}</td><td>{npr(b.values[i])}</td></tr>)}</tbody>
          </table>
        </div>
      ) : (
        <>
          <p className={s.readout} role="status"><strong>{months[at]}</strong> {a.name} {npr(a.values[at])} · {b.name} {npr(b.values[at])}</p>
          <div className={s.plot}>
            {[0, 0.5, 1].map((f) => <span key={f} className={s.grid} style={{ bottom: `${f * 100}%` }}><em>{shortAmount(f * max)}</em></span>)}
            {kind === 'lines' && (
              <svg className={s.lines} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
                <polyline className={s.lineB} points={points(b.values)} />
                <polyline className={s.lineA} points={points(a.values)} />
              </svg>
            )}
            <div className={s.columns}>
              {months.map((m, i) => (
                <button key={i} type="button" className={i === at ? s.picked : undefined} aria-label={`${m}: ${a.name} ${npr(a.values[i])}, ${b.name} ${npr(b.values[i])}`} onMouseEnter={() => setAt(i)} onFocus={() => setAt(i)} onClick={() => setAt(i)}>
                  {kind === 'bars' ? (
                    <><span className={s.a} style={{ height: `${high(a.values[i])}%` }} /><span className={s.b} style={{ height: `${high(b.values[i])}%` }} /></>
                  ) : i === at && (
                    <><b className={s.a} style={{ bottom: `${high(a.values[i])}%` }} /><b className={s.b} style={{ bottom: `${high(b.values[i])}%` }} /></>
                  )}
                </button>
              ))}
            </div>
          </div>
          <div className={s.months} aria-hidden="true">{months.map((m, i) => <span key={i}>{m}</span>)}</div>
        </>
      )}
    </div>
  );
}
