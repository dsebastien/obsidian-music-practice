Everything Music Practice plays now sounds in a light room, and a hard strum is no longer cut flat. Four new settings in **Settings → Playback**, right after **Volume**, set the room or turn it off, and add an amplifier to the two electric guitars. The room and the amplifier come from music-notation 0.26.0, the library the plugin bundles. There's nothing to download: the room is computed as the notes play.

#### The room

- **Everything sounds in one room**: chord, keyboard and fretboard diagrams, strumming and picking patterns, progressions, chord charts, tabs and scores, the backing loop, **Play this chord or scale** and the note drill's sounds all play in the same small room. Before, the notes went straight to the speakers. The room is the same with the sound pack, the built-in soundfont and the light synthesizer.
- **Light by default**: the room sits 18 dB under the notes, so don't expect a big change. Listen at the end of a strum, or between two notes.
- **Loud strums are no longer cut flat**: after the room, the sound goes through a soft ceiling. Sound under 0.9 of full scale passes unchanged. Louder sound, like a hard strum on six strings or several things playing at once, bends toward full scale and never goes past it. It isn't a compressor.
- **Room level**: from 0 to 100, 12.5 by default. How loud the room is against the notes.
- **Room length**: how long the room rings, in seconds, from 0.2 (a small room) to 3 (a hall), 1.2 by default.
- **What doesn't change**: the metronome's click and the play-along recording don't go through the room.

#### Turn the room off

- **Room level at 0**: with no amplifier on either, the plugin plays exactly as before this release. No room, no ceiling, and no room is computed at all.
- **On a slow device**: if the sound stutters, set **Room level** to 0.
- **With an amplifier on**: at 0, the room is silent, but the ceiling stays.

#### The amplifier

- **For the two electric guitars**: **Amplifier cabinet** and **Amplifier drive** change only the **Clean electric** and **Overdriven electric** guitars, chosen in **Settings → Playback → Guitar sound**, with a note's `guitar_sound` property or with a block's `guitar:` line. The steel-string and classical guitars, the piano, and tabs and scores (which keep the instruments of their tracks) never go through it.
- **Off by default**: the cabinet is off and the drive is 0, so the electric guitars get no amplifier until you turn one on.
- **Amplifier cabinet**: a speaker cabinet's sound: less deep bass and less fizz, more mids.
- **Amplifier drive**: from 0 to 100, how hard the amplifier is driven. The drive is matched in level: more drive changes the tone, not the loudness.

#### When you hear a change

- **At the next Play**: a change of any of the four settings is heard at the next Play, and nothing on screen is drawn again. A diagram that loops takes it at its next pass. A tab or a score takes it when it starts to play: press Pause or Stop, then Play.

#### Other changes

- **In French too**: the new settings are translated. They read "Niveau de la reverb", "Durée de la reverb", "Baffle de l'ampli" and "Gain de l'ampli".
