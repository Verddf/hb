# Kiko's Quest

A classic-style 2D side-scrolling platformer written in plain JavaScript and
the HTML5 canvas: no frameworks, no build step, no image or audio files. All
sprites are pixel art drawn in code, and all sound effects and music are
synthesised with the Web Audio API.

You play **Kiko**, a young explorer in a cat-eared hood and a long orange
scarf, racing across the Hoodlands to win back the Sunstone from **Magmaw**,
a horned lava toad.

## Play

Open `index.html` in any modern browser. That's it.

If your browser blocks local files, serve the folder instead:

```sh
python3 -m http.server 8000    # then visit http://localhost:8000
```

Add `?level=3` to the URL to start at a later stage (for example
`index.html?level=4` jumps straight to the castle), or `?debug` to show
hitboxes.

### Controls

| Action          | Keyboard                      | Gamepad        | Touch      |
| --------------- | ----------------------------- | -------------- | ---------- |
| Move            | Arrow keys / A, D             | D-pad / stick  | ◀ ▶        |
| Jump            | Z / Space / Up / W / K        | A              | A          |
| Run / fireball  | X / Shift / J                 | B / X          | B          |
| Crouch          | Down / S                      | Down           | ▼          |
| Pause           | P / Esc                       | Start          | II         |
| Mute            | M                             |                |            |

Hold jump for a higher jump and tap it for a short hop. Hold run to sprint:
running jumps go higher and farther.

## What's in the game

- **Four stages** with distinct themes, music and hazards:
  1. *Meadow Run*: pipes, blocks, stairs, a hidden 1-up
  2. *Crystal Caverns*: low ceilings, pipe plants, moving platforms, spikes
  3. *Skyward Bridges*: floating islands, one-way clouds, flying enemies
  4. *Ember Keep*: lava pits, fire bars, leaping lava bubbles and a boss fight
- **Power-ups** from `?` blocks: the *Sunberry* makes Kiko big (survives a
  hit, breaks bricks), the *Ember Bloom* adds fireballs, the *Starfruit*
  gives ten seconds of invincibility, and *hearts* give an extra life.
- **Enemies**: Grumbles (stomp them), Shellsnails (their shells can be kicked
  into other enemies), Buzzbees (flying), Prickles (spiky, don't stomp!),
  Snapvines (pipe plants), fire bars, lava bubbles and the boss Magmaw.
- **Scoring**: coins (100 coins = 1-up), stomp combos, flagpole height bonus
  and a time bonus. The top score is saved in the browser.
- **Win/lose**: reach the flagpole to clear a stage; defeat Magmaw and grab
  the Sunstone to win. Enemies, pits, lava, spikes and the timer cost a life,
  and checkpoints save your progress within a stage. Lose all lives and it's
  game over.

## How the movement works

Movement uses a fixed 60 Hz simulation step so it behaves the same on every
display. The tuning values live in `PHYS` in `js/util.js`:

- Acceleration and friction instead of instant velocity, with a hard **skid**
  when you reverse direction on the ground.
- **Variable jump height**: light gravity while rising with jump held, heavy
  gravity once jump is released, medium gravity when falling.
- **Coyote time** (you can still jump just after walking off a ledge) and
  **jump buffering** (a jump pressed just before landing still counts).
- **Corner correction**: clipping a block's corner by a few pixels nudges
  Kiko around it instead of stopping the jump.

## Project layout

```
index.html          page, canvas and touch controls
style.css           layout and on-screen button styling
js/util.js          constants, physics tuning, small helpers
js/font.js          5x7 bitmap font
js/audio.js         synthesised sound effects and chiptune music
js/input.js         keyboard, touch and gamepad input
js/sprites.js       pixel-art sprites (Kiko, enemies, items)
js/tiles.js         themes, tile art and parallax backgrounds
js/levels.js        level builder and the four stage layouts
js/level.js         tile map, rendering and tile collision
js/player.js        Kiko's controller and animation
js/enemies.js       enemy behaviours and the boss
js/items.js         power-ups, fireballs, moving platforms, effects
js/game.js          game states, interactions, HUD and screens
js/main.js          startup and the main loop
tests/              level data checks and browser gameplay tests
```

Scripts are plain `<script>` tags (not ES modules), so the game also runs
straight from the file system.

## Making levels

Each stage in `js/levels.js` is a list of builder calls using tile
coordinates. The screen is 15 rows tall, row 0 is the top and the ground
surface is row 13:

```js
{
  name: 'MY STAGE', theme: 'meadow', time: 300, width: 120,
  tip: 'SHOWN ON THE INTRO CARD',
  build(b) {
    b.start(3);                  // Kiko's start column
    b.ground(0, 40);             // ground from column 0 to 40
    b.row(10, 9, 'B?BMB');       // bricks, coin and power-up blocks
    b.pipe(18, 3, true);         // 3-tall pipe with a Snapvine
    b.enemy('grumble', 24);
    b.platform(42, 10, 3, 'h', 4, 1.2);  // moving platform over a gap
    b.ground(50, 119);
    b.stairs(100, 5, 'up');
    b.flag(110);
    b.castle(114);
  },
}
```

Themes are `meadow`, `cave`, `sky` and `castle`. See the comment at the top of
`js/levels.js` for every tile type and builder method.

## Tests

```sh
npm test
```

- `tests/levels.test.js` checks the level data with no dependencies: grid
  sizes, safe start positions, a flagpole or boss at the end, pipe shapes and
  spawn placement.
- `tests/gameplay.test.js` runs the real game in headless Chromium, pauses
  its loop and steps the simulation frame by frame to check jumping, running,
  blocks, power-ups, stomps, shells, fireballs, platforms, hazards,
  checkpoints, the flagpole, the boss and game over. It needs Playwright
  (`npm install`, then `npx playwright install chromium` if no browser is
  installed) and skips itself otherwise.
