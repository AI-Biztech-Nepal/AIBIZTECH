-- Customers now pick the apps they want when they register their business, so stop starting every app automatically.
-- (Existing businesses keep the apps they already have.)
drop trigger if exists memberships_start_services on core.memberships;
