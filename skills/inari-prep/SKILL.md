---
name: inari-prep
description: Prepare the current repository for inari processing (onboarding into ebf/vibe-apps). Triggers when the user wants to onboard a service under inari/vibe-apps, "prepare the repo for deploy", add a FLAG, or asks why inari does not pick up their project.
---

# inari-prep — prepare a repository for inari

You prepare the **current** repository (cwd) for automatic onboarding by the
inari service. The canonical requirements live in `stand_deps.md` in the inari
repo; this skill is self-contained — consulting it is not required.

Hard rules:
- **Never push** — local edits and commits only; the user pushes.
- **Never create `.gitlab-ci.yml`** — inari owns it.
- **Confirm the dependency set with the user** before writing FLAG —
  auto-detection is a hypothesis, not a fact.
- Do not rewrite application code without an explicit request — only report
  mismatches.

## Procedure

### 1. Recon (read-only)
- `git fetch origin` first, then note ahead/behind — a stale clone makes every
  later check lie (e.g. inari may have already committed `.gitlab-ci.yml`
  upstream).
- `git rev-parse --show-toplevel`, current branch, remote. The remote must be
  `git.core.funkflow.com:ebf/vibe-apps/<name>` (or absent — then suggest
  push-to-create into that group). `<name>` = project path — every derived name
  (host, secrets, bucket) comes from it.
- `Dockerfile`: exists? has `EXPOSE <port>`? Does the port match what the app
  actually listens on? (no EXPOSE → inari falls back to 80).
- Auto-detect dependencies from manifests/code (requirements.txt, pyproject,
  package.json, go.mod, docker-compose, grep over the code):
  - `psycopg|asyncpg|sqlalchemy+postgres` → `postgres`; PostGIS traces
    (postgis in compose/SQL, geoalchemy) → `postgis` (instead of postgres);
  - `pika|amqp|aio-pika` → `rabbitmq`;
  - `redis` → `redis`;
  - `minio|boto3|s3` → `minio`;
  - `temporalio` → warn: **not supported** (no operator in the cluster), its
    connectivity check will stay red.
- App-specific secrets: grep for env the code reads that is NOT the standard
  dep contract (API keys like `ANTHROPIC_API_KEY`, `LDAP_*`, OAuth client
  secrets, …). If found → propose `secrets: true` in FLAG: the owner puts
  key=value into Vault at `vibe-apps/<cluster>/<name>/app`, inari's generated
  ExternalSecret materialises `<name>-app-secrets`, and the container gets all
  keys via envFrom (env names = Vault key names). Recommend pushing with
  `ready: false` until the secrets are in Vault.
- Junk and forbidden content: `.gitlab-ci.yml` tracked in HEAD,
  `__pycache__`/build artifacts, `.env` with real values (only `.env.example`
  is acceptable), any secrets.

### 2. Confirmation
Show the user a table: detected dependencies (with evidence — which file
suggested each), the port, and any concerns. Ask them to confirm the dep set
and the port (AskUserQuestion when ambiguous). Only after a "yes" — edit.

### 3. Edits (local only)
- **`FLAG`** (create/update):
  ```yaml
  ready: true
  dependencies:
    postgis: true      # confirmed deps only
    rabbitmq: true
    redis: true
    minio: true
  ```
  If the user wants to push code but delay onboarding — `ready: false` (flip
  later; inari reconciles declaratively every ~10 min).
- **Remove inari-owned files and junk**: `git rm --cached .gitlab-ci.yml` if
  tracked (explain: inari creates it itself AFTER the gitops repo; a version
  arriving with the push causes an extra pipeline and a version race in
  `<name>-argo`), `git rm -r --cached __pycache__` etc.; extend `.gitignore`.
- **`EXPOSE`** in the Dockerfile if missing (use the confirmed port).
- Commit with a clear message. Do NOT push.

### 4. Code-contract check (report only, no edits)
The application must read the standard env vars — the generated deployment
wires them into the container automatically:

| Dependency | env |
|---|---|
| postgres/postgis | `POSTGRES_HOST`, `POSTGRES_PORT`, `POSTGRES_DB`, `POSTGRES_USER`, `POSTGRES_PASSWORD` |
| rabbitmq | `RABBITMQ_HOST`, `RABBITMQ_PORT`, `RABBITMQ_USER`, `RABBITMQ_PASSWORD` |
| redis | `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD` |
| minio | `AWS_S3_ENDPOINT_URL`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, `AWS_S3_BUCKET_NAME` |

Grep the code for the env names it actually reads. Use a digit-safe pattern —
env names contain digits (`AWS_S3_ENDPOINT_URL`), a naive `[A-Z_]+` silently
drops them:
```bash
grep -rhoE '[A-Z][A-Z0-9_]{2,}' --include='*.py' --include='*.js' --include='*.go' . \
  | sort -u   # then intersect with the table above
```
List mismatches precisely
(e.g. `MINIO_HOST` instead of `AWS_S3_ENDPOINT_URL`, redis client without a
password): file, line, what to rename to what. Fix code only on explicit
request. No credentials are ever hardcoded: inari mints all secrets
(Vault → ESO), the user provisions none.

### 5. Final report
Checklist (✅/❌ per item above) + what happens after `git push`:
- ≤10 min — inari tick: creds to Vault, minio bucket+user, repo `<name>-argo`,
  then `.gitlab-ci.yml` into the source;
- CI: image build → imageTag bump in `<name>-argo`;
- ≤30 min — the ApplicationSet creates the Application → deploy;
- result: `https://<name>.prot-0.core.all3.com` (TLS a bit later, HTTP immediately).

Warnings to include in the report:
- changing deps AFTER bootstrap is not picked up by editing FLAG — the
  procedure is in `stand_deps.md` (values.yaml is create-only);
- never delete `.argo-managed` in `<name>-argo` — it prunes the Application;
- if the new project has no access to the shared CI
  (`devops/gitlab-ci-cd-shared/shared`), the first pipeline dies on include;
  access is granted in GitLab, and a config-level failure is only retried by a
  new commit.
