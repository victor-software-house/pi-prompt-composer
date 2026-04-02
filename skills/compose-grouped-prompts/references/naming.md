# Naming Conventions

## Group names

- Use lowercase kebab-case: `code-review`, `deploy`, `db`
- Keep names short (1–3 words)
- Use nouns or noun phrases that describe the domain
- Avoid generic names like `tools`, `commands`, `utils`

### Collision checks

Before choosing a name, verify it does not collide with:

1. **Existing grouped prompts** in the same prompt root
2. **Flat Pi prompt templates** the operator wants to keep (a group command overrides a flat template with the same name)
3. **Built-in Pi commands** like `help`, `clear`, `model`

## Subcommand names

- Use lowercase kebab-case: `create`, `list`, `run-tests`
- Use short verbs or verb phrases describing the action
- Keep names unique within the group
- Avoid abbreviations unless they are universally understood

### Good examples

```
/deploy start
/deploy rollback
/deploy status

/review summary
/review checklist
/review fix
```

### Anti-patterns

```
/my-stuff do-thing       ← vague group and subcommand names
/utils misc              ← too generic
/deploy deploy-to-prod   ← redundant with group name
```

## Filename-to-name mapping

The subcommand name is derived from the filename:

| Filename | Derived name |
|----------|-------------|
| `create.md` | `create` |
| `run-tests.md` | `run-tests` |
| `MyCommand.md` | `my-command` |
| `SETUP_ENV.md` | `setup-env` |

Use the `name` frontmatter field to override this derivation when the filename cannot express the desired name.
