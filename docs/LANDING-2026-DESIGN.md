# Landing 2026 — canvas-first marketing surface (design doc)

Status: **shipped spec** — `/` hero + `/settings` hub built on the real
Vicmap + Esri feeds (zero mock data). Screens can be produced in Stitch
from §4; the in-repo build (§5) implements this spec directly on the
Next.js + token stack.

## 1. Vision

One sentence: **open the site and you are looking at a frame from the
product, with the product's real data in it.**

The hero is not an illustration or a screenshot — it is the product's own
frame: a sub-metre aerial of the operator's home turf (City of Stonnington),
graded to dusk, one property lit, with a **real Vicmap title boundary**
drawn over it in the exact cobalt the studio draws title polygons. The
headline that sits on it — "Onsite sketch to fit sheet." — is a claim the
image itself proves, because the boundary was pulled from the live
Victorian cadastre, not drawn from memory.

## 2. Competitor + 2026 pattern synthesis

From the 2026 landing-pattern literature (SaaS Hero "Landing Page Design
Inspiration 2026", Design Key "SaaS Website Design Patterns 2026",
Landdding "State of Landing Pages 2026"):

1. **Product-as-hero** — the live UI replaces the marketing hero (Linear,
   Raycast, Arc). We extend it: the hero is the *canvas*, and its overlay
   is *live registry data*.
2. **Cinematic motion, not decoration** — choreographed entrances (fade +
   rise), a slow Ken Burns drift, and the boundary **drawing itself in**
   when the registry feed lands; motion signals product quality, never
   delays content.
3. **No blank states** — the low-res export paints instantly, the full
   frame fades over it, and copy is server-painted. The boundary draw-in is
   the only "loading" moment, and it is the centrepiece, not a spinner.
4. **One CTA, repeated intent** — primary "Enter your address"
   deep-links to `/home#new-project` (the composer gets focus); secondary
   "Open the studio". Desktop and mobile app links are labelled honestly —
   no fake store badges.

## 3. Architecture (tech answer)

Browser-based. No Electron, no shadcn, no new dependencies:

- **Next.js App Router + React 19** (existing) — the page is server-rendered
  with a deterministic keyless Esri World Imagery export (the same source
  the survey canvas drapes).
- **`GET /geo/hero` (API)** — public wrapper over the studio's own
  `fetchTitlePolygon` / `fetchBuildingPolygon` (Vicmap Property + Building,
  keyless GeoServer). The landing reads the same pipeline the studio does.
- **Motion** = CSS `@keyframes` + a `ResizeObserver`-driven SVG overlay
  (object-fit cover math) + IntersectionObserver reveals; no animation
  library. `prefers-reduced-motion` collapses everything to fades.
- **Settings** = `/settings` hub reading `/integrations/hub` (billing,
  channels, events, summary, license — real data).

## 4. Screen spec (for Stitch if used)

### 4.1 Landing — hero (100vh)

- **The frame.** Full-bleed aerial of a Stonnington block centred on
  1A Redcourt Avenue, Armadale (GNAF-verified pin), ~280 m × 169 m, slow
  Ken Burns (scale 1.00 → 1.07, 26 s alternate). CSS dusk grade: deep
  shadow, near-monochrome blue-grey; one property's dwelling re-lit with a
  warm blurred glow. Negative space dominates — the shadowed streets and
  unlit houses are canvas, not content.
- **The overlay.** The real title polygon drawn in `--gs-truth` title
  cobalt with luminous corner dots; draw-in stroke animation when the live
  feed lands. If the registry is unreachable the hero simply omits the
  overlay — never a fabricated polygon.
- **Top bar.** Workstream wordmark (Space Grotesk) + Stonnington DMS
  coordinate chip (JetBrains Mono) + "Open the studio" / "Settings".
- **Copy (bottom-left, fixed-light on the grade).**
  - Kicker: "1A Redcourt Avenue, Armadale · live registry boundary".
  - H1 (Fraunces, clamp 44–76): "Onsite sketch to fit sheet."
  - Body: "One title boundary, pulled from the live Victorian cadastre —
    not drawn from memory, not eyeballed, not fabricated. Every line you
    sketch, every elevation you trace, every plant you place sits on the
    one polygon that actually defines the site."
  - Flow: "Start with a title. Sketch onsite. Trace the street frontage
    from a photo calibrated against a 1.8 m fence line. Generate the fit
    sheet — all from the same boundary polygon, the single source of truth
    for everything that follows."
  - CTAs: "Enter your address" (Signal Blue pill → `/home#new-project`)
    + "Open the studio" (frost ghost → `/home`).
- **Choreography.** Server paint → low-res base (instant) → full frame
  fades (900 ms) → copy rises in staggered 150 ms steps → boundary draws
  itself in when live data lands.

### 4.2 Landing — below the fold

- **"One polygon, three moves."** Three paper cards — Title / Sketch
  onsite / Fit sheet — with scroll reveals (rise + blur-in, 90 ms stagger).
- **Honesty chips.** "Vicmap cadastre — keyless state data", "Sub-metre
  Esri aerial", and "Hero boundary — live registry polygon" when the feed
  landed.
- **Footer.** Brand line, desktop app link (this site), mobile field app
  (labelled "EAS build — store release pending"), Settings, "Melbourne,
  Victoria · en-AU". No fabricated ABN, no fake store badges.

### 4.3 Settings hub (`/settings`)

Paper cards over the canvas: Workspace (plan, seats, live channels, next
steps), License (product name + manage link → `/settings/license`),
Integrations (8 channel rows with Live / Configured / Not-set chips),
Recent events (last 8 from the hub), and an honesty footer: "Live from the
API — `/integrations/hub`".

## 5. In-repo build map

- `app/page.tsx` — server: aerial URLs + metadata; renders `<LandingCanvas>`.
- `components/landing/LandingCanvas.tsx` — client: boundary fetch,
  cover-crop overlay math, draw-in, reveals, parallax.
- `lib/landingGeo.ts` — bbox, projection, aerial URL, feed loader (pure
  math unit-tested).
- `app/landing.module.css` — tokens only (`--gs-*`, `--hero-*`, `--r-*`).
- `routes/geo-hero.ts` (API) — public title/building feed.
- `app/settings/page.tsx` + `settings.module.css` — settings hub.

## 6. Acceptance

- First paint with server copy + low-res base — no blank/loading state.
- The hero boundary is a live Vicmap polygon; failure omits it (never mock).
- `prefers-reduced-motion` collapses all animation to fades.
- Zero raw hex outside the token blocks (CI-gated); CSS Modules only.
- Desktop-first; 44 px targets on coarse pointers (repo law).
- Typecheck / lint / vitest / build green; landing + settings e2e pass.

## 7. Art direction — optional photographic pass

The in-repo hero is a real nadir aerial with a dusk grade. A true 45° tilt
render needs a photographic/AI pass; the agreed direction, verbatim:

> Aerial drone view, 45° tilt, of a leafy Melbourne suburban street at
> dusk — Stonnington period homes, rendered walls, pitched slate roofs,
> established plane trees canopying the nature strip. The entire scene is
> in deep shadow — silhouetted, near-monochrome, dark blue-grey. One
> single house in the centre is fully illuminated — warm golden interior
> light, roof catching the last light, alive against the darkness. Around
> this one house, a precise thin electric-blue line traces the property
> boundary — straight edges, corner vertices marked with small luminous
> dots, like a surveyor's overlay on reality. The boundary line is the
> only drawn element — no UI, no panels, no text, no chrome. Pure aerial
> photography with a single technical overlay. Cinematic, moody, extreme
> high contrast between the darkened neighbourhood and the one lit
> property with its glowing title polygon. Negative space dominates — the
> shadowed streets and unlit houses are canvas, not content. Shot on
> medium format, 80 mm, f/4, golden hour shadow transition, fine grain.

The boundary blue must be the product's title cobalt (`--gs-truth`,
#0030CF) so the frame reads as a product capture, not a stock photo with
a glow effect.
