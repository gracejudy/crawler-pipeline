# FAILURE_REGISTRY

## v1 Tags (read-only)
- auth
- network
- api
- unknown

## v2 Tags (write)
- permission
- validation
- approval-missing
- auth
- network
- api
- unknown

## Classification Rules
### auth
- `QOO10_SAK` missing
- invalid/expired key
- unauthorized/forbidden
- Action: immediate BLOCKED recommendation

### network
- DNS resolution failure
- connect/socket reset
- timeout/fetch transport issue
- Action: retry within gate; accumulate strike on gate fail

### api
- HTTP 5xx
- rate-limit/quota/transient upstream
- Action: retry within gate; accumulate strike on gate fail

### permission (v2)
- category/seller permission mismatch
- Action: treat as write-scope issue; no v1 trigger

### validation (v2)
- payload/field validation failure
- Action: treat as write-scope issue; no v1 trigger

### approval-missing (v2)
- `QOO10_WRITE_APPROVED` not set when required
- Action: BLOCKED; no v1 trigger

### unknown
- Unclassified error
- Action: escalate model tier for second attempt; if repeated, BLOCKED

## 2-Strike Policy (same task)
- Two failed gates for same task => BLOCKED
- auth is immediate BLOCKED on first failure

## Open Write-Related Issues
- Keep this section empty only when no write-related issue is open.
- Promotion of v2 to gate requires this section to have no open items.
