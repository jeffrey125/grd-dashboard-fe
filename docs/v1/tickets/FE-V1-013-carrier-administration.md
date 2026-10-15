# FE-V1-013: Build dedicated Admin carrier-settings pages

## Status

Not started. Depends on FE-V1-004 and the existing carrier API.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Expose supported carrier configuration safely and keep dependent shipment screens synchronized after edits.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Build /admin/carriers and /admin/carriers/$carrierId with read-only code/UUID and mutable name, active state, fetch mode, threshold, interval, and nullable RPM.
- Apply exact existing numeric/null validation and carrier-specific fetch-mode options; show configured intervals with effective-minimum/worker timing caveats.
- Confirm disabling a carrier and explain that existing shipments remain visible while future tracking/creation is affected.
- Submit only supported changed fields, preserve dirty edits on background fetch, and handle conflicts or unavailable data safely.
- Invalidate carrier and dependent shipment/creation data after edits; refresh displayed carriers on focus/reconnect because no carrier event exists.

## Acceptance criteria

- Only Admin can edit through either navigation or direct URL; Staff shipment screens can still read carrier information.
- UPS only offers request mode; EchoShip/FFE offer request/browser. Only RPM accepts null; omitted fields retain existing values.
- Disabled carriers disappear from creation choices and prevent new refresh requests without hiding existing shipments.
- Background updates do not silently overwrite a dirty settings draft, and successful save refreshes dependent eligibility.
- No carrier creation, deletion, restoration, credential editing, global scheduler toggle, or exact polling-time promise is added.

## Verification

Run schema/forms and dependent-invalidation tests, real-backend allowed/disallowed field/mode/range/null cases, role tests, and browser disable/edit/focus/reconnect cases. Run quality gates.

## Review notes and completion

Carrier credentials remain backend/operator configuration. The frontend never receives or edits them in this scope.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
