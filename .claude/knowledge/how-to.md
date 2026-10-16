# How to update the documents

## Edit the plan and rebuild the Word files

1. Edit `.claude/source/plan-v2.4.md` (markdown is the source of truth for `docs/Product-Plan.docx`). For a new version, copy it to `plan-v2.5.md` and pass that name in step 3.
2. Use cases live in the `ucRows`, `actorsRows` and diagram functions of `.claude/source/build-usecases.js`.
3. Rebuild (needs Node.js):
   ```bash
   cd .claude/source
   npm install            # first time only; node_modules is not kept
   npm run build          # writes docs/Use-Case-Diagrams.docx then docs/Product-Plan.docx
   ```
   `build-usecases.js` must run first: `build-plan.js` reuses its diagram images. Diagram images are rendered in the system temp folder (`ecom-plan-build`).
4. Copy the previous Word files into `.claude/archive/` before overwriting, and add a line to `knowledge/history.md`.

Notes for `build-plan.js`: figures are inserted at fixed headings ("Guest checkout flow", "Try-on flow", "Data model (key tables)", "Sprint plan"), the timeline chart rows and gates are in `ganttSvg()`, and the cover text is near the end. Keep those headings when editing the markdown.

## Query the plan cheaply with the knowledge graph

`.claude/graph/graph.json` is a graphify graph of plan v2.3 + use cases (graphify 0.9.91, installed with pipx). Open `graph.html` in a browser, or ask graphify questions about it. Rebuild it after big plan changes (copy the plan and use-case markdown to a folder and run `/graphify <folder>`).

## Tools available on this Mac

- `graphify` skill (knowledge graphs), `ponytail` plugin (lean coding: smallest complete change, tests on risky logic), ECC plugin, document skills (docx), Postman plugin.
