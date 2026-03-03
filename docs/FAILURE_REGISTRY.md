# FAILURE_REGISTRY

## Tags
- auth
- network
- api
- unknown

## Classification Rules
### auth
- `QOO10_SAK` missing
- invalid/expired key
- permission/unauthorized/forbidden
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

### unknown
- Unclassified error
- Action: escalate model tier for second attempt; if repeated, BLOCKED

## 2-Strike Policy (same task)
- Two failed gates for same task => BLOCKED
- auth is immediate BLOCKED on first failure
