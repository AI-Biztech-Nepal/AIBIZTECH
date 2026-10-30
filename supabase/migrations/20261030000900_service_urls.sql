-- Real addresses for the service tiles on the portal home page (they were placeholders).
-- Stock Manager is not deployed on this Vercel account, so its placeholder stays.
update core.services set base_url = 'https://attendance-nepal.com'  where key = 'attendance';
update core.services set base_url = 'https://finance-drab-three.vercel.app' where key = 'finance';
