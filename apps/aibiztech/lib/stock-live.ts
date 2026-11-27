// With STOCK_LIVE_APP=1 (and SSO set up) "Stock Manager" in the portal is the live Auto Stock Manager, shown inside the
// portal and signed in with one login, instead of the pages under /stock. Unset, nothing changes.
export const STOCK_IS_LIVE_APP = process.env.STOCK_LIVE_APP === '1';
export const STOCK_LIVE_URL = (process.env.STOCK_LIVE_URL ?? 'https://stock.hamroauto.com.np').replace(/\/$/, '');
