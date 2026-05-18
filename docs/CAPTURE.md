# On-site capture integration map

How each capture method in the brainstorm plugs into Construct, and what's
actually buildable in the current Expo managed workflow vs. needs ejection.

## Status legend

- **Shipped** — endpoint + UI live, dev-fallback works zero-keys.
- **Endpoint only** — server accepts the data; mobile UI is the gap.
- **Needs native module** — requires `expo prebuild` (continuous native
  generation) and a custom Expo Module, or moving to bare React Native.

## Capture methods

| Method | Status | Server endpoint | Where the data lands |
|---|---|---|---|
| Voice walkthrough (Whisper) | Shipped | `POST /projects/:id/recordings` | `recordings` table |
| Voice dictation (build mode) | Shipped | `POST /projects/:id/dictation` | `tasks` + in-memory ledger via Claude tool use |
| Site photo → measurement | Endpoint only | `POST /projects/:id/measurements/photo` | `photo_measurements` table via Claude Vision |
| Drone imagery upload | Endpoint only | `POST /projects/:id/aerial/upload` | Replaces `survey.aerial_uri` |
| iPhone Pro Lidar (RoomPlan) | Needs native module | `POST /projects/:id/lidar/scan` (TODO) | Future `lidar_scans` table |
| Apple Vision Pro AR | Needs native module | Same as Lidar — Vision Pro uses RoomPlan + ARKit | Future `lidar_scans` |
| Meta Ray-Bans / Frame | Needs SDK | `POST /projects/:id/eyewear/capture` (TODO) | Routes voice into existing `/dictation` endpoint |

## What "needs native module" requires

Construct currently uses Expo's managed workflow. The capture methods that
need native modules need one of:

1. **`expo prebuild`** to generate `ios/` + `android/` projects, then add an
   Expo Module wrapping the native APIs (RoomPlan, Vision Pro spatial APIs,
   Meta's Wearable SDK). The Construct team can still develop in JS — the
   native module is a thin bridge.
2. **Bare React Native** (eject) — full control but loses Expo's OTA
   updates and managed build pipeline.

Option 1 is the recommended path: keep Expo, add native modules per capture.

## Lidar capture — the contract that's needed

When the RoomPlan native module lands, it'll POST a payload like:

```json
{
  "scan_id": "rp-<uuid>",
  "captured_at": "ISO timestamp",
  "wall_segments": [
    { "start": [x, y, z], "end": [x, y, z], "height_m": number }
  ],
  "openings": [
    { "type": "door|window", "start": [x,y,z], "end": [x,y,z] }
  ],
  "polygon_2d": GeoJsonPolygon
}
```

The server then uses `polygon_2d` to upgrade `survey.title_polygon` with
true millimetre-grade boundaries — replacing the bounding-box approximation
the Vicmap WFS gives today.

## Apple Vision Pro AR overlay

Once the Lidar capture is in, the Vision Pro app reads back the
`survey.title_polygon` + `survey.house_polygon` + `design.proposal.zones`
and renders the proposed layout overlaid on the operator's view. No new
server endpoints needed — the existing GETs serve.

## Meta Ray-Bans / Frame

Two routes possible:

- **Pass-through voice** — the eyewear app captures voice, transcribes
  locally or via its own pipeline, then POSTs the transcript text to
  `/projects/:id/dictation`. Construct doesn't need to know about the
  hardware.
- **First-party voice + image** — the eyewear app POSTs both the audio
  blob (to `/recordings`) and key frames (to `/measurements/photo`).
  Construct treats it like a phone client with a different form factor.

The first route ships today by giving the eyewear app the API URL and
a service token.

## DJI drone imagery

Shipped path: pilot exports orthomosaic JPEG/PNG from DJI Fly or third-party
software, then `POST /projects/:id/aerial/upload` from any client. Construct
overwrites the Mapbox satellite tile with the up-to-date drone image. No
direct DJI SDK integration required — file-based handoff is sufficient.
