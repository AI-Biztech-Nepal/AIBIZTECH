import { NextResponse } from 'next/server';

// A redirect that stays on whatever address the person came in by. Behind our own web server, the address a route
// handler sees is the app's local one (localhost), so a full address built from it would lead nowhere.
export const sendTo = (location: string) => new NextResponse(null, { status: 307, headers: { Location: location } });
