# Mall of the Dead — Online Co-op (V41 overhaul)

Same mall, same four survivors, same voices and radio. Everything else got levelled up.

## Run it

1. Install Node.js 18 or later.
2. In this folder: `npm install`, then `npm start`.
3. Open `http://localhost:3000`.

Solo also works by just opening `index.html`. Online co-op needs the server.

## Play together

- **Same Wi-Fi:** one person runs `npm start`; the terminal prints a `http://192.168.x.x:3000` address. Everyone opens that.
- **Different networks:** deploy this folder as a Node web service on any host that supports WebSockets (Render, Railway, Fly.io and similar). Build command `npm install`, start command `npm start`. Everyone opens the URL the host gives you. Keep it to a single instance: rooms live in memory.
- In the game: **HOST ONLINE ROOM**, then **COPY INVITE LINK** and send it. Friends open the link, pick a survivor and press JOIN. Up to 4 players.
- Friends can also join a run that has already started (drop-in), and if the host quits, another player's browser takes over and the run continues.

## Controls

| | PC | Phone | Gamepad |
|---|---|---|---|
| Move | WASD / arrows | left thumb anywhere | left stick |
| Aim + fire | mouse + click | right thumb anywhere | right stick + RT |
| Reload | R | RELOAD | X |
| Switch gun | Q, wheel, 1-6 | GUN | Y |
| Grenade | G / right-click | NADE | RB |
| Dash (brief invulnerability) | Shift / Space | DASH | A |
| Use door / radio, hold to revive | E | USE | B |
| Pick a perk | 1-3 | tap the card | d-pad |
| Pause / menu, mute | Esc or P, M | buttons | Start |

## What is new in V41

**Gameplay**
- 3 new guns (Launcher, Flamer, Railgun) on top of AR, LMG and Shotgun. Kill the crate carrier to unlock a gun for the whole team.
- Perk draft after every wave: 13 stackable perks.
- 4 new zombies: crawlers, bloaters (explode), spitters (acid), riot zombies (shielded from the front).
- Second boss: Zombie Santa on waves 10, 20, ... (gift bombs, elf helpers). The Giant gained a charge attack.
- Grenades, a dash with invulnerability frames, explosive barrels, power-up drops (double damage, rapid fire, nuke, grenades, health).
- Score, kill combos and saved best run.
- Nick's Office is no longer a permanent safe room: zombies break the door down.
- Zombies now path to the nearest survivor (not only the host) and spread out instead of stacking.

**Look and feel**
- Dynamic lighting: flashlights, muzzle flashes, tree and shop glow, fire.
- Persistent blood, corpses and scorch marks, shell casings, tracers, damage numbers, screen shake, low-health pulse.
- New HUD: health bar, weapon slots, minimap, boss bar, teammate bars, off-screen pointers.

**Online**
- Guests move with zero input lag (local movement), everything else is interpolated between 20 Hz snapshots.
- Guests now hear and see what the host does: shots, explosions, voices, the radio.
- Drop-in joining, host migration, return-to-lobby after a game over, invite links, ping display.
- Team size scales the horde and boss health. Downed players get back up when the wave is cleared.
- Server: gzip, rate limiting, payload caps, dead-connection sweep, `/healthz`.

**Phone**
- Floating twin sticks with aim assist, dedicated buttons, optional auto-fire, fullscreen, automatic resolution scaling.

## Developing

`index.html` is generated. Edit the files in `src/` (and the clips in `assets/`), then run `npm run build`.

In the browser console, `MOTD.bot(true)` turns on an autopilot, `MOTD.spawn('santa')` spawns any enemy type, `MOTD.give('nuke')` drops a pickup. Settings has a "start at wave" test option.

## Limitations

- The host's browser still runs the simulation: guests depend on the host's connection. If the host's tab is in the background the game keeps running from a timer, but a phone that locks its screen will stall the room until migration kicks in on disconnect.
- Perks earned are lost if you disconnect and drop back in.
- Not hardened for a public release: no accounts, and a modified client could cheat.
