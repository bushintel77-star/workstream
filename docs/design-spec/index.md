# Design spec screenshot index

This index maps each captured screenshot to its page and intended design state.

Source folder: `docs/design-spec/screenshots/`

## Desktop web pages and states

| File | Route / area | State |
| --- | --- | --- |
| `web-01-landing.png` | `/` | Public landing page |
| `web-02-home.png` | `/home` | Project register + planner shell |
| `web-03-project-canvas.png` | `/projects/[id]` | Main canvas view |
| `web-04-processing.png` | `/projects/[id]/processing` | Pipeline processing screen |
| `web-05-recordings.png` | `/projects/[id]/recordings` | Voice recordings surface |
| `web-06-audit.png` | `/projects/[id]/audit` | Audit utility surface |
| `web-07-outputs.png` | `/projects/[id]/outputs` | Outputs generation surface |
| `web-08-carbon.png` | `/projects/[id]/carbon` | Carbon utility surface |
| `web-09-filing.png` | `/projects/[id]/filing` | Filing page |
| `web-10-measurements.png` | `/projects/[id]/measurements` | Measurements page |
| `web-11-canvas-survey-mode.png` | `/projects/[id]?mode=survey` | Survey mode |
| `web-12-canvas-cad-mode.png` | `/projects/[id]?mode=cad` | CAD mode |
| `web-13-canvas-quote-mode.png` | `/projects/[id]?mode=quote` | Quote mode |
| `web-14-canvas-share-mode.png` | `/projects/[id]?mode=share` | Share mode |
| `web-15-not-found-state.png` | `/projects/[invalid-id]` | Not-found/error state |
| `web-16-processing-invalid-state.png` | `/projects/[invalid-id]/processing` | Invalid processing/error state |
| `web-17-canvas-fit-sheet.png` | `/projects/[id]?mode=cad` | Fit sheet toggled on |
| `web-18-canvas-command-palette.png` | `/projects/[id]?mode=cad` | Command palette open |

## Mobile preview pages and states

| File | Route / area | State |
| --- | --- | --- |
| `mobile-01-preview-home.png` | `http://localhost:8083/` | Mobile preview default portrait |
| `mobile-02-preview-open.png` | `http://localhost:8083/` | Mobile preview interactive/open state |
| `mobile-03-preview-landscape.png` | `http://localhost:8083/` | Mobile preview landscape viewport |

## Notes for design handoff

- Primary reference for canvas behavior: `web-03` + `web-11` through `web-18`.
- Primary reference for utility/detail surfaces: `web-04` through `web-10`.
- Error-state styling references: `web-15`, `web-16`.
- Mobile visuals in this batch are web preview captures (Expo web), useful for layout/tone reference.
