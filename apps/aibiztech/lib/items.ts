// Item categories are made by each business: a name, a website key, and the extra fields its items ask for.

export type ItemField = { key: string; label: string; long: boolean };

export const slugify = (s: string, sep = '-') =>
  s.toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, sep).replace(new RegExp(`^${sep}+|${sep}+$`, 'g'), '');

// One field per line; end a line with "| long" for a multi-line box. Blank lines and repeated labels are dropped.
export function parseFieldLines(raw: string): ItemField[] {
  const seen = new Set<string>();
  const out: ItemField[] = [];
  for (const line of raw.split(/\r?\n/)) {
    const [labelPart, flag] = line.split('|');
    const label = (labelPart ?? '').trim().slice(0, 60);
    const key = slugify(label, '_');
    if (!label || !key || seen.has(key)) continue;
    seen.add(key);
    out.push({ key, label, long: (flag ?? '').trim().toLowerCase() === 'long' });
  }
  return out.slice(0, 20);
}

// Values typed into the form for a category's fields (inputs are named f_<key>); anything else in the form is ignored.
export function readAttributes(fields: ItemField[], get: (name: string) => string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const f of fields) {
    const v = get('f_' + f.key).trim().slice(0, 2000);
    if (v) out[f.key] = v;
  }
  return out;
}
