-- Business builder answers, collected during onboarding and used to recommend services.
-- Existing organizations keep nulls and simply get no recommendations.

alter table core.organizations
  add column business_type  text,
  add column business_needs text[],
  add column team_size      text;

grant update (business_type, business_needs, team_size) on core.organizations to authenticated;
