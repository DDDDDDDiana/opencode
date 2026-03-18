# Feature Research

**Domain:** Multi-tenant API mandatory authentication
**Researched:** 2026-03-18
**Confidence:** HIGH

## Feature Landscape

### Scope framing for this milestone

v1.2 removes anonymous fallback and enforces mandatory API key authentication for all requests. This is a security hardening milestone that simplifies the authentication model.

Existing features (already built in v1.0/v1.1):

- API key authentication with bcrypt
- UserContext propagation via ALS
- Session ownership filtering
- Anonymous fallback (requests without API key see unowned sessions)

Focus ONLY on features needed to enforce mandatory authentication.

### Table Stakes (Users Expect These)

Features users assume exist. Missing these = product feels incomplete.

| Feature                                    | Why Expected                                            | Complexity | Notes                                                                                                           |
| ------------------------------------------ | ------------------------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------- |
| 401 Unauthorized for missing API key       | HTTP standard — clients expect 401 when auth is missing | LOW        | Already have resolve() returning anonymous state; change middleware to reject instead of allowing through       |
| 401 Unauthorized for invalid API key       | HTTP standard — clients expect 401 when auth fails      | LOW        | Same as above; resolve() already detects invalid keys                                                           |
| WWW-Authenticate header in 401 response    | HTTP spec requirement for 401 responses                 | LOW        | Add `WWW-Authenticate: Bearer` header to inform clients of expected auth scheme                                 |
| Consistent error response format           | API clients expect structured error messages            | LOW        | Return JSON body with error type and message (e.g., `{"error": "Unauthorized", "message": "API key required"}`) |
| Remove anonymous fallback from UserContext | Security model requires all requests authenticated      | LOW        | Remove ANONYMOUS_MISSING default in UserContext.get(); middleware rejects anonymous                             |
| Middleware-level enforcement               | Auth must happen before any business logic              | LOW        | Hono middleware already exists; modify to reject anonymous identity instead of allowing through                 |

### Differentiators (Competitive Advantage)

Features that set the product apart. Not required, but valuable.

| Feature                                                | Value Proposition                                                | Complexity | Notes                                                                           |
| ------------------------------------------------------ | ---------------------------------------------------------------- | ---------- | ------------------------------------------------------------------------------- |
| Throttled logging for invalid keys                     | Prevents log spam from brute force attempts                      | LOW        | Already implemented in user-auth.ts throttle() function; preserve this behavior |
| Clear error messages distinguishing missing vs invalid | Better DX — clients know if they forgot header or have wrong key | LOW        | Already distinguished in resolve() with reason: "missing" vs "invalid"          |
| Graceful migration path documentation                  | Helps existing deployments upgrade without downtime              | LOW        | Document that admins must provision users before upgrading to v1.2              |
| Audit log for rejected auth attempts                   | Security monitoring and compliance                               | MEDIUM     | Optional enhancement; log rejected requests with timestamp, IP, reason          |

### Anti-Features (Commonly Requested, Often Problematic)

Features that seem good but create problems.

| Feature                                           | Why Requested                                  | Why Problematic                                                                                                                          | Alternative                                                               |
| ------------------------------------------------- | ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Soft fallback mode (allow anonymous with warning) | "Easier migration" or "backward compatibility" | Defeats security purpose; creates ambiguous state; users delay proper migration                                                          | Hard cutover with clear migration guide; force proper auth setup          |
| 403 Forbidden instead of 401                      | Confusion about HTTP semantics                 | 403 means "authenticated but insufficient permissions"; 401 means "not authenticated" — using 403 for missing auth is semantically wrong | Use 401 for missing/invalid auth; reserve 403 for quota/permission issues |
| Custom auth header (not Authorization)            | "Simpler" or "avoid conflicts"                 | Breaks HTTP standards; confuses clients; incompatible with standard tooling                                                              | Stick with standard `Authorization: Bearer <key>` header                  |
| Anonymous read-only mode                          | "Let users browse without auth"                | Multi-tenant isolation requires knowing which user; anonymous breaks ownership model                                                     | Require auth for all operations; provision guest/demo accounts if needed  |

## Feature Dependencies

```
Middleware rejection
    └──requires──> UserContext.get() behavior change
                       └──requires──> Remove ANONYMOUS_MISSING default

WWW-Authenticate header
    └──enhances──> 401 response (provides client guidance)

Error response format
    └──enhances──> 401 response (improves DX)

Throttled logging
    └──independent──> (already exists, preserve behavior)
```

### Dependency Notes

- **Middleware rejection requires UserContext behavior change:** If UserContext.get() still defaults to anonymous, middleware must explicitly check and reject; cleaner to make middleware reject anonymous state
- **WWW-Authenticate enhances 401:** HTTP spec says 401 responses SHOULD include WWW-Authenticate; helps clients understand expected auth scheme
- **Throttled logging is independent:** Already implemented; just preserve existing behavior when adding rejection logic

## MVP Definition

### Launch With (v1.2)

Minimum viable product — what's needed to enforce mandatory authentication.

- [x] 401 Unauthorized for missing API key — Essential security requirement
- [x] 401 Unauthorized for invalid API key — Essential security requirement
- [x] WWW-Authenticate header in 401 response — HTTP standard compliance
- [x] Remove anonymous fallback from UserContext — Simplifies security model
- [x] Middleware-level enforcement — Prevents any anonymous access
- [x] Preserve throttled logging — Prevents log spam from attacks

### Add After Validation (v1.x)

Features to add once core is working.

- [ ] Structured error response format — Improves DX; can add incrementally
- [ ] Audit log for rejected attempts — Security monitoring; not blocking for launch
- [ ] Migration guide documentation — Helps deployments upgrade; can document post-launch

### Future Consideration (v2+)

Features to defer until product-market fit is established.

- [ ] Rate limiting per IP for failed auth — Advanced security; current throttled logging is sufficient for v1.2
- [ ] Webhook notifications for auth failures — Monitoring integration; overkill for initial release

## Feature Prioritization Matrix

| Feature                     | User Value | Implementation Cost | Priority |
| --------------------------- | ---------- | ------------------- | -------- |
| 401 for missing/invalid key | HIGH       | LOW                 | P1       |
| Remove anonymous fallback   | HIGH       | LOW                 | P1       |
| Middleware enforcement      | HIGH       | LOW                 | P1       |
| WWW-Authenticate header     | MEDIUM     | LOW                 | P1       |
| Preserve throttled logging  | MEDIUM     | LOW                 | P1       |
| Structured error format     | MEDIUM     | LOW                 | P2       |
| Audit log                   | LOW        | MEDIUM              | P2       |
| Migration documentation     | MEDIUM     | LOW                 | P2       |

**Priority key:**

- P1: Must have for launch
- P2: Should have, add when possible
- P3: Nice to have, future consideration

## Competitor Feature Analysis

| Feature                 | Stripe API                              | GitHub API                       | AWS API Gateway    | Our Approach                                       |
| ----------------------- | --------------------------------------- | -------------------------------- | ------------------ | -------------------------------------------------- |
| Missing auth response   | 401 with JSON error                     | 401 with JSON error              | 403 (non-standard) | 401 with JSON error (follow Stripe/GitHub pattern) |
| Invalid auth response   | 401 with JSON error                     | 401 with JSON error              | 403 (non-standard) | 401 with JSON error                                |
| WWW-Authenticate header | Yes (Bearer)                            | Yes (token)                      | No                 | Yes (Bearer) — HTTP standard                       |
| Error message clarity   | High — distinguishes missing vs invalid | High — clear error types         | Medium             | High — preserve existing reason distinction        |
| Anonymous fallback      | None — all requests require auth        | None — all requests require auth | None               | None — removing in v1.2                            |

## Implementation Notes

### Existing Infrastructure (Already Built)

- API key authentication with bcrypt verification
- UserContext propagation via AsyncLocalStorage
- Session ownership filtering by user_id
- Anonymous fallback (requests without API key see unowned sessions)
- Throttled logging for invalid auth attempts

### Changes Required for v1.2

1. **Modify middleware** (`src/server/server.ts`):
   - Check identity state after resolve()
   - If state === "anonymous", return 401 response
   - Include WWW-Authenticate: Bearer header
   - Include JSON error body

2. **Update UserContext** (`src/user/user-context.ts`):
   - Remove ANONYMOUS_MISSING default fallback
   - Make get() throw or return error when no context exists
   - OR: Keep get() but make middleware explicitly reject anonymous

3. **Preserve existing behavior**:
   - Keep throttled logging in user-auth.ts
   - Keep bcrypt verification logic
   - Keep resolve() function signature (returns Identity)

### HTTP Status Code Decision

**Use 401 Unauthorized (not 403 Forbidden):**

- 401 = "You need to authenticate" (missing or invalid credentials)
- 403 = "You're authenticated but don't have permission" (valid credentials, insufficient rights)

Per MDN and HTTP spec:

- 401 is for authentication failures
- 403 is for authorization failures (authenticated but forbidden)

Reserve 403 for quota exceeded, model not allowed, etc. (user is authenticated but lacks permission).

## Sources

- MDN HTTP 401 Unauthorized: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/401 — **Confidence: HIGH**
- MDN HTTP 403 Forbidden: https://developer.mozilla.org/en-US/docs/Web/HTTP/Status/403 — **Confidence: HIGH**
- Existing codebase: `src/user/user-context.ts`, `src/server/user-auth.ts` — **Confidence: HIGH**
- PROJECT.md: Multi-user isolation requirements and v1.2 milestone goals — **Confidence: HIGH**

---

_Feature research for: OpenCode mandatory authentication enforcement_
_Researched: 2026-03-18_
