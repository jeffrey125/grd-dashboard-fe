# FE-V1-007: Build dedicated batch shipment creation

## Status

Not started. Depends on FE-V1-006.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Allow staff to add one to ten shipments with accurate atomic-validation and duplicate feedback, returning to the list after success.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Build /shipments/new with React Hook Form field arrays, feature Zod validation, one initial row, and accessible add/remove controls up to ten.
- Select enabled carriers per row; preserve references as strings and normalize optional notes according to the backend contract.
- Map 1-based backend row errors to the submitted row snapshot, retaining input and handling carrier-disable races.
- Prevent repeated submission and warn before discarding dirty input through navigation.
- On successful 200/201, invalidate relevant list/count/overview data, return to Active/page 1/newest-first with filters cleared, and toast inserted/duplicate counts with a useful All-shipments action for existing duplicates.

## Acceptance criteria

- One/ten rows work; over-limit, blank/NUL/overlength/invalid-carrier inputs fail without a partial-success claim.
- Leading zeros and case are preserved; cleared optional notes do not send invalid empty strings.
- Duplicate rows follow backend last-notes semantics; existing duplicates are not overwritten. All-duplicate success is not presented as newly inserted.
- Invalid submissions remain on the create page with stable correct row errors. Network failure retains input.
- Successful submission returns to /shipments; no dedicated results page or remaining-on-form flow replaces the approved redirect.

## Verification

Run form/field-array/validation tests, API response mapping tests, and browser workflows against isolated backend fixtures for mixed/all duplicates, invalid atomic batch, disabled carrier, leading zeros, double clicks, and success navigation. Run quality gates.

## Review notes and completion

No CSV import, arbitrary bulk size, carrier/reference edit, or new validation library is included.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
