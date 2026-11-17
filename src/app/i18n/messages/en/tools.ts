/** English texts of the tools area (the source; keys are `tools.*`). */
export const toolsEn = {
    // Section name (play-along)
    'tools.section.title': 'Add a section',
    'tools.section.nameLabel': 'Section name',

    // Choose a chord reading
    'tools.chooseChord.placeholder': 'These notes can be read several ways: pick one',

    // Text tab and chord sheet import
    'tools.import.tabTitle': 'Import a text tab',
    'tools.import.sheetTitle': 'Import a chord sheet',
    'tools.import.tabHelp':
        'Paste a tab (lines of dashes and frets, one per string). It becomes a tab block you can play. Text tabs have no exact rhythm, so the rhythm comes from the spacing.',
    'tools.import.sheetHelp':
        'Paste a chord sheet (chords on their own line above the lyrics). It becomes a chord chart you can transpose.',
    'tools.import.insert': 'Insert',
    'tools.import.nothing': 'Nothing in this text could be converted.',
    'tools.import.modePlaceholder': 'How should the score go into the note?',
    'tools.import.modeLink': 'Link to the file',
    'tools.import.modeInline': 'Inline alphaTex',
    'tools.import.modeLinkHelp': 'The file goes to your attachments folder; nothing is lost.',
    'tools.import.modeInlineHelp':
        'The music as text in the note, which you can edit; some details of the file may be lost.',

    // Chord changes of a chart
    'tools.changes.title': 'Chord changes: {name}',
    'tools.changes.intro':
        'Hardest first: how much the hand moves between the two chords, then how often the song plays the change.',
    'tools.changes.times.one': '{count} time',
    'tools.changes.times.other': '{count} times',
    'tools.changes.effortUnknown': 'effort unknown',
    'tools.changes.effort': 'effort {effort}',
    'tools.changes.best': 'best {best} a minute',
    'tools.changes.and': ' and ',
    'tools.changes.noNote': 'No chord note for {chords}: add one to drill this change.',
    'tools.changes.drill': 'Drill',

    // Key and scales of a piece
    'tools.pieceKey.title': 'Key and scales: {name}',
    'tools.pieceKey.chords': 'Chords: {chords}',
    'tools.pieceKey.key': 'Key: {key}',
    'tools.pieceKey.keyBlues': 'Key: {key} (blues)',
    'tools.pieceKey.noKey': 'No key found',
    'tools.pieceKey.notClear': 'Not clear: {keys} fit about as well.',
    'tools.pieceKey.or': ' or ',
    'tools.pieceKey.outside': 'Outside the key: {chords}',
    'tools.pieceKey.scales': 'Scales that fit',
    'tools.pieceKey.scaleOutside': '{name} (outside: {chords})',
    'tools.pieceKey.isKey': 'Key is {key}',
    'tools.pieceKey.setKey': 'Set the key to {key}',
    'tools.pieceKey.keySet': 'Key set to {key}.',

    // Identify this chord
    'tools.identify.title': 'Identify this chord',
    'tools.identify.helpGuitar':
        'Click a string at a fret to play it there; click it again to mute the string.',
    'tools.identify.helpPiano': 'Click the keys of the chord; click a key again to take it away.',
    'tools.identify.ways': 'This chord reads {count} ways: pick one.',
    'tools.identify.is': 'This is {symbol}.',
    'tools.identify.nameIt': 'Name it {symbol}',
    'tools.identify.nameSays': "The note's name says {name} ({symbol}).",
    'tools.identify.nameSaysShape':
        "The note's name says {name} ({symbol}), with the shape {shape}.",
    'tools.identify.nameFromName': "Name it {symbol}, from the note's name",
    'tools.identify.failed': "Couldn't name the chord: {message}",
    'tools.simplify.title': 'Simplify this chart: {name}',
    'tools.simplify.chart': 'Chart',
    'tools.simplify.chartN': 'Chart {n}',
    'tools.simplify.easier': 'Easier chords: {chords}',
    'tools.simplify.noEasier': 'No chord of this chart has an easier one.',
    'tools.simplify.capo': 'Best capo: fret {capo}. Play {shapes} ({open} of {total} open shapes).',
    'tools.simplify.noCapo': 'No capo does better than none.',
    'tools.simplify.ownCapo':
        'This chart has its own capo (fret {capo}): its chords are the shapes already.',
    'tools.simplify.piano': 'Easier chords and the best capo are for guitar charts.',
    'tools.simplify.switchOn': 'Switch on in the chart',
    'tools.simplify.alreadyOn': 'Already on in the chart',
    'tools.simplify.insertCopy': 'Insert a simpler copy',
    'tools.simplify.switched': 'The chart now draws its easier version.',
    'tools.simplify.inserted': 'A simpler copy is below the chart.',
    'tools.simplify.changed': 'The chart changed since: run the command again.',

    // Tab exercise
    'tools.exercise.title': 'Tab exercise: {name}',
    'tools.exercise.position': 'Position',
    'tools.exercise.direction': 'Direction',
    'tools.exercise.rhythm': 'Rhythm',
    'tools.exercise.tempo': 'Tempo (BPM)',
    'tools.exercise.upDown': 'Up and down',
    'tools.exercise.up': 'Up',
    'tools.exercise.down': 'Down',
    'tools.exercise.eighths': '8th notes',
    'tools.exercise.triplets': 'Triplets',
    'tools.exercise.sixteenths': '16th notes',
    'tools.exercise.help':
        'The tab plays with the count-in, the metronome and the speed control of its player bar.',
    'tools.exercise.insert': 'Insert',
    'tools.exercise.cagedShape': '{letter} shape',
    'tools.exercise.box': 'Box {n}',
    'tools.exercise.nps': '3NPS {n}',

    // Voicings of a chord
    'tools.voicings.title': 'Voicings of {symbol}',
    'tools.voicings.titleChord': 'Voicings of a chord',
    'tools.voicings.chord': 'Chord',
    'tools.voicings.chordPlaceholder': 'Am7',
    'tools.voicings.orClick': 'Or click the frets of the chord:',
    'tools.voicings.neck': 'Neck',
    'tools.voicings.rootOn': 'Root on',
    'tools.voicings.anyString': 'Any string',
    'tools.voicings.string6': '6th string',
    'tools.voicings.string5': '5th string',
    'tools.voicings.string4': '4th string',
    'tools.voicings.inversions': 'Inversions',
    'tools.voicings.stretch': 'Stretch',
    'tools.voicings.areaAll': 'Whole neck',
    'tools.voicings.areaOpen': 'First position',
    'tools.voicings.areaFrets': 'Frets {from}–{to}',
    'tools.voicings.baseFret': '{fret}fr',
    'tools.voicings.typeChord': 'Type a chord to see every way to play it.',
    'tools.voicings.none': 'No voicing fits: widen the neck area, allow inversions or a stretch.',
    'tools.voicings.easiest': 'The {shown} easiest of {total}, easiest first.',
    'tools.voicings.count.one': '{count} voicing, easiest first.',
    'tools.voicings.count.other': '{count} voicings, easiest first.',
    'tools.voicings.dashed': "Dashed: this note's voicing.",
    'tools.voicings.labelCurrent': '{label} (this note)',
    'tools.voicings.useThis': 'Use this voicing',
    'tools.voicings.useForNote': 'Use for this note',
    'tools.voicings.addAsNote': 'Add as note',
    'tools.voicings.isCurrent': "This is this note's voicing.",
    'tools.voicings.conflictOwnOther':
        'This note is the {own} shape: add the {other} as its own note.',
    'tools.voicings.conflictOwn': 'This note is the {own} shape: add this voicing as its own note.',
    'tools.voicings.conflictOther': 'This note is another shape: add the {other} as its own note.',
    'tools.voicings.conflictNone': 'This note is another shape: add this voicing as its own note.',

    // Triads
    'tools.triads.title': 'Triads',
    'tools.triads.ofA': 'Of a',
    'tools.triads.chord': 'Chord',
    'tools.triads.key': 'Key',
    'tools.triads.chordOrKey': 'Chord or key',
    'tools.triads.strings': 'Strings',
    'tools.triads.inversion': 'Inversion',
    'tools.triads.all': 'All',
    'tools.triads.rootPosition': 'Root position',
    'tools.triads.firstInversion': '1st inversion',
    'tools.triads.secondInversion': '2nd inversion',
    'tools.triads.nameRoot': 'root position',
    'tools.triads.nameFirst': '1st inversion',
    'tools.triads.nameSecond': '2nd inversion',
    'tools.triads.typeChordOrKey': 'Type a chord (G, A Minor) or a key (G major).',
    'tools.triads.typeKey': 'Type a key: G major, E minor.',
    'tools.triads.noneForKey': 'No triads for this key on these strings.',
    'tools.triads.notChord': '"{text}" isn\'t a chord the library knows.',
    'tools.triads.noTriads':
        '{symbol} has no triads here: it needs three notes (G, Am, Bdim, Caug, Dsus4).',
    'tools.triads.count.one': '{count} triad on strings {set}, up the neck. Dots show R, 3, 5.',
    'tools.triads.count.other': '{count} triads on strings {set}, up the neck. Dots show R, 3, 5.',
    'tools.triads.metronome': 'Metronome',
    'tools.triads.useThis': 'Use this triad',
    'tools.triads.addAsNote': 'Add as note',

    // Easiest way from one chord to the next
    'tools.transition.title': 'Easiest way: {from} → {to}',
    'tools.transition.help':
        'Fingers that stay have a ring, fingers that slide a dashed ring. The easiest first.',
    'tools.transition.noFrets': '{name} has no frets to start from.',
    'tools.transition.held': '{symbol}, held',
    'tools.transition.thisNote': '{symbol}, this note',
    'tools.transition.reverse': 'Other way round',
    'tools.transition.addAsNote': 'Add as note',

    // Smooth a progression
    'tools.progression.title': 'Smooth this progression',
    'tools.progression.none': 'No playable voicings for these chords.',
    'tools.progression.help':
        '{chords}: the voicings that make the whole progression easiest. Fingers that stay have a ring, fingers that slide a dashed ring.',
    'tools.progression.inNotes': 'In your notes: {note}',
    'tools.progression.notYet': 'Not in your notes yet',
    'tools.progression.addMissing.one': 'Add {count} missing voicing as notes',
    'tools.progression.addMissing.other': 'Add {count} missing voicings as notes'
} as const
