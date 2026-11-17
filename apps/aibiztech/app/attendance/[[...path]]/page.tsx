import { AppPending } from '../../app-pending';

// Only reached while ATTENDANCE_URL is not set; once it is, the portal serves Attendance here (see next.config.ts)
export default function Attendance() {
  return <AppPending service="attendance" name="Attendance Nepal" liveUrl={process.env.ATTENDANCE_LIVE_URL ?? 'https://attendance-nepal.com'} />;
}
