# FE-V1-012: Build dedicated Admin account-management pages

## Status

Not started. Depends on FE-V1-004 and the existing account API.

## Target repository

This frontend repository, `grd-dashboard-fe`.

## Objective

Let Admins create and manage employee access through dedicated pages using the implemented backend policies.

## Required reading

- [ui-spec.md](../ui-spec.md)
- [api-contracts.md](../api-contracts.md)
- [verification.md](../verification.md)
- [Ticket index and shared completion rule](README.md).

## Scope

- Build /admin/accounts, /admin/accounts/new, and /admin/accounts/$accountId with consistent shell/breadcrumbs and direct-URL guards.
- Create/edit forms use approved React Hook Form/Zod and supported account fields; show active, role, and required-password-replacement state.
- Implement confirmed activation/deactivation and Admin password reset with the existing password endpoint. Explain out-of-band delivery and forced replacement.
- Enforce helpful UI restrictions on self-deactivation/demotion while handling authoritative 409 protections and stale role/account changes.
- Invalidate account/session state correctly after mutations, preserve failed forms, and provide safe action feedback with no password disclosure.

## Acceptance criteria

- Staff cannot see or navigate into Admin functionality and backend 403 responses are handled safely.
- Create validates first/last name, normalized email, role, and new-password rules; duplicate email and protected Admin conflicts are understandable.
- Password reset/deactivation/role changes handle revoked sessions appropriately, including the current user's session when applicable.
- Confirmation dialogs name the target account and effect; no account deletion, public signup, emailed invite/reset, or MFA claim is introduced.
- Passwords never reach URLs, browser storage, logs, toasts, or shared query cache; cancellation does not submit a mutation.

## Verification

Run forms/guards/mutations tests and real-backend Staff/Admin, duplicate-email, protected-admin, reset/replacement, self-change, and revoked-session browser cases using disposable accounts. Run quality gates.

## Review notes and completion

The backend account list is currently an array; do not silently broaden this ticket into server-side account pagination or a new invitation system.

Record exact implementation/verification evidence in this ticket's implementation
summary. Follow the seven-heading handoff and explicit commit approval workflow.
Keep hosting, publishing, and deployment deferred.
