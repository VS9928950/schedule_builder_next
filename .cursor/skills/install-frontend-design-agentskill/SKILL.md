---
name: install-frontend-design-agentskill
description: >-
  Installs Anthropic's frontend-design skill from agentskill.sh into Cursor via
  /learn or the agentskill CLI. Use when the user asks to install frontend-design,
  agentskill.sh skills, @anthropics/frontend-design, or production-grade UI design
  skills from the agentskill registry.
---

# Install frontend-design (agentskill.sh)

## Goal

Install [frontend-design](https://agentskill.sh/@anthropics/frontend-design) (`@anthropics/frontend-design`) so Cursor loads its `SKILL.md` like any other agent skill.

## Prerequisites

- [Node.js](https://nodejs.org/) so `npx` works.

## One-time setup (if `/learn` is not available yet)

Run in a terminal (from any directory):

```bash
npx @agentskill.sh/cli@latest setup
```

Optional but recommended on first use: install the learn skill in Cursor chat:

```
/learn @agentskill-sh/learn
```

Registry page for Cursor: [agentskill.sh/cursor](https://agentskill.sh/cursor).

## Install frontend-design

**Preferred (in Cursor Agent/Chat):**

```
/learn @anthropics/frontend-design
```

**Alternative (terminal):** the CLI binary is `ags` (also published as `agent-skill`). Install globally once, then install the skill:

```bash
npm install -g @agentskill.sh/cli
ags install @anthropics/frontend-design --platform cursor
```

To run without a global install, use `npm exec` so the `ags` binary from the package is on the PATH for that command:

```bash
npm exec --yes --package=@agentskill.sh/cli@latest -- ags install @anthropics/frontend-design --platform cursor
```

## After install

- Skills for Cursor are stored under `.cursor/skills/` (project) or your user skills directory, depending on how the CLI was configured; if the agent does not pick up the new skill immediately, reload the window or start a new chat.
- Confirm with `/learn list` (when using the learn skill) or by checking that a `frontend-design` folder with `SKILL.md` exists under the expected skills path.

## If install fails

- Re-run setup: `npx @agentskill.sh/cli@latest setup`
- Force latest CLI: `npx @agentskill.sh/cli@latest` (avoid stale `npx` cache)
- Verify the slug matches the registry: `https://agentskill.sh/@anthropics/frontend-design`

## Agent behavior

When the user wants this skill installed, run the terminal commands yourself when the environment allows (network, permissions). If `/learn` must be typed by the user, give them the exact slash command in a single line for copy-paste.

