import { Inter, Plus_Jakarta_Sans } from 'next/font/google';

// The portal's two typefaces, as CSS variables. Add `fontVariables` to a wrapper to use them inside it.
const body = Inter({ subsets: ['latin'], variable: '--font-body' });
const display = Plus_Jakarta_Sans({ subsets: ['latin'], weight: ['700', '800'], variable: '--font-display' });

export const fontVariables = `${body.variable} ${display.variable}`;
