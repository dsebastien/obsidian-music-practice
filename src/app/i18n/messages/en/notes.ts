/** English texts of the notes area (the source; keys are `notes.*`). */
export const notesEn = {
    // Add a learning note
    'notes.add.title': 'Add a learning note',
    'notes.add.type': 'Type',
    'notes.add.root': 'Root',
    'notes.add.scaleOrMode': 'Scale or mode',
    'notes.add.scaleMajor': 'Major',
    'notes.add.scaleNaturalMinor': 'Natural minor',
    'notes.add.scaleHarmonicMinor': 'Harmonic minor',
    'notes.add.scaleMelodicMinor': 'Melodic minor',
    'notes.add.scaleMajorPentatonic': 'Major pentatonic',
    'notes.add.scaleMinorPentatonic': 'Minor pentatonic',
    'notes.add.scaleBlues': 'Blues',
    'notes.add.scaleDorian': 'Dorian',
    'notes.add.scalePhrygian': 'Phrygian',
    'notes.add.scaleLydian': 'Lydian',
    'notes.add.scaleMixolydian': 'Mixolydian',
    'notes.add.scaleLocrian': 'Locrian',
    'notes.add.nameGuitarChord': 'Chord (F#m7, A Major) or frets (x02220)',
    'notes.add.namePianoChord': 'Chord (F#m7, A Major) or keys (C4 E4 G4)',
    'notes.add.nameChord': 'Chord (F#m7, A Major)',
    'notes.add.nameArpeggio': 'Chord of the arpeggio (Am7, A Minor 7)',
    'notes.add.name': 'Name',
    'notes.add.namePlaceholder': "Knockin on Heaven's Door - Simplified",
    'notes.add.pattern': 'Pattern',
    'notes.add.timeSignature': 'Time signature',
    'notes.add.feel': 'Feel',
    'notes.add.pickingPlaceholder': "Travis, or p i m a p' i m a",
    'notes.add.chord': 'Chord',
    'notes.add.shape': 'Shape (optional)',
    'notes.add.mastery': 'Mastery',
    'notes.add.voicing': 'Voicing',
    'notes.add.moreVoicings': 'More voicings…',
    'notes.add.triads': 'Triads…',
    'notes.add.noneInDatabase': 'None in the database: see More voicings',
    'notes.add.noneFound': 'None found: no diagram',
    'notes.add.pickedFrets': 'Picked: {frets}',
    'notes.add.noDiagram': 'No diagram',
    'notes.add.picked': 'Picked',
    'notes.add.voicingLabel': 'Voicing {label}: {frets}',
    'notes.add.preview': 'Note: {title}',
    'notes.add.previewAlias': 'Note: {title} (alias {alias})',
    'notes.add.noChordFrets':
        'These frets make no chord the library knows: type the chord instead.',
    'notes.add.noChordKeys': 'These keys make no chord the library knows: type the chord instead.',
    'notes.add.typeChord': 'Type a chord: its name is spelled out, the symbol becomes an alias.',
    'notes.add.pickScale': 'Pick a root and a scale or mode.',

    // Creating a note
    'notes.create.exists': '"{title}" already exists.',

    // Importing a score file
    'notes.import.unreadable':
        "its text can't be read (it isn't UTF-8, UTF-16 or Windows-1252 text).",
    'notes.import.notScore': '"{name}" isn\'t a score file this can read.',

    // Voicing notes
    'notes.voicing.unknownChord': 'Unknown chord "{symbol}".',
    'notes.voicing.noFrets': '{type} notes have no "{property}" property.',
    'notes.voicing.alreadyNote': '{title} already has a note there.'
} as const
