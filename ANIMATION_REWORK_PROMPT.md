# Wake Up & Produce Animation Rework Handoff Prompt

You are working on the static HTML/CSS/vanilla JS site `WakeUpandProduce` at `/Users/macbax/WakeUpandProduce`.

Important constraints:
- Plain HTML/CSS/JavaScript only.
- No framework, no npm, no build tools, no external dependencies that require a build step.
- Each route is a folder with its own self-contained `index.html`.
- Shared nav/footer are injected inline at the bottom of each `index.html` using `document.querySelector` and `innerHTML`.
- Keep the visual style aligned with `/offense-guide/index.html`.

Primary task:
Rework all basketball court animations so they are basketball-correct, readable, and consistent with the visual key.

Current problem:
The animation engine can move smoothly, but many animations are not logically correct. Players and ball movement are coded as raw coordinates, so actions are hard to audit and sometimes do not match basketball concepts. The key also had inconsistent route language.

Target animation behavior:
1. The court starts on a readable setup state.
2. `Show Sequence` reveals numbered route/teaching lines step-by-step.
3. `Play Animation` runs smooth player and ball movement.
4. Ball ownership must make sense. The ball should stay with the handler until a pass/handoff/shot changes possession.
5. Movement must match the key and basketball convention.

Visual key rules:
- Pass: gold dashed line with arrow.
- Dribble/drive: orange squiggly path with arrow.
- Cut/fill/player movement: gray dashed path with arrow.
- Screen: solid black line with a T/bar, no arrow.
- Defensive trap: blue dashed path.
- Defensive chase: red dashed path.
- Defensive switch: green solid path.

Best implementation direction:
Move away from opaque raw-coordinate animation data and toward named basketball spots and step-based actions.

Preferred data shape:
```js
const SPOTS = {
  top: [50, 18],
  leftWing: [20, 30],
  rightWing: [80, 30],
  leftCorner: [20, 70],
  rightCorner: [80, 70],
  rim: [50, 78],
  leftElbow: [38, 46],
  rightElbow: [62, 46],
  leftBlock: [34, 66],
  rightBlock: [66, 66]
};
```

Preferred action shape:
```js
{
  id: 'passcut',
  title: 'Pass & Cut',
  desc: '...',
  setup: {
    players: { p1: 'top', p2: 'leftWing', p3: 'rightWing', p4: 'leftCorner', p5: 'rightCorner' },
    ball: 'p1'
  },
  steps: [
    { type: 'pass', from: 'p1', to: 'p2', label: '1 passes to 2' },
    { type: 'cut', player: 'p1', to: 'rim', label: '1 cuts hard to the rim' },
    { type: 'fill', player: 'p1', to: 'rightCorner', label: '1 exits to the empty corner' },
    { type: 'fill', player: 'p3', to: 'top', label: '3 fills the top' },
    { type: 'fill', player: 'p5', to: 'rightWing', label: '5 fills the wing' }
  ]
}
```

The code can translate these named steps into frames/routes. This lets a coach read and correct the animation without decoding coordinates.

Recommended rollout:
1. Start with `/offense-guide/index.html`.
2. Rebuild Read & React `Pass & Cut` first as the reference animation.
3. Verify `Show Sequence` and `Play Animation` match the same action.
4. Convert the rest of Read & React one-by-one.
5. Then convert Grinnell and Traditional Motion.
6. Then apply the same pattern to `/offensive-key-actions/index.html`.
7. Then apply the same pattern to `/defense-guide/index.html`.

Do not batch-rewrite every animation blindly. Do one animation at a time and verify the basketball logic.

Current relevant files:
- `/Users/macbax/WakeUpandProduce/styles.css`
- `/Users/macbax/WakeUpandProduce/offense-guide/index.html`
- `/Users/macbax/WakeUpandProduce/offensive-key-actions/index.html`
- `/Users/macbax/WakeUpandProduce/defense-guide/index.html`

Verification:
- Run an inline script syntax check after every meaningful edit.
- Open the relevant local HTML page and inspect the selected action visually.
- Do not commit unless explicitly asked.
