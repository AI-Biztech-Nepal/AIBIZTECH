import { AppPending } from '../../app-pending';

export default function Stock() {
  return <AppPending service="stock" name="Stock Manager" liveUrl={process.env.STOCK_LIVE_URL ?? 'https://stock.hamroauto.com.np'} />;
}
