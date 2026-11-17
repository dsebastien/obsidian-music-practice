/** English texts of the plugin area: commands, notices, status bar, menus (keys are `plugin.*`). */
export const pluginEn = {
    // Commands
    'plugin.command.practiceNext': 'Practice next',
    'plugin.command.practicePlan': 'Plan a practice session',
    'plugin.command.openPracticePanel': 'Open practice panel',
    'plugin.command.pauseTimer': 'Pause or resume practice timer',
    'plugin.command.logPractice': 'Log practice',
    'plugin.command.addLearningNote': 'Add a learning note',
    'plugin.command.voicingsOfThisChord': 'Voicings of this chord',
    'plugin.command.voicingsOfAChord': 'Voicings of a chord',
    'plugin.command.insertTabBlock': 'Insert a tab block',
    'plugin.command.insertTabExercise': 'Insert a tab exercise of this scale or arpeggio',
    'plugin.command.convertTextTab': 'Edit this text tab as alphaTex',
    'plugin.command.importScoreFile': 'Import a score or chord file',
    'plugin.command.importTextTab': 'Import a text tab',
    'plugin.command.importChordSheet': 'Import a chord sheet',
    'plugin.command.playThisNote': 'Play this chord or scale',
    'plugin.command.easiestWay': 'Easiest way between these chords',
    'plugin.command.pieceKey': 'Find the key and scales of this piece',
    'plugin.command.progressionInTime': 'Practice this progression in time',
    'plugin.command.chartChanges': 'Suggest chord change drills from this piece',
    'plugin.command.smoothProgression': 'Smooth this progression',
    'plugin.command.triads': 'Triads of a chord or key',
    'plugin.command.triadsOfThisChord': 'Triads of this chord',
    'plugin.command.changeMastery': 'Change mastery of the current note',
    'plugin.command.undoLastLog': 'Undo last practice log',
    'plugin.command.chordChangeDrill': 'Chord change drill',
    'plugin.command.chordChangeDrillCurrent': 'Chord change drill for the current note',
    'plugin.command.noteDrill': 'Drill notes, chords or scales',
    'plugin.command.earTraining': 'Ear training: intervals, chords, scales and degrees',
    'plugin.command.noteDrillCurrent': 'Drill notes, chords or scales for the current note',
    'plugin.command.identifyChord': 'Identify this chord',
    'plugin.command.simplifyChart': 'Simplify this chart',
    'plugin.command.startMetronome': 'Start metronome',
    'plugin.command.stopMetronome': 'Stop metronome',
    'plugin.command.speedTrainer': 'Speed trainer for the current note',
    'plugin.command.saveMetronomeBpm': 'Save metronome BPM to its note',
    'plugin.command.setBpm': 'Set BPM of the current note',
    'plugin.command.startTimer': 'Start practice timer',
    'plugin.command.stopTimer': 'Stop practice timer and log the session',
    'plugin.command.discardTimer': 'Discard practice timer',

    // Ribbon, status bar, timer menu
    'plugin.ribbon.openPanel': 'Open practice panel',
    'plugin.statusBar.openMetronome': 'Open the metronome',
    'plugin.statusBar.stopTimer': 'Stop the practice timer and log the session',
    'plugin.statusBar.stopTimerDiscard':
        'Stop the practice timer and log the session (right-click to discard it)',
    'plugin.timerMenu.stopAndLog': 'Stop and log the session',
    'plugin.timerMenu.discard': 'Discard the timer',

    // General
    'plugin.error': 'Music Practice: {error}',
    'plugin.loadProblem': 'Music Practice: {problem}',
    'plugin.loadProblem.reset':
        '{problem} The rules and property names were reset to their defaults.',
    'plugin.model.noneStarterKit':
        'No learning note types in the Obsidian Starter Kit: a learning type has a status on the mastery scale and a "last practiced" property.',
    'plugin.model.noneLocal':
        'No learning notes yet. Tag a note type/<domain>/<subject>/<kind> (for example type/music/guitar/chord) and give it a mastery level.',
    'plugin.note.added': 'Added {note}.',
    'plugin.note.addFailed': "Couldn't add the note: {error}",

    // Identify this chord
    'plugin.identify.alreadyNamed': 'Already named {named}: clear "{field}" to identify it again.',
    'plugin.identify.noProperty': 'This note type has no "{field}" property to name the chord in.',
    'plugin.identify.notAChord': '"{symbol}" is not a chord the library reads.',
    'plugin.identify.named': 'This chord is {name} ({symbol}).',
    'plugin.identify.namedFromName': "From the note's name: this chord is {name} ({symbol}).",
    'plugin.identify.failed': "Couldn't name the chord: {error}",
    'plugin.identify.noneFound': 'No chord found: add six frets to "{field}" (x02220).',

    // Scores: export, print, save BPM
    'plugin.score.export': 'Export',
    'plugin.score.guitarPro': 'Guitar Pro 7 file',
    'plugin.score.midi': 'MIDI file',
    'plugin.score.print': 'Print',
    'plugin.score.printFailed': "Couldn't print the score: {error}",
    'plugin.score.saved': 'Saved {path}.',
    'plugin.score.exportFailed': "Couldn't export the score: {error}",
    'plugin.score.saveBpm': 'Save BPM',
    'plugin.score.saveBpmLong': 'Save the BPM it plays at to this note',

    // Exercises, triads, voicings, transitions
    'plugin.exercise.noPosition': 'No position to play {name} from.',
    'plugin.triads.exists': '{note} already plays this triad.',
    'plugin.voicing.exists': '{note} already plays this voicing.',
    'plugin.voicing.noType': 'No guitar chord note type.',
    'plugin.voicing.changeFailed': "Couldn't change the voicing: {error}",
    'plugin.voicing.nowPlays': '{note} now plays {frets}.',
    'plugin.transition.needsSymbols': 'Both chord notes need a chord symbol.',

    // Pieces and charts
    'plugin.pieceKey.noChords':
        'This note has no chord chart ({block}) and links no chord notes with a chord symbol.',
    'plugin.pieceKey.unreadable': "A chord of this piece doesn't read: {chords}",
    'plugin.chartChanges.noChange': 'This note has no chord chart ({block}) with a chord change.',
    'plugin.simplify.noChart': 'This note has no chord chart ({block}) with chords.',
    'plugin.smooth.tooFew': 'This note has no chord chart ({block}) with two chords or more.',
    'plugin.backing.progressionName': 'Progression {n}',
    'plugin.backing.nothing':
        'This note has no progression ({progression}), no chord chart ({chords}) and links no chord notes to play.',

    // Play, drills, metronome
    'plugin.play.nothingYet':
        'This note has nothing to play yet: add its chord and frets, or its scale.',
    'plugin.play.nothing': 'Nothing to play in this note.',
    'plugin.soundPack.missing':
        'The sound pack is not on this device, so the built-in soundfont plays. Download it in Settings → Playback.',
    'plugin.drill.needsExerciseType':
        'Chord change drills need a guitar exercise note type to keep their results.',
    'plugin.metronome.noNote': 'The metronome has no note to save the BPM to.',

    // Imports
    'plugin.import.noArrangementType':
        'Open a note in editing view: there is no arrangement note type.',
    'plugin.import.done': 'Imported into {note}.',
    'plugin.import.doneWhat': 'Imported {what} into {note}.',
    'plugin.import.failed': "Couldn't import: {error}",
    'plugin.import.failedWhat': "Couldn't import {what}: {error}",

    // Practice timer
    'plugin.timer.started': 'Practice timer started.',
    'plugin.timer.notRunning': 'The practice timer is not running.',
    'plugin.timer.tooLong': 'The practice timer ran {elapsed}: check the minutes before logging.',
    'plugin.timer.discardTitle': 'Discard the practice timer',
    'plugin.timer.discardConfirm': 'Discard',
    'plugin.timer.discarded': 'Practice timer discarded: nothing was logged.',
    'plugin.timer.forgotten': '{duration}: forgotten?',
    'plugin.timer.staleLabel': '{stale} Click to log it; right-click to discard it.',

    // Log practice
    'plugin.log.alreadyOpen': 'Log practice is already open.',
    'plugin.log.activityCreated': 'Activity created: {name}',
    'plugin.log.alreadyLogged':
        'Already logged: the session note of that log was used again, nothing counted twice. Undo last practice log still undoes the first log.',
    'plugin.log.logged.one': 'Practice logged: {count} item.',
    'plugin.log.logged.other': 'Practice logged: {count} items.',
    'plugin.log.undo': 'Undo',
    'plugin.log.kapMissing':
        'The Kanban Action Planner timer was stopped but its time entry did not appear in time. If it appears on the activity, delete it: the session note holds that time.',

    // Undo
    'plugin.undo.anotherLog':
        'Another log was written since: use Undo last practice log for that one.',
    'plugin.undo.nothing': 'There is no practice log to undo.',
    'plugin.undo.done':
        'Practice log undone: the notes are back as they were and the session note is in the trash.',
    'plugin.undo.doneKap':
        "Practice log undone. The Kanban Action Planner timer's time entry is on the activity again.",
    'plugin.undo.activityStays': '{name} stays (you created it).',
    'plugin.undo.activityKeeps': '{name} keeps the session type in its session types.',

    // Activity time left over after a log
    'plugin.surplus.question':
        '{name} stores {stored} min, but its time entries and sessions give {computed}. Keep the {difference} min as a "Manual adjustment" time entry, or drop them?',
    'plugin.surplus.keep': 'Keep',
    'plugin.surplus.drop': 'Drop',
    'plugin.surplus.nothingLeft': '{name}: nothing left to settle, its time was left as it is.',
    'plugin.surplus.kept': '{name}: {difference} min kept as a "Manual adjustment" time entry.',
    'plugin.surplus.dropped': '{name}: {difference} min dropped, its time is now {minutes} min.'
} as const
