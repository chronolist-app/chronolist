# Isolated worktree development environments Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Allow independent FE/BE/H2 development stacks and browser sessions in concurrent Git worktrees.

**Architecture:** Generate a validated worktree-local `.env` from the canonical checkout path. Parameterize the existing Compose with backwards-compatible defaults, and route lifecycle operations through a Python standard-library CLI that pins its project and configuration.

**Tech Stack:** Python 3, Docker Compose v2, Vite 7, Spring Boot dev/H2, VS Code Dev Containers.

**Spec:** `docs/superpowers/specs/2026-11-17-worktree-compose-design.md`

## Global Constraints

- No production auth/DB changes, persistent DB service, Playwright test code, DNS service or shared proxy.
- Default FE/BE remain `http://localhost:5173` / `http://localhost:8080`.
- Worktree ports: slot 0–9999, FE=`20000 + 2*N`, BE=FE+1, bound to 127.0.0.1.
- Host-only Cookie and existing CSRF behavior remain unchanged; each environment uses one dedicated `*.localhost` host.
- Five named Volumes and source bind mounts remain scoped to the checkout/project.
- Python uses only the standard library; no new application dependencies.

## Review Focus

- Inherited COMPOSE/port/URL settings must never redirect a destructive operation: test hostile parent environment.
- Copied, edited, or hand-written `.env` must never select another project: test strict canonical validation and preservation.
- Port collision checks must distinguish an already running own service from another listener: test both branches.
- Partially created/stopped stacks must support repeated startup and cleanup: test actual Compose configuration and lifecycle dispatch.
- DevContainer's project-name selection must match CLI: inspect the extension implementation and verify supported Compose name precedence.

### Task 1: Worktree configuration and scoped lifecycle CLI

**Files:** Create `scripts/worktree-dev.py`, `scripts/tests/test_worktree_dev.py`.

**Interfaces:** `settings(root: Path, slot: int | None = None) -> dict[str, str]`,
`initialize(root: Path, slot: int | None = None) -> dict[str, str]`,
`load_settings(root: Path) -> dict[str, str]`,
`compose_command(root: Path, config: dict[str, str], args: list[str]) -> list[str]`,
`compose_environment(config: dict[str, str]) -> dict[str, str]`,
`run_action(root: Path, action: str) -> None`, `main() -> int`.

- [x] Write tests for deterministic/canonical path identity, equal-basename separation, slot bounds, idempotent init, unmanaged-file preservation, copied/edited-file rejection. Run `python3 -m unittest discover -s scripts/tests -v`; expect missing implementation failure.
- [x] Implement settings and exclusive `.env` generation, strict load validation; rerun config tests until green.
- [x] Add tests for hostile parent env isolation, scoped destroy/stop/restart, malformed config failure before Docker, occupied-port rejection and own-service repeated startup. Run to observe missing lifecycle failure.
- [x] Implement pinned Compose invocation and lifecycle commands, real socket port probes, and Docker published-port inspection; errors must not silently change identity/ports. Run the whole Python suite; expect PASS.
- [x] Commit the CLI and tests.

### Task 2: Compose defaults and DevContainer integration

**Files:** Modify `compose.yaml`; modify `.devcontainer/devcontainer.json` only if needed; extend `scripts/tests/test_worktree_dev.py`.

**Interfaces:** Task 1 `.env` keys: `COMPOSE_PROJECT_NAME`, `CHRONOLIST_SLOT`, `CHRONOLIST_BIND_ADDRESS`, `CHRONOLIST_FRONTEND_PORT`, `CHRONOLIST_BACKEND_PORT`, `CHRONOLIST_FRONTEND_ORIGIN`, `CHRONOLIST_API_BASE_URL`.

- [x] Add integration tests that run real `docker compose config --format json` for no-env and two generated environments. Assert original defaults and distinct project/network/Volume names, correct source binds, exact API/CORS URLs and loopback ports. Run and observe override assertions fail.
- [x] Parameterize existing Compose keys with the above settings and original defaults. Inspect Dev Containers project-selection logic; add a supported top-level Compose name if required to preserve generated COMPOSE_PROJECT_NAME.
- [x] Run Python tests and Compose config checks; expect PASS. Verify Vite's existing `.localhost` allowance before changing its host settings.
- [x] Commit the Compose integration.

### Task 3: Runtime verification and operator documentation

**Files:** Create `docs/development/worktrees.md`; update `README.md`, `backend/README.md`, `frontend/README.md`, spec status and this plan's checkboxes.

**Interfaces:** Exercise the CLI and Compose from Tasks 1–2. All docs show `python3 scripts/worktree-dev.py <action>` (Windows: `python`).

- [x] Start two temporary checkouts with `init --slot` and `up`; verify isolation of project labels, containers, networks, Volumes, and source binds. Preserve any pre-existing Docker resources.
- [x] Verify same-profile browser signup/login, major screens, Cookie isolation, CORS/CSRF, data independence, logout, backend restart, repeated up, and teardown. Use browser tooling if available; explicitly record any unavailable runtime check. Do not add Playwright test code.
- [x] Document two-worktree setup, stable URL output, slot collision recovery, DevContainer workflow, DNS/hosts fallback, signup seed setup, H2 reset behavior, volume cleanup, and explicit shell override limitations.
- [x] Run `python3 -m unittest discover -s scripts/tests -v`, `git diff --check`, and relevant frontend/backend checks if their behavior changed. Record evidence and limitations.
- [x] Commit docs and validated fixes; obtain one fresh whole-change code review, address important findings with regression tests, and leave changes committed on the work branch.

## Verification outcome

- Python standard-library suite: 17 tests passed, including real socket probes and real Compose configuration rendering.
- Two actual Docker Compose stacks: separate project labels, source mounts, networks and Volumes verified.
- One Chromium browser context: signup/login and ToDo/scheduler/time-blocking screens passed in both environments; host-only session Cookies and ToDo data remained separate.
- HMR updated only the modified checkout. Logout, repeated up, stop/up, restart and destroy in A preserved B authentication and data.
- An occupied slot failed before build without stopping the existing project. Inactive-profile cleanup was reproduced, fixed, and verified with a disposable labeled container.
- Fresh image dependency downloads were blocked by the Cloud build network. Runtime checks used temporary Dockerfiles populated from existing dependency caches; project Dockerfiles were unchanged.
- Native Windows and the actual VS Code DevContainer UI were not available for runtime verification. DevContainer project selection was checked against upstream CLI source and real Compose rendering.
- Author implementation ran inline on the managed work branch; one fresh independent review identified a Unix TIME_WAIT issue, fixed with a failing-then-passing socket regression. No unresolved Critical/Important code findings remain.
