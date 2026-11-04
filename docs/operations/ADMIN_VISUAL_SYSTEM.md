# Admin presentation system (November 2026)

This is deliberately separate from storefront styles. CSS is scoped under `.admin-workspace`, loaded only by `AdminLayout.astro`.

## Status color meanings
- **Critical:** blush background / deep rose label. Failures that require intervention: failed Stripe payment, access revoked, critical monitoring alert.
- **Action needed:** pale apricot / dark ochre. Shipping queues, pending work, missing family details, low stock, warnings.
- **Complete:** soft leaf green / dark green. Paid, shipped, delivered.
- **Information:** frost blue / darker blue. In-progress checkout and informational notices.
- **Neutral:** white/grey. Normal historical data, empty/unchanged states, refunds without a failure, non-actionable metrics.

Never rely on color alone. Every state retains a text label. Avoid a full saturated card background for every statistic: use neutral cards and color only for actionable states.

## Layout
- Content width: ~1160px max inside existing sidebar.
- Section rhythm: ~32px; metric grids: 12px gap; cards: 18-20px inset.
- Main work areas use white surfaces, subtle borders and consistent 8px radius.
- Forms and detailed filters visually grouped; advanced date range/export under a disclosure in Orders.
- Club member billing failures and missing information have clear semantic status labels.
- Overview shows critical alerts first, then neutral business performance and work queues.

## Regression checks before merge
- Run `npm run build` and `npm test`.
- Confirm no CSS changes leak into public pages or customer payment components.
- Verify critical/warning/info/status colors in Overview and Orders.
- Verify Orders default filters, date range/export disclosure, order details, shipping actions, refund confirmation.
- Verify Club member list, flags, fulfillment, and status updates.
- Check 375px mobile viewport and desktop; keyboard navigation of every details/summary control.
