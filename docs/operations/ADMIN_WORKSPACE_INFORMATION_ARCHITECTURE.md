# Admin workspace structure (November 2026)

## Principle
Organize navigation around recurring operator jobs, not every database feature. Do not place disabled or unbuilt capabilities in global navigation. Keep admin authentication, RLS, webhooks and domain logic untouched during IA work.

## New navigation
- **Home**: Overview (alerts, business pulse)
- **Operations**: Orders; Products & stock (existing orders inventory tab); Family Club (members, fulfillment, monthly kits)
- **Growth**: Pinterest Studio; Pages & funnels; Survey
- **System**: Settings (integrations, account and audit)

Desktop: persistent left sidebar. Mobile: collapsed expandable navigation. Shared breadcrumb at top of every page. The existing routes remain unchanged.

## Principles for next UX pass
1. Overview = triage: needs-attention items, 4-6 business metrics, next action. Do not dump every data table here.
2. Operations = things you must fulfill/manage. Put orders, inventory, Club print deadlines and customer support tasks here.
3. Growth = content pipeline and acquisition. Pinterest and site inventory belong here. Future **offer analytics** belongs in a consolidated Growth > Performance screen, not a seventh root tab.
4. System = rarely changed integrations, checkout settings and diagnostics. Gelato diagnostics should not occupy the Orders screen.
5. Use consistent filters, search, date ranges, statuses, inline detail panels, and back links across data-heavy sections.
6. Retain permission boundaries and protect customer PII. Do not embed analytics/marketing pixels in admin.

## Follow-up work (not implemented by this PR)
- Unify duplicated shop settings between Orders and System settings; do not remove operational settings without preserving their controls.
- Refactor 62k-character OrdersAdmin and 42k-character ClubAdmin into smaller components with URLs reflecting the selected subview.
- Make the primary Overview show actionable fulfillment, billing failures, and shipping deadlines with counts and clear links.
- Add purchase funnel analytics only after reliable server-side attribution and offer events exist; keep it under Growth > Performance.
- Add full customer support workspace under Operations when ready.

## Safety/verification
- Navigation refactor should not alter existing URLs or stored data.
- Check /admin, /admin/orders, /admin/orders?tab=inventory, /admin/club, /admin/pages, /admin/pins, /admin/settings, and /survey/admin on mobile and desktop.
- Run `npm run check` and `npm run build` before merge.
- Ensure menu active-state for Products & stock maps to OrdersAdmin inventory tab and the Orders tab still works.
