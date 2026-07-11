# Dopa Pal — Audio Lab: Custom Mix & Persistent Player

Two features, one coherent extension. Neither introduces a new interaction model — both reuse patterns already built in the existing shop (cards, buy/equip/active states, localStorage persistence) and bubble (single-row control beside the Focus Mode toggle).

---

## Feature 1: Custom Sound Mixer

### What it is
Inside Audio Lab, a user can select two of their **owned** sounds, blend them at equal volume into a named custom mix, and save that mix as a reusable preset sitting alongside the regular Audio Lab cards. Mixes are first-class audio items — once saved, they appear in the Audio Lab shelf just like any individual sound, with play/stop control and an active state.

### Where it lives in the UI
A dedicated **"My Mixes"** subsection at the bottom of the Audio Lab shelf, below the individual sound cards. It has two parts:

1. **Mix builder card** — always visible at the top of "My Mixes," used to create a new mix
2. **Saved mix cards** — appear below the builder, one card per saved mix, same left-content/right-action layout as existing Audio Lab cards

---

### Mix builder card — element order

```
┌─────────────────────────────────────────────────┐
│  ✦  Create a Mix                                │
│                                                  │
│  [ Sound 1 ▾ ]        +        [ Sound 2 ▾ ]   │
│   (owned sounds only)           (owned sounds)   │
│                                                  │
│  Mix name: [___________________________]        │
│                                                  │
│                          [ Save & Play ]         │
└─────────────────────────────────────────────────┘
```

**Sound dropdowns** — show only owned sounds, in the same order they appear in the Audio Lab shelf. Locked/unowned sounds are never visible here, since you can't mix something you don't own. Selecting the same sound in both slots is blocked with an inline note: *"Pick two different sounds to mix."*

**Mix name field** — plain text input, max 24 characters, placeholder text: *"e.g. Rainy Focus"*. Required before saving — the Save & Play button stays disabled until both slots are filled and a name is entered.

**Save & Play button** — amber fill (matching Audio Lab's established color per the design system). On tap: saves the mix to localStorage + syncs to backend as a `shop_item` reward record of type `custom_mix`, then immediately starts playing it, and closes the builder back to its collapsed/idle state.

**Error states** (inline, never modal):
- Not enough owned sounds to mix (only 0 or 1 owned): builder card shows *"Unlock at least 2 sounds in the Audio Lab to start mixing."* — no dropdowns rendered, no CTA.
- Name already used: *"You already have a mix called that — pick a different name."*

---

### Saved mix card — structure
Identical layout to existing Audio Lab cards (left-content / right-action):

```
[mix icon]  Rainy Focus                [ ▶ Play ]
            Rain Desk + Deep Brown Noise
```

- **Icon**: a small "layers" or "blend" glyph — distinguishes mixes from single-source sounds at a glance
- **Name**: user-chosen, 24 char max
- **Description line**: always auto-generated as "Sound A + Sound B" — never editable separately, since the name field already carries the personalisation
- **Action button**: Play if not active, Stop if currently playing — same pattern as existing Audio Lab cards
- **Delete**: a small trash icon on the right edge of the card, only visible on hover/focus. Tap → inline confirmation: *"Remove Rainy Focus?"* with Confirm / Cancel — no modal. Deleting an active mix stops playback and returns to silence.

---

### Playback behaviour of mixes
- Both sounds play simultaneously at equal volume — no per-track slider, no crossfade, no dynamic adjustment. Simple blend is the entire mechanic.
- Mix playback respects the same playback mode (loop/auto-cycle/manual pick) already set by the user for regular Audio Lab sounds — no separate mode for mixes.
- A playing mix counts as "one active sound" for the purposes of the 2-simultaneous-sounds layering limit already proposed in the Shop Expansion doc — a mix is already two sounds; stacking a third on top would exceed that limit and is blocked with the same swap behaviour (oldest active stops).

---

### Data model additions
Minimal — reuses existing reward record structure:

```
reward record type: "custom_mix"
metadata: {
  name: "Rainy Focus",
  sound_a: "rain_desk",       // item key from SHOP_ITEMS
  sound_b: "deep_brown_noise",
  created_at: ISO timestamp
}
```

localStorage key: `dopaPal_customMixes` → array of mix objects in the same shape.
Reads/writes happen in the same place as the existing audio state persistence (`Dashboard.jsx:862` area).

---

## Feature 2: Persistent Mini-Player

### What it is
A small, always-visible audio control bar that appears on **every page and every window** in the system (both the Dashboard and the Bubble) whenever audio is actively playing. It shows the current sound/mix name and gives the user three controls — pause/play, skip to next owned sound, and stop — without navigating anywhere.

This directly solves the friction of "I need to go back to the Shop to change or stop the sound." The user stays in their task.

---

### Bubble: mini-player placement
Sits in the same row as the Focus Mode toggle (§5.3, item 9 of the UI/UX system design) — a single speaker icon that expands slightly on hover/focus to reveal the track name and stop control.

**Collapsed state** (default — always visible when audio is playing):
```
🔊  Rainy Focus   ■
```
- 🔊 speaker icon (amber fill when playing, outline when paused)
- Track/mix name — truncated to ~18 chars with ellipsis if longer
- ■ stop button — square, same muted style as the collapse (×) button on the card

**No play/skip control on the Bubble.** The Bubble's audio row does one thing: confirms what's playing and lets you stop it. Changing or skipping is a Dashboard action — this keeps the Bubble from accumulating a second set of complex controls.

**When nothing is playing**: the row is hidden entirely. Not greyed out, not a disabled state — just absent. An idle Bubble has no audio row at all.

---

### Dashboard: mini-player placement
A slim persistent bar docked to the **bottom of the sidebar**, above the sidebar's bottom edge, visible on all three Dashboard views (Task Map, Shop, Integrations):

```
┌──────────────────────────────┐
│ 🔊 Rainy Focus    ⏮  ▶  ■  │
└──────────────────────────────┘
```

**Controls:**
| Icon | Action |
|---|---|
| 🔊 | Amber when playing, outline when paused — tap to toggle pause/play |
| Track name | Tappable — navigates directly to the Audio Lab section of the Shop, so the user can change the sound without hunting for it |
| ⏮ | Previous owned sound / mix in the list (wraps around) |
| ▶ / ⏸ | Play / Pause |
| ■ | Stop entirely — returns to silence, hides the player bar |

The previous/next (⏮) control **skips through owned sounds and saved mixes in order** — same order they appear in the Audio Lab shelf, mixes included. This makes the sidebar player a lightweight way to cycle sounds without opening the Shop page at all.

**When nothing is playing**: the bar collapses to a single muted line showing *"No sound playing"* with a small play icon — tapping it navigates to Audio Lab, same as the track name tap above. It never disappears entirely on the Dashboard (unlike the Bubble), because the Dashboard is the deliberate macro-view surface and a persistent audio entry point belongs there.

---

### State sync between Bubble and Dashboard
- Audio state lives in one place: the existing localStorage key + app state layer (`Dashboard.jsx:862`)
- Both windows read from and write to the same state — if the user stops audio from the Bubble, the Dashboard sidebar player immediately reflects silence, and vice versa
- If the Dashboard window is closed and the Bubble is open, audio keeps playing — the Bubble's stop button is the only available control in that case, which is correct behaviour

---

## Visual rules (consistent with existing design system)

- **Amber** throughout both the mixer and mini-player — Audio Lab's established category color in the design system. No new color is introduced.
- **Mix icon** (layers/blend glyph): simple line icon only, same stroke weight as existing Audio Lab card icons.
- **Mini-player on Bubble** follows the existing motion rule: the expand from icon→name+stop on hover is a ~150ms opacity/width fade — no bounce, no scale pop. The animation budget on the Bubble is already fully spent by the State Score dot.
- **Mini-player on Dashboard sidebar** uses no animation at all — it's a static docked bar. It doesn't slide in when audio starts; it's always structurally present in the sidebar layout, just showing different content (playing state vs. "no sound playing").

---

## Guardrails

- **Mixes only use owned sounds** — locked items are never exposed in the dropdowns, even as disabled/greyed options. Seeing a locked sound in the mixer would be a purchase prompt in disguise, which breaks the "low-friction browsing, no pressure" shop UX.
- **Mix names are private and local** — never shown to other users, never part of any leaderboard or shared state. A mix name is a personal label, same as a custom playlist name in any offline music app.
- **The Bubble's mini-player never grows controls beyond stop.** Any future idea to add a track-picker, volume slider, or next/prev to the Bubble row should be redirected to the Dashboard sidebar player instead — the Bubble must never become a second control surface with its own audio management UI.
- **Deleting a mix that is currently playing stops playback immediately** — never leaves the system in an undefined "playing something that no longer exists" state.
- **Maximum saved mixes: 10.** Past that, the Save & Play button is replaced with *"Mix limit reached — delete a mix to save a new one."* This isn't a technical limitation so much as a UX one: an unbounded list of mixes would eventually make the "My Mixes" shelf longer than the rest of the Audio Lab, which would bury the individual sound cards above it.
