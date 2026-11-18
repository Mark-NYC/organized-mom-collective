-- Read-only, run against production right before 20261202 (and again right after). Prints every kit's title, status
-- and how many members hold or saved it, so before and after can be compared line by line. No customer data.
select k.slug, k.title, k.status,
  (select count(*) from public.club_entitlements e where e.resource_month = k.month) as holders,
  (select count(*) from public.club_resource_versions v where v.kit_id = k.id) as saved_versions
from public.club_kits k order by k.month;
