# Contributing to coOCR/HTR

Thank you for your interest in contributing to coOCR/HTR! This project is developed as an open-source community tool using the [Promptotyping methodology](https://lisa.gerda-henkel-stiftung.de/digitale_geschichte_pollin) -- we welcome contributions from domain experts, developers, and digital humanists.

## Project Philosophy

coOCR/HTR follows a few core principles that guide all contributions:

- **Expert-in-the-Loop**: The human expert decides, the machine assists
- **Documentation before code**: Design decisions are documented in [knowledge/](knowledge/)
- **Minimal, readable code**: Vanilla JavaScript, no build process, no framework dependencies
- **Promptotyping**: Iterative development through AI-assisted dialogue

## How to Contribute

### 1. Fork & Clone

```bash
git clone https://github.com/YOUR_USERNAME/co-ocr-htr.git
cd co-ocr-htr
```

### 2. Create a Feature Branch

```bash
git checkout -b feat/my-feature
# or: fix/my-bugfix, docs/my-documentation
```

### 3. Make Your Changes

- Follow the [Code Standards](#code-standards) below
- Add tests for new features
- Update documentation if behavior changes

### 4. Test Your Changes

```bash
cd docs
npm install
npm test          # Unit tests (Vitest)
npx serve . -l 3000  # Manual testing
```

### 5. Submit a Pull Request

- **One feature per PR** -- keep PRs focused and reviewable
- Write a clear description of what changed and why
- Include screenshots for UI changes
- Reference related issues if applicable

## Commit Conventions

We use [Conventional Commits](https://www.conventionalcommits.org/):

| Prefix | Usage |
|--------|-------|
| `feat:` | New feature |
| `fix:` | Bug fix |
| `docs:` | Documentation only |
| `chore:` | Maintenance, dependencies |
| `refactor:` | Code restructuring without behavior change |
| `test:` | Adding or updating tests |

Examples:
```
feat: add Azure Mistral OCR provider
fix: prevent dialog close on text selection
docs: update architecture with i18n system
test: add unit tests for project rules export
```

## Code Standards

### Must

- **Vanilla JavaScript** (ES6+) -- no TypeScript, no JSX
- **No runtime npm dependencies** -- the app runs without `node_modules`
- **ES6 modules** (`import`/`export`) -- native browser modules
- **CSS Custom Properties** for theming (see `docs/css/variables.css`)
- **Comments explain "why"**, code explains "what"
- **HTML escaping** for any user-provided or LLM-generated content (`escapeHtml()`)

### Must Not

- No build systems (webpack, vite, rollup, etc.)
- No CSS preprocessors (sass, less, etc.)
- No UI frameworks (React, Vue, Svelte, etc.)
- No runtime npm packages

### Architecture Patterns

- **State**: `AppState extends EventTarget` with `CustomEvent` dispatch
- **Services**: Singleton pattern (e.g., `export const llmService = new LLMService()`)
- **Storage**: IndexedDB for large data, localStorage for settings
- **API Keys**: Memory-only by default, optional IndexedDB persistence with user consent

## What Goes Into a Pull Request?

### Good PR

- Clear title and description
- Focused scope (one feature or fix)
- Tests for new functionality
- Updated documentation if the feature is user-facing
- Screenshots for UI changes

### We Will Not Accept

- PRs that add build systems or transpilers
- PRs that add runtime npm dependencies
- PRs that break existing tests without explanation
- PRs with unrelated formatting changes

## Review Process

1. **Submit your PR** against the `main` branch
2. **Maintainer reviews** -- Christopher Pollin ([@chpollin](https://github.com/chpollin)) reviews all PRs
3. **Feedback & iteration** -- expect constructive feedback, please be patient
4. **Merge** -- once approved, the maintainer merges your contribution

## Recognition

Contributors are credited in:
- The merge commit message (via `Co-Authored-By`)
- The [Contributors](#contributors) section in README.md
- The development journal ([knowledge/JOURNAL.md](knowledge/JOURNAL.md))

## Communication

- **Bug reports**: [GitHub Issues](https://github.com/DigitalHumanitiesCraft/co-ocr-htr/issues)
- **Feature requests**: [GitHub Issues](https://github.com/DigitalHumanitiesCraft/co-ocr-htr/issues) with `enhancement` label
- **Questions**: [GitHub Discussions](https://github.com/DigitalHumanitiesCraft/co-ocr-htr/discussions)

## Development Setup

```bash
# Clone
git clone https://github.com/DigitalHumanitiesCraft/co-ocr-htr.git
cd co-ocr-htr

# Install dev dependencies (tests only)
cd docs && npm install

# Run tests
npm test

# Serve locally
npx serve . -l 3000

# Optional: Configure API keys for development
cp config.local.example.js config.local.js
# Edit config.local.js with your API keys (gitignored)
```

## License

By contributing, you agree that your contributions will be licensed under the [CC BY 4.0](https://creativecommons.org/licenses/by/4.0/) license.
