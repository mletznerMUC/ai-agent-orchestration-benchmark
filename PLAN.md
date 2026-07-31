# Plan: Fix gray empty-track artifact in all tile grids
Branch: feature/fix-grid-auto-fit

## Steps

1. [x] Replace `auto-fill` with `auto-fit` in `.score-grid` in `index.html`
   - Files: `/home/user/ai-agent-orchestration-benchmark/index.html`
   - Line 255, exact replacement:
     - Before: `    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));`
     - After:  `    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));`
   - Done when: line 255 reads `auto-fit` and the surrounding `.score-grid` block is otherwise unchanged.

2. [x] Replace `auto-fill` with `auto-fit` in `.price-grid` in `index.html`
   - Files: `/home/user/ai-agent-orchestration-benchmark/index.html`
   - Line 481, exact replacement:
     - Before: `    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));`
     - After:  `    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));`
   - Done when: line 481 reads `auto-fit` and the surrounding `.price-grid` block is otherwise unchanged.

3. [x] Replace `auto-fill` with `auto-fit` in `.verdict-grid` in `index.html`
   - Files: `/home/user/ai-agent-orchestration-benchmark/index.html`
   - Line 582, exact replacement:
     - Before: `    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));`
     - After:  `    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));`
   - Done when: line 582 reads `auto-fit` and the surrounding `.verdict-grid` block is otherwise unchanged.

4. [x] Replace `auto-fill` with `auto-fit` in `.score-grid` in `index.en.html`
   - Files: `/home/user/ai-agent-orchestration-benchmark/index.en.html`
   - Line 255, exact replacement:
     - Before: `    grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));`
     - After:  `    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));`
   - Done when: line 255 reads `auto-fit` and the surrounding `.score-grid` block is otherwise unchanged.

5. [x] Replace `auto-fill` with `auto-fit` in `.price-grid` in `index.en.html`
   - Files: `/home/user/ai-agent-orchestration-benchmark/index.en.html`
   - Line 481, exact replacement:
     - Before: `    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));`
     - After:  `    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));`
   - Done when: line 481 reads `auto-fit` and the surrounding `.price-grid` block is otherwise unchanged.

6. [x] Replace `auto-fill` with `auto-fit` in `.verdict-grid` in `index.en.html`
   - Files: `/home/user/ai-agent-orchestration-benchmark/index.en.html`
   - Line 582, exact replacement:
     - Before: `    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));`
     - After:  `    grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));`
   - Done when: line 582 reads `auto-fit` and the surrounding `.verdict-grid` block is otherwise unchanged.

## Risks & open questions

- A file `index.html.bak` is present in the repository root and contains the same three `auto-fill` declarations. It is intentionally excluded from this fix because it is not a served file; however implementers should be aware that a repo-wide `grep -rn 'auto-fill'` will still match it after all six steps are complete.
- Both files are currently byte-identical at the affected lines, which simplifies verification.

## Verification

1. Run `grep -n "auto-fill" index.html index.en.html` from the repo root — must return no output. (Note: `index.html.bak` retaining `auto-fill` is expected and acceptable.)
2. Run `grep -n "auto-fit" index.html index.en.html` — must show exactly 3 hits per file (lines 255, 481, 582).
3. Open both `index.html` and `index.en.html` in a browser, resize the viewport so that the score grid, price grid, and verdict grid each have a partially-filled last row. Confirm no gray rectangle appears to the right of the last item in each grid.
4. Verify the comparison/filter feature (tool checkboxes or similar) still updates the grids correctly.
5. Confirm no other files were modified: `git diff --name-only` must list only `index.html` and `index.en.html`.
