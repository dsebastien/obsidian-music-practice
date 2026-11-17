/**
 * English texts of the settings tab and its checks (the source; keys are `settings.*`).
 * `settings.item.<id>.name|desc` are rows with a description, `settings.label.<id>` rows with a
 * name only.
 */
export const settingsEn = {
    // Groups and pages
    'settings.group.notation': 'Notation blocks',
    'settings.group.playback': 'Playback',
    'settings.group.metronome': 'Metronome',
    'settings.group.playAlong': 'Play-along',
    'settings.group.masteryLevels': 'Mastery levels',
    'settings.group.spacedReview': 'Spaced review',
    'settings.group.practiceScore': 'Practice score',
    'settings.group.practicePlan': 'Practice plan',
    'settings.group.rubricChord': 'Chords',
    'settings.group.rubricPiece': 'Arrangements and pieces',
    'settings.group.rubricPattern': 'Scales, techniques, exercises and other kinds',
    'settings.group.learningNotes': 'Learning notes',
    'settings.group.sessionsActivities': 'Sessions and activities',
    'settings.group.levelNames': 'Level names',
    'settings.page.rules.name': 'Rules',
    'settings.page.rules.desc': 'Mastery levels, spaced review, practice score and practice plans.',
    'settings.page.rubric.name': 'Rubric',
    'settings.page.rubric.desc':
        "What each mastery level means, shown when you change an item's mastery.",
    'settings.page.fields.name': 'Property names',
    'settings.page.fields.desc':
        'Frontmatter properties the plugin reads and writes. Review and time properties follow the Kanban Action Planner when it is installed.',
    'settings.page.local.name': 'Standalone note model',
    'settings.page.local.desc':
        'Used when the Obsidian Starter Kit is not available. Learning notes are the notes tagged type/<domain>/<subject>/<kind> (for example type/music/guitar/chord) with a mastery level.',
    'settings.page.types.name': 'Note types in use',
    'settings.page.types.desc': 'The learning and session types the plugin found.',
    'settings.types.learning': 'Learning types',
    'settings.types.session': 'Session types',

    // Note types row
    'settings.noteTypes.starterKit':
        'From the Obsidian Starter Kit: {counts}. Its note types own the statuses, folders, templates and date stamps.',
    'settings.noteTypes.standalone':
        "From this plugin's standalone note model (the Obsidian Starter Kit isn't available): {counts}.",
    'settings.noteTypes.counts': '{learning}, {sessions}',
    'settings.noteTypes.learning.one': '{count} learning type',
    'settings.noteTypes.learning.other': '{count} learning types',
    'settings.noteTypes.session.one': '{count} session type',
    'settings.noteTypes.session.other': '{count} session types',

    // Row shapes built from a description
    'settings.toggleDesc': '{desc} Code blocks named "{language}".',
    'settings.orientationDesc': '{desc} A block can say otherwise with "orientation:".',

    // Dropdown options
    'settings.option.vertical': 'Vertical',
    'settings.option.horizontal': 'Horizontal',
    'settings.option.generaluser': 'Sound pack (GeneralUser GS)',
    'settings.option.guitarSteel': 'Steel-string acoustic',
    'settings.option.guitarNylon': 'Nylon-string classical',
    'settings.option.guitarClean': 'Clean electric',
    'settings.option.guitarOverdrive': 'Overdriven electric',
    'settings.option.soundfont': 'Built-in soundfont',
    'settings.option.light': 'Light synthesizer',
    'settings.option.bpm': 'BPM',
    'settings.option.percent': 'Percent',
    'settings.option.quarter': 'Quarter notes',
    'settings.option.eighth': 'Eighths',
    'settings.option.triplet': 'Triplets',
    'settings.option.sixteenth': 'Sixteenths',

    // Status rows
    'settings.status.taken':
        'Another plugin already draws {blocks} blocks, so Music Practice leaves them alone. Turned-off blocks show as code; reload the plugin to let another plugin draw them.',
    'settings.status.off':
        'Turned-off blocks show as code; reload the plugin to let another plugin draw them.',
    'settings.playAlongStatus.taken':
        'Another plugin already draws playalong blocks, so Music Practice leaves them alone.',
    'settings.playAlongStatus.off':
        'Turned off, the blocks show as code; reload the plugin to let another plugin draw them.',

    // Reset
    'settings.reset.done': 'Music Practice settings reset to their defaults.',
    'settings.reset.title': 'Reset Music Practice settings?',
    'settings.reset.body':
        'The rules, rubric, property names and standalone note model go back to their defaults. Your notes are not touched.',

    // Support
    'settings.support.heading': 'Support',
    'settings.support.coffeeAlt': 'Buy me a coffee',
    'settings.support.knowii.name': 'Join the Knowii community',
    'settings.support.knowii.desc':
        'Learn to organize your notes and put your knowledge to work, together with fellow knowledge workers.',
    'settings.support.knowii.button': 'Join Knowii',
    'settings.support.plugin.name': 'Support this plugin',
    'settings.support.plugin.desc': 'Your support keeps development and maintenance going ❤️',
    'settings.support.plugin.button': 'GitHub Sponsors',
    'settings.support.touch.name': 'Stay in touch',
    'settings.support.touch.desc':
        'Obsidian, personal knowledge management and note-taking, straight to your inbox and feed.',
    'settings.support.touch.newsletter': 'Newsletter',
    'settings.support.touch.youtube': 'YouTube',

    // Checks
    'settings.error.invalid': 'Invalid value.',
    'settings.error.unknown': 'Unknown setting "{key}".',
    'settings.error.onOff': 'Expected on or off.',
    'settings.error.minNumber': 'Enter a number of at least {min}.',
    'settings.error.whole': 'Enter a whole number.',
    'settings.error.atMost': 'Enter at most {max}.',
    'settings.error.text': 'Enter text.',
    'settings.error.choose': 'Choose {values}.',
    'settings.error.needsValue': 'This setting needs a value.',
    'settings.error.numberList': 'Enter {count} numbers separated by commas.',
    'settings.error.atLeastOne': 'Enter at least one value.',
    'settings.error.notEditable': '"{key}" can\'t be edited here.',
    'settings.error.splitTotal': 'The four blocks must add up to 100 %.',
    'settings.error.levelsIncrease':
        'Levels must increase: want < learning < slow < tempo < rusty < mastered.',
    'settings.error.reviewInterval':
        'The maximum review interval must be at least the first interval (1 day or more).',
    'settings.error.fieldEmpty': 'Property names cannot be empty.',
    'settings.error.fieldDuplicate': '"{name}" is used for two properties.',
    'settings.words.or2': '{a} or {b}',
    'settings.words.orMore': '{list} or {last}',

    // Rows with name only
    'settings.label.noteTypes': 'Note types',
    'settings.label.status': 'Status',
    'settings.label.types': 'Types',
    'settings.label.support': 'Support',
    'settings.label.want': 'Want to learn',
    'settings.label.learning': 'Learning',
    'settings.label.slow': 'Can play slowly',
    'settings.label.tempo': 'Can play at tempo',
    'settings.label.rusty': 'Rusty',
    'settings.label.mastered': 'Mastered',
    'settings.label.lastPracticed': 'Last practiced',
    'settings.label.bpmCurrent': 'Current BPM',
    'settings.label.bpmTarget': 'Target BPM',
    'settings.label.priority': 'Priority',
    'settings.label.prerequisites': 'Prerequisites',
    'settings.label.theory': 'Theory',
    'settings.label.chordSymbol': 'Chord symbol',
    'settings.label.chordRoot': 'Chord root',
    'settings.label.chordQuality': 'Chord quality',
    'settings.label.lastReviewed': 'Last reviewed',
    'settings.label.reviewInterval': 'Review interval',
    'settings.label.reviewCount': 'Review count',
    'settings.label.date': 'Session date',
    'settings.label.startTime': 'Start time',
    'settings.label.quality': 'Session quality',
    'settings.label.practiced': 'Practiced items',
    'settings.label.activities': 'Activities',

    // Rows with a description
    'settings.item.planMinutes.name': 'Default practice plan length',
    'settings.item.planMinutes.desc': 'Minutes offered when you plan a practice session.',
    'settings.item.notesHeading.name': 'Session notes heading',
    'settings.item.notesHeading.desc':
        'Heading of the session note section that receives the note of a log ("Notes").',
    'settings.item.activityName.name': 'Activity name',
    'settings.item.activityName.desc':
        'The name Log practice proposes for a new activity, {token} being the instrument ("Learn {token}": "Learn Guitar"). Without the Obsidian Starter Kit and session_types, the activity your sessions count towards when no earlier session links one.',

    'settings.item.toggleChord.name': 'Chord diagrams',
    'settings.item.toggleChord.desc': 'Guitar diagrams and piano chords.',
    'settings.item.toggleChords.name': 'Chord charts',
    'settings.item.toggleChords.desc': 'ChordPro: chords over lyrics, transposable.',
    'settings.item.toggleKeyboard.name': 'Keyboards',
    'settings.item.toggleKeyboard.desc': 'Scales, chords and notes on a piano keyboard.',
    'settings.item.toggleFretboard.name': 'Fretboards',
    'settings.item.toggleFretboard.desc': 'Scales, chords and notes on a guitar neck.',
    'settings.item.toggleTab.name': 'Tabs',
    'settings.item.toggleTab.desc':
        'Tablature in alphaTex (or a Guitar Pro or MusicXML file), with playback.',
    'settings.item.toggleScore.name': 'Scores',
    'settings.item.toggleScore.desc':
        'Standard notation in alphaTex (or a score file), with playback.',
    'settings.item.toggleStrum.name': 'Strumming patterns',
    'settings.item.toggleStrum.desc':
        'Down and up strums on a beat grid, with accents and chord changes, playable.',
    'settings.item.togglePicking.name': 'Picking patterns',
    'settings.item.togglePicking.desc':
        'Fingerpicking (PIMA letters or string numbers, Travis, alternate bass) as a small tab, played in time over a chord or a progression.',
    'settings.item.toggleProgression.name': 'Progressions',
    'settings.item.toggleProgression.desc':
        'Roman numerals or Nashville numbers in any key, with their chords.',
    'settings.item.toggleCircle.name': 'Circle of fifths',
    'settings.item.toggleCircle.desc':
        "The keys, their relative minors and a key's chords on the wheel.",
    'settings.item.leftHanded.name': 'Left-handed',
    'settings.item.leftHanded.desc':
        'Mirror guitar chord diagrams and fretboards (the low string on the right). A block can say otherwise with "hand: right".',
    'settings.item.chordOrientation.name': 'Chord diagram orientation',
    'settings.item.chordOrientation.desc':
        'Vertical: the nut on top. Horizontal: the strings across, high string on top, as in tabs.',
    'settings.item.fretboardOrientation.name': 'Fretboard orientation',
    'settings.item.fretboardOrientation.desc':
        'Horizontal: the high string on top, as in tabs. Vertical: the nut on top, as a chord diagram.',
    'settings.item.keyboardOrientation.name': 'Keyboard orientation',
    'settings.item.keyboardOrientation.desc':
        'Horizontal: low notes on the left. Vertical: low notes at the bottom. Piano chords follow it.',
    'settings.item.naming.name': 'Note names',
    'settings.item.naming.desc':
        'How diagrams and drills show note names: C D E, Do Ré Mi, or German (H is B, B is B flat). Display only: blocks are read as you wrote them, and notes keep letters in their names and properties. A block can say otherwise with "naming:".',
    'settings.item.rootMark.name': 'Root marks',
    'settings.item.rootMark.desc':
        'How diagrams and drills mark the root: by its color, or by its color and a shape (a square dot, a square on the key), which you can tell without seeing colors. A block can say otherwise with "root-mark:".',
    'settings.item.imageFolder.name': 'Diagram images folder',
    'settings.item.imageFolder.desc':
        'Where a right-click on a diagram saves it as a PNG or SVG file: a folder of the vault (Music/Images), made when missing. Empty: the attachment location Obsidian uses for the note (Settings → Files and links).',
    'settings.item.imageEmbed.name': 'Embed saved images',
    'settings.item.imageEmbed.desc':
        'After saving a diagram as an image, put a link to it (an embed) on its own line right after the block in the note.',

    'settings.item.playEnabled.name': 'Play the diagrams',
    'settings.item.playEnabled.desc':
        'A click on a chord, keyboard or fretboard diagram plays it, and a click on a dot or a key plays that note. One bar under each block plays its diagrams one by one or all in turn, with loop, speed and the sound.',
    'settings.item.playEngine.name': 'Sound',
    'settings.item.playEngine.desc':
        'Sound pack: the recorded instruments of GeneralUser GS, the best sound (download it below). Built-in soundfont: recorded instruments, small, always there. Light: a small computed synthesizer, as on Obsidian Publish. Tabs and scores play the sound pack or the built-in soundfont, never the light synthesizer.',
    'settings.item.playGuitar.name': 'Guitar sound',
    'settings.item.playGuitar.desc':
        'The guitar that plays chord diagrams, fretboards, strumming and picking patterns, progressions and chord charts. A note can name its own with its {property} property (steel, nylon, clean or overdrive), and a block with a guitar: line. Tabs and scores keep the instruments of their tracks. A change is heard at the next Play.',
    'settings.item.soundPack.name': 'Sound pack',
    'settings.item.soundPack.desc':
        '{name}: one small file per instrument, {size} in all ({license}). A click on Download gets the files from jsDelivr (cdn.jsdelivr.net), checks each one and saves them in {folder}. Nothing is downloaded without that click. Without the pack, the built-in soundfont plays.',
    'settings.soundPack.mobile':
        'On a phone or a tablet, the pack takes {size} of storage: download it on Wi-Fi.',
    'settings.soundPack.status.absent': 'Not downloaded.',
    'settings.soundPack.status.partial':
        'The download stopped before the end. It goes on from where it stopped.',
    'settings.soundPack.status.installed': 'Downloaded.',
    'settings.soundPack.status.outdated': 'Downloaded. A newer version of the pack is available.',
    'settings.soundPack.status.downloading': 'Downloading: {percent} %',
    'settings.soundPack.download': 'Download',
    'settings.soundPack.resume': 'Continue the download',
    'settings.soundPack.update': 'Update',
    'settings.soundPack.cancel': 'Cancel',
    'settings.soundPack.remove': 'Remove',
    'settings.soundPack.done': 'The sound pack is downloaded. It plays from now on.',
    'settings.soundPack.removed': 'The sound pack is removed. The built-in soundfont plays.',
    'settings.soundPack.cancelled': 'The download stopped. The files it got stay.',
    'settings.soundPack.error.network':
        'The download of {file} failed. Check the connection, then click Download again: it goes on from where it stopped.',
    'settings.soundPack.error.checksum':
        'The file {file} is not the one expected, so it was not saved. Click Download again.',
    'settings.soundPack.error.storage': 'The sound pack could not be saved in {folder}.',
    'settings.item.playVolume.name': 'Volume',
    'settings.item.playVolume.desc':
        'From 0 to 100. The volume of every play bar: diagrams, strumming and picking patterns, progressions and chord charts. The bars have no volume control.',
    'settings.item.playBpm.name': 'Scale tempo',
    'settings.item.playBpm.desc':
        'Notes per minute when a scale plays, from 20 to 240. The bar can change it for one block.',
    'settings.item.playStrum.name': 'Strum',
    'settings.item.playStrum.desc':
        'Milliseconds between two strings when a guitar chord is strummed, from 0 to 200 (12 by default). Piano chords sound together.',
    'settings.item.tempoUnit.name': 'Tab tempo',
    'settings.item.tempoUnit.desc':
        'The unit the bar under a tab or a score shows first: BPM (the tempo the music plays at, with the percent next to it) or percent of the written tempo. The unit button on a bar switches it and saves it here.',

    'settings.item.beatsPerBar.name': 'Beats per bar',
    'settings.item.beatsPerBar.desc': 'From 2 to 12; the first is accented.',
    'settings.item.clicks.name': 'Clicks',
    'settings.item.clicks.desc': 'Per beat: quarter notes, eighths, triplets or sixteenths.',
    'settings.item.metronomeVolume.name': 'Volume',
    'settings.item.metronomeVolume.desc': 'From 0 to 1.',
    'settings.item.trainerStep.name': 'Speed trainer step',
    'settings.item.trainerStep.desc': 'BPM added at each step.',
    'settings.item.trainerBars.name': 'Speed trainer bars',
    'settings.item.trainerBars.desc': 'Bars between two steps (the "+" button steps at once).',
    'settings.item.countIn.name': 'Count-in',
    'settings.item.countIn.desc':
        'Bars of clicks before the first bar, from 0 (none) to 4. When it is on, a chord change drill counts 3, 2, 1 before its minute.',
    'settings.item.flash.name': 'Flash on each beat',
    'settings.item.flash.desc':
        'A light that flashes on each beat, beat one in another color: for noisy rooms.',
    'settings.item.drillSeconds.name': 'Chord change drill length',
    'settings.item.drillSeconds.desc': 'Seconds, from 10 to 600 (a minute is the classic drill).',
    'settings.item.drillQuestions.name': 'Questions per drill',
    'settings.item.drillQuestions.desc':
        'Note, chord and scale drills: questions in one drill, from 1 to 100.',
    'settings.item.weakShare.name': 'Weak spots share',
    'settings.item.weakShare.desc':
        'Percent of the questions asked about your weak spots (most misses, slowest answers), from 0 to 100.',
    'settings.item.clearStreak.name': 'Right answers to clear a weak spot',
    'settings.item.clearStreak.desc':
        'Right answers in a row, each faster than the time below, after which a spot is no longer weak (1 to 10).',
    'settings.item.fastSeconds.name': 'Fast answer',
    'settings.item.fastSeconds.desc':
        'Seconds: a right answer faster than this counts toward clearing a weak spot (0.5 to 10). Ear training has its own, below.',
    'settings.item.earFastSeconds.name': 'Fast answer, ear training',
    'settings.item.earFastSeconds.desc':
        'Seconds, for intervals, chords, scales and degrees by ear: naming what you hear takes longer (0.5 to 20, 4 by default). It also decides when guided ear training adds the next item.',
    'settings.item.guided.name': 'Guided ear training',
    'settings.item.guided.desc':
        'Ear training drills start with two intervals, chords, scales or degrees, and add the next one once you know them all (each spot cleared, as above). Off: every one you picked from the start.',

    'settings.item.playAlong.name': 'Play-along player',
    'settings.item.playAlong.desc':
        'A playalong code block plays a recording of the vault (audio or video) with an A-B loop, the speed without a pitch change, its sections and a count-in before each pass.',
    'settings.item.preRoll.name': 'Pre-roll',
    'settings.item.preRoll.desc':
        'Seconds played before A at each pass of the loop, from 0 to 2 (0.2 by default), so the first note is not cut.',

    'settings.item.levelWant.name': 'Want to learn',
    'settings.item.levelWant.desc': 'Wishlist level.',
    'settings.item.levelLearning.name': 'Learning',
    'settings.item.levelLearning.desc': 'First active level.',
    'settings.item.levelSlow.name': 'Can play slowly',
    'settings.item.levelSlow.desc': 'Reaching it starts spaced review.',
    'settings.item.levelTempo.name': 'Can play at tempo',
    'settings.item.levelTempo.desc': 'Offered when the target BPM is reached.',
    'settings.item.levelRusty.name': 'Rusty',
    'settings.item.levelRusty.desc': 'Where a failed review drops a mastered item.',
    'settings.item.levelMastered.name': 'Mastered',
    'settings.item.levelMastered.desc': 'Done; mastered items stay in review.',

    'settings.item.firstInterval.name': 'First interval (days)',
    'settings.item.firstInterval.desc':
        'Set when an item reaches "Can play slowly", and after a failed review.',
    'settings.item.maxInterval.name': 'Maximum interval (days)',
    'settings.item.maxInterval.desc': 'Good reviews never push the interval past this.',
    'settings.item.goodMultiplier.name': 'Good review multiplier',
    'settings.item.goodMultiplier.desc': 'A good review multiplies the interval by this.',
    'settings.item.dueSoonMaxDays.name': 'Due soon window (days)',
    'settings.item.dueSoonMaxDays.desc': 'At most this many days before the interval ends.',
    'settings.item.dueSoonDivisor.name': 'Due soon divisor',
    'settings.item.dueSoonDivisor.desc': 'The window is also at most the interval divided by this.',

    'settings.item.priorityBase.name': 'Priority base',
    'settings.item.priorityBase.desc': 'Priority points are this minus the priority number.',
    'settings.item.priorityUnknown.name': 'Points without a priority',
    'settings.item.priorityUnknown.desc': 'When the priority is TBD or missing.',
    'settings.item.priorityTbd.name': 'TBD priority number',
    'settings.item.priorityTbd.desc': 'The priority number that means "to be defined".',
    'settings.item.neverPracticed.name': 'Never practiced',
    'settings.item.neverPracticed.desc': 'Staleness points of an item never practiced.',
    'settings.item.stalenessMaxDays.name': 'Staleness cap without interval (days)',
    'settings.item.stalenessMaxDays.desc': 'Days since practiced count up to this.',
    'settings.item.stalenessIntervalCap.name': 'Staleness cap with interval',
    'settings.item.stalenessIntervalCap.desc':
        'Days since practiced divided by the interval, capped at this.',
    'settings.item.stalenessIntervalWeight.name': 'Staleness weight with interval',
    'settings.item.stalenessIntervalWeight.desc': 'That ratio is multiplied by this.',
    'settings.item.bpmGapDivisor.name': 'BPM gap divisor',
    'settings.item.bpmGapDivisor.desc': 'The missing BPM percentage is divided by this.',
    'settings.item.perUnlock.name': 'Points per unlock',
    'settings.item.perUnlock.desc': 'For each item at "Want to learn" that links to this one.',
    'settings.item.maxUnlocks.name': 'Unlocks counted',
    'settings.item.maxUnlocks.desc': 'At most this many unlocks count.',
    'settings.item.rustyBonus.name': 'Rusty bonus',
    'settings.item.rustyBonus.desc': 'Extra points for Rusty items.',

    'settings.item.planSplit.name': 'Blocks (%)',
    'settings.item.planSplit.desc':
        'Warm-up, focus, review and fun, adding up to 100: "15, 50, 20, 15".',
    'settings.item.minMinutes.name': 'Minutes per item (minimum)',
    'settings.item.minMinutes.desc': 'Each planned item gets at least this many minutes.',
    'settings.item.maxItems.name': 'Items per block (maximum)',
    'settings.item.maxItems.desc': 'Fewer items, more depth.',
    'settings.item.warmUpKinds.name': 'Warm-up kinds',
    'settings.item.warmUpKinds.desc':
        'Kinds practiced in the warm-up, comma-separated: "technique, exercise".',

    'settings.item.fieldSources.name': 'Sources',
    'settings.item.fieldSources.desc':
        'Pieces: links to where they come from; imported score files are added here.',
    'settings.item.fieldKey.name': 'Key',
    'settings.item.fieldKey.desc': 'Pieces: "G major", "E minor".',
    'settings.item.fieldPieceChords.name': 'Chords used',
    'settings.item.fieldPieceChords.desc': 'Pieces: the chord notes they use (links).',
    'settings.item.fieldTimeSignature.name': 'Time signature',
    'settings.item.fieldTimeSignature.desc':
        'Pieces, strumming and picking patterns: "3/4", "6/8"… The metronome counts it when it practices the note.',
    'settings.item.fieldShape.name': 'Shape',
    'settings.item.fieldShape.desc': 'Chords and scales: open, barre, CAGED…',
    'settings.item.fieldFrets.name': 'Frets',
    'settings.item.fieldFrets.desc': 'Guitar chords: "x02220".',
    'settings.item.fieldFingers.name': 'Fingers',
    'settings.item.fieldFingers.desc': 'Guitar chords: "x01230".',
    'settings.item.fieldPosition.name': 'Position',
    'settings.item.fieldPosition.desc': 'Guitar chords: the first fret shown.',
    'settings.item.fieldPitches.name': 'Pitches',
    'settings.item.fieldPitches.desc': 'Piano chords: "A3 C#4 E4".',
    'settings.item.fieldFingering.name': 'Fingering',
    'settings.item.fieldFingering.desc': 'Piano chords: "5 3 1".',
    'settings.item.fieldTrains.name': 'Trains',
    'settings.item.fieldTrains.desc': 'Exercises: what they train (links).',
    'settings.item.fieldChangesBest.name': 'Best changes',
    'settings.item.fieldChangesBest.desc': 'Chord change drills: best changes per minute.',
    'settings.item.fieldChangesLast.name': 'Last changes',
    'settings.item.fieldChangesLast.desc': 'Chord change drills: changes in the last drill.',
    'settings.item.fieldDrillKind.name': 'Drill kind',
    'settings.item.fieldDrillKind.desc':
        'Note drills: what the drill note drills (Fretboard notes, Keyboard notes, Chord names, Scale shapes).',
    'settings.item.fieldDrillSetting.name': 'Drill setting',
    'settings.item.fieldDrillSetting.desc':
        'Note drills: the setting in words ("string 5, frets 0-5").',
    'settings.item.fieldPublicNote.name': 'Public note',
    'settings.item.fieldPublicNote.desc':
        'Learning notes: whether the note is published. New drill notes get false; publishing stays your choice.',
    'settings.item.fieldDrillStats.name': 'Drill weak spots',
    'settings.item.fieldDrillStats.desc': 'Note drills: the weak-spot map ("s5f3 C: 7/9 1.8s").',
    'settings.item.fieldExerciseKind.name': 'Exercise kind',
    'settings.item.fieldExerciseKind.desc':
        'Music exercises: what kind of exercise. Ear training drill notes get Ear training.',
    'settings.item.fieldScaleRoot.name': 'Scale root',
    'settings.item.fieldScaleRoot.desc': 'Scales: "A".',
    'settings.item.fieldScaleType.name': 'Scale type',
    'settings.item.fieldScaleType.desc': 'Scales: "Minor pentatonic".',
    'settings.item.fieldFingeringRight.name': 'Scale fingering',
    'settings.item.fieldFingeringRight.desc': 'Piano scales, right hand: "1 2 3 1 2 3 4 5".',
    'settings.item.fieldStrumPattern.name': 'Strumming pattern',
    'settings.item.fieldStrumPattern.desc': 'Strumming patterns: "D DU UDU".',
    'settings.item.fieldStrumFeel.name': 'Feel',
    'settings.item.fieldStrumFeel.desc':
        'Strumming patterns: "straight", "swing" or a swing ratio ("60%").',
    'settings.item.fieldGuitarSound.name': 'Guitar sound',
    'settings.item.fieldGuitarSound.desc':
        'The guitar the blocks of a note play on: "steel", "nylon", "clean" or "overdrive". It comes before the Guitar sound setting.',
    'settings.item.fieldPickingPattern.name': 'Picking pattern',
    'settings.item.fieldPickingPattern.desc':
        'Fingerpicking patterns: a name ("travis", "alternate bass", "1-2-3-4") or "p i m a".',
    'settings.item.fieldTimeSpent.name': 'Minutes',
    'settings.item.fieldTimeSpent.desc': 'On learning notes, sessions and activities.',
    'settings.item.fieldPracticedMinutes.name': 'Minutes per item',
    'settings.item.fieldPracticedMinutes.desc':
        'On sessions: "<minutes> [[<note>]]" for each practiced item. Learning notes get their minutes from it.',
    'settings.item.fieldSessionTypes.name': 'Session types',
    'settings.item.fieldSessionTypes.desc':
        'On activities: the session note types that count for them (guitar-practice-sessions).',
    'settings.item.fieldTimeEntries.name': 'Time entries',
    'settings.item.fieldTimeEntries.desc':
        'On activities. Read to compute their minutes; a log removes the entry of a Kanban Action Planner timer it takes over.',
    'settings.item.fieldLastSession.name': 'Last session date',
    'settings.item.fieldLastSession.desc': 'On activities.',

    'settings.item.localDomains.name': 'Domains',
    'settings.item.localDomains.desc':
        'Comma-separated: only type/<domain>/… tags of these domains mark learning notes ("music").',
    'settings.item.localStatus.name': 'Mastery property',
    'settings.item.localStatus.desc': 'The property holding the level ("20 - Learning").',
    'settings.item.localTopPriority.name': 'Current focus priority',
    'settings.item.localTopPriority.desc': 'Items at this priority number are the current focus.',
    'settings.item.localStarted.name': 'Started date property',
    'settings.item.localStarted.desc': 'Stamped on reaching Learning (empty: none).',
    'settings.item.localMastered.name': 'Mastered date property',
    'settings.item.localMastered.desc': 'Stamped on reaching Mastered (empty: none).',
    'settings.item.localFolder.name': 'Session folder',
    'settings.item.localFolder.desc': 'Tokens: {tokens}.',
    'settings.item.localSuffix.name': 'Session name suffix',
    'settings.item.localSuffix.desc': 'Appended to session note names; same tokens.',
    'settings.item.localTemplate.name': 'Session template',
    'settings.item.localTemplate.desc':
        'Optional note used as the template of new session notes (vault path).',

    'settings.item.reset.name': 'Reset to defaults',
    'settings.item.reset.desc':
        'Restore the rules, rubric, property names and standalone note model. Asks first.'
} as const
