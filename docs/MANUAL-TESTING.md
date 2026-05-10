# Manual Testing Checklist

Run this checklist against a live Pi session before first publish and after significant changes.

## Setup

1. Install the package locally:
   ```bash
   pi install -l git:github.com/victor-software-house/pi-prompt-composer@003-publish-readiness
   ```
2. Copy example prompts into your project prompt root:
   ```bash
   mkdir -p .pi/composed/review
   cp -r node_modules/pi-prompt-composer/examples/prompts/review/* .pi/composed/review/
   ```
   Or symlink for development:
   ```bash
   ln -s ../../examples/prompts/review .pi/composed/review
   ```
3. Create a flat Liquid prompt:
   ````bash
   cat > .pi/composed/ship.md <<'EOF'
   ---
   description: Prepare a ship checklist
   engine: liquid
   args:
     - name: change
       required: true
       hint: What changed?
     - name: workdir
       required: false
       hint: Working directory
   ---
   {% xml "task" %}
   Ship {{ args.change | quote }}
   {% endxml %}

   ```bash
   cd {{ args.workdir | default: "." | shell_quote }}
   pnpm run typecheck
   pnpm run lint
   pnpm test
   ```
   EOF
   ````
4. Reload Pi.

## Checklist

| # | Test | Expected | Pass? |
|---|------|----------|-------|
| 1 | Type `/review` and press Enter | Rich selector opens with borders, accent title, aligned name + description columns, dynamic usage hint at bottom | |
| 2 | Navigate up/down in the selector | Usage hint updates showing `/review <subcommand> <args>` and per-arg bullet hints | |
| 3 | Select `fix` from the selector | Input prompt asks for `issue` argument | |
| 4 | Provide the issue value | Rendered prompt is sent as a visible user message with the value substituted | |
| 5 | Select `summary` from the selector | Input prompt asks for `change` argument | |
| 6 | Press Esc in the selector | Operation cancelled, no message sent | |
| 7 | Type `/review summary "my change"` | Prompt dispatched directly with `my change` substituted, no input prompt | |
| 8 | Type `/review fix` (no args) | Input prompt asks for `issue` | |
| 9 | Submit empty value for required arg | Warning notification, re-prompts | |
| 10 | Cancel input prompt (Esc/Ctrl+C) | Operation cancelled, no message sent | |
| 11 | Type `/review` then Tab after space | Autocomplete shows `fix` and `summary` with descriptions | |
| 12 | Type `/review nonexistent` | Warning notification listing available subcommands | |
| 13 | Reload Pi (`/reload`) | Commands still register correctly, no duplicate registrations | |
| 14 | Check for discovery warnings | If any prompt has malformed metadata, Pi notification appears on session start | |
| 15 | Type `/ship --change "composed prompts" --workdir "packages/app with spaces"` | Rendered user message contains a `<task>` block, quoted change, and safely quoted `cd 'packages/app with spaces'` command | |
| 16 | Create `.pi/prompts/misplaced.md` with `engine: liquid`, then `/reload` | Pi notification warns that composer-style prompt is under native Pi prompt root and should move to `.pi/composed/misplaced.md` | |
| 17 | Move that file to `.pi/composed/misplaced.md`, then `/reload` | `/misplaced` appears once as a composer command and no misplaced warning appears | |
| 18 | Put a legacy group under `.pi/prompts/legacy/`, then `/reload` | Directory migrates to `.pi/composed/legacy/` and a deprecation warning names source and target | |
| 19 | Type `/fixture rest foo create that shit` | Rendered message shows `args.tail` as `create that shit`, `argv` as all positionals, and `arguments` as joined string | |
| 20 | Type `/fixture validation wrong count=nope` | Render is blocked; UI warns about invalid enum and/or number | |
| 21 | Before migrating bundled `/compose` prompts to Liquid, run golden tests for `/compose new/add/remove` sample invocations | Rendered instructions are deterministic, use `.pi/composed/`, preserve literal Liquid examples, and contain no unresolved placeholders | |

## Recording results

Fill in the Pass? column with ✅ or ❌ and the date. Keep the last result committed.
