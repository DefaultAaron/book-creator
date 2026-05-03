<!--
Optional template for code-heavy books (programming, ML, infra, hardware,
domain-specific languages). Embed inline in a section file when a code
example illustrates a concept. Adapt the language and provenance fields to
your subject. If your book has no code, ignore this template.

Externalisation rule of thumb:
- ≤ ~40 lines: embed directly in the section.
- > ~40 lines: extract to `_assets/code/<N>_<M>_<slug>.{ext}` and reference
  by relative path so the section page stays readable.
-->

> **Code — <one-line title>**
>
> **What it shows.** <one-sentence pedagogical purpose>
> **Source.** Original / adapted from <reference> / from `_assets/code/<path>`
> **Language / runtime.** <language> · <library or framework if relevant>
> **Tested against.** <dataset / fixture / environment / version>

```<language>
// Replace with the example. Keep imports minimal; load-bearing lines only.
// Comments inline only where the WHY is non-obvious.
```

> **Why this example, not another.** <one-sentence justification — what makes
> this the right entry-level illustration vs. simpler or more complex
> alternatives>
