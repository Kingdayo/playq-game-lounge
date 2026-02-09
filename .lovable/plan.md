

# Fix Voice Chat Audio Routing for Bluetooth/External Audio Devices

## Problem
When a user connects Bluetooth headphones, earbuds, or other external audio devices, voice chat audio is not heard through those devices. This happens because:

- Remote audio playback is routed entirely through the Web Audio API (`AudioContext`), which on many mobile browsers does not automatically follow Bluetooth/external audio output changes.
- The hidden `<audio>` elements exist but have `volume = 0`, so they produce no audible output on their own.
- There is no device-change detection or `sinkId` handling.

## Solution

### 1. Use `<audio>` elements as the primary playback method (not AudioContext)

Instead of routing remote streams through `AudioContext.destination` for playback and keeping `<audio>` elements silent, we will:

- Set `<audio>` elements to the user's chosen volume (not 0) so they handle actual audio output. HTML `<audio>` elements properly follow system audio routing on all platforms including Bluetooth.
- Keep `AudioContext` only for voice activity detection (analyser nodes), but do NOT connect remote sources to `masterGain -> destination`.

**Changes in `VoiceContext.tsx`:**

- **`AudioElement` component (lines 51-88):** Update to accept a `volume` prop (0-1 range) and set `audioRef.current.volume` to that value instead of 0. Remove the override that forces volume to 0.
- **`setupAudioSystem` function (lines 150-223):** When `isRemote` is true, stop connecting `source` to `masterGainRef` (remove line 174). The analyser connection remains for speaking detection.
- **`setVolume` callback (lines 547-552):** In addition to updating `masterGainRef` (which now only affects local monitoring if needed), store volume in state so `AudioElement` components re-render with the new volume.
- **Rendered `AudioElement` instances (lines 622-629):** Pass the current volume as a prop.

### 2. Handle audio output device changes

- Add a `navigator.mediaDevices.ondevicechange` listener that detects when audio devices are added/removed (e.g., Bluetooth connects/disconnects).
- When a device change is detected, attempt to set `sinkId` on all `<audio>` elements to the default output device (browsers that support `setSinkId`).
- Resume the `AudioContext` if it was suspended due to the device change.

### 3. Re-create AudioContext on device change if needed

Some browsers suspend or break the `AudioContext` when Bluetooth connects. We will:
- Listen for `statechange` on the `AudioContext`.
- If the context enters `suspended` or `closed` state unexpectedly, attempt to resume or re-create it and re-attach analyser nodes.

## Technical Details

### Files to modify

**`src/contexts/VoiceContext.tsx`** -- all changes are in this single file:

1. **`AudioElement` component**: Add `volume` prop, apply it to the audio element, and add `setSinkId` support for device routing.

2. **`setupAudioSystem`**: Remove `source.connect(masterGainRef.current)` for remote streams (line 174). Keep analyser connection for VAD only.

3. **`setVolume`**: Continue updating state; the `AudioElement` will reactively pick up the new volume.

4. **Add device change listener**: Inside the `VoiceProvider`, add a `useEffect` that listens on `navigator.mediaDevices.addEventListener('devicechange', ...)` and attempts to update `sinkId` on audio elements plus resume AudioContext.

5. **Render `AudioElement` with volume**: Pass `volume={volume / 100}` to each `AudioElement`.

6. **Add AudioContext statechange handler**: Auto-resume if context gets suspended after a device switch.

