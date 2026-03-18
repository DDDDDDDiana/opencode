# js

To install dependencies:

```bash
bun install
```

To run:

```bash
bun run index.ts
```

## Multi-User Isolation

OpenCode supports multi-user deployments with per-user session isolation and quota enforcement.

**Service Boundary:**

- This service provides the **local user projection** needed for isolation and quotas
- User provisioning is **admin-facing** via the `/user` API endpoints
- **Registration, signup, and onboarding flows** are owned by external services (frontend, identity provider)
- This service enforces isolation and quotas for provisioned users, but does not handle user lifecycle or identity assurance

**Admin Operations:**

- `POST /user` - Provision a new user with optional quotas
- `PATCH /user/:id` - Update quotas or name
- `DELETE /user/:id` - Remove user (orphans sessions)
- `GET /user/:id/usage` - Inspect token usage by date

**Isolation Guarantees:**

- Sessions, messages, and parts are scoped to the owning user
- Cross-user access returns 404 (indistinguishable from not found)
- Usage accounting and quota enforcement operate per-user

This project was created using `bun init` in bun v1.2.12. [Bun](https://bun.sh) is a fast all-in-one JavaScript runtime.
