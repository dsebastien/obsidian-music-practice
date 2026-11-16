import type { Translation } from '../../translation'
import type { pluginEn } from '../en/plugin'

/** French texts of the plugin area: exactly the keys of the English table. */
export const pluginFr: Translation<typeof pluginEn> = {
    // Commands
    'plugin.command.practiceNext': 'Que pratiquer ensuite',
    'plugin.command.practicePlan': 'Planifier une séance de pratique',
    'plugin.command.openPracticePanel': 'Ouvrir le panneau de pratique',
    'plugin.command.pauseTimer': 'Mettre en pause ou reprendre le minuteur de pratique',
    'plugin.command.logPractice': 'Enregistrer la pratique',
    'plugin.command.addLearningNote': "Ajouter une note d'apprentissage",
    'plugin.command.voicingsOfThisChord': 'Positions de cet accord',
    'plugin.command.voicingsOfAChord': "Positions d'un accord",
    'plugin.command.insertTabBlock': 'Insérer un bloc de tablature',
    'plugin.command.insertTabExercise':
        'Insérer un exercice de tablature pour cette gamme ou cet arpège',
    'plugin.command.convertTextTab': 'Modifier cette tablature texte en alphaTex',
    'plugin.command.importScoreFile': "Importer un fichier de partition ou d'accords",
    'plugin.command.importTextTab': 'Importer une tablature texte',
    'plugin.command.importChordSheet': "Importer une grille d'accords",
    'plugin.command.playThisNote': 'Jouer cet accord ou cette gamme',
    'plugin.command.easiestWay': 'Le moyen le plus facile de passer entre ces accords',
    'plugin.command.pieceKey': 'Trouver la tonalité et les gammes de ce morceau',
    'plugin.command.progressionInTime': 'Pratiquer cette progression en rythme',
    'plugin.command.chartChanges':
        "Suggérer des exercices de changement d'accord à partir de ce morceau",
    'plugin.command.smoothProgression': 'Simplifier cette progression',
    'plugin.command.triads': "Triades d'un accord ou d'une tonalité",
    'plugin.command.triadsOfThisChord': 'Triades de cet accord',
    'plugin.command.changeMastery': 'Changer la maîtrise de la note courante',
    'plugin.command.undoLastLog': 'Annuler le dernier enregistrement de pratique',
    'plugin.command.chordChangeDrill': "Exercice de changement d'accord",
    'plugin.command.chordChangeDrillCurrent':
        "Exercice de changement d'accord pour la note courante",
    'plugin.command.noteDrill': 'Exercice sur les notes, les accords ou les gammes',
    'plugin.command.earTraining':
        "Entraînement de l'oreille : intervalles, accords, gammes et degrés",
    'plugin.command.noteDrillCurrent':
        'Exercice sur les notes, les accords ou les gammes pour la note courante',
    'plugin.command.identifyChord': 'Identifier cet accord',
    'plugin.command.startMetronome': 'Démarrer le métronome',
    'plugin.command.stopMetronome': 'Arrêter le métronome',
    'plugin.command.speedTrainer': 'Montée en tempo pour la note courante',
    'plugin.command.saveMetronomeBpm': 'Enregistrer le BPM du métronome dans sa note',
    'plugin.command.setBpm': 'Définir le BPM de la note courante',
    'plugin.command.startTimer': 'Démarrer le minuteur de pratique',
    'plugin.command.stopTimer': 'Arrêter le minuteur de pratique et enregistrer la séance',
    'plugin.command.discardTimer': 'Abandonner le minuteur de pratique',

    // Ribbon, status bar, timer menu
    'plugin.ribbon.openPanel': 'Ouvrir le panneau de pratique',
    'plugin.statusBar.openMetronome': 'Ouvrir le métronome',
    'plugin.statusBar.stopTimer': 'Arrêter le minuteur de pratique et enregistrer la séance',
    'plugin.statusBar.stopTimerDiscard':
        "Arrêter le minuteur de pratique et enregistrer la séance (clic droit pour l'abandonner)",
    'plugin.timerMenu.stopAndLog': 'Arrêter et enregistrer la séance',
    'plugin.timerMenu.discard': 'Abandonner le minuteur',

    // General
    'plugin.error': 'Music Practice : {error}',
    'plugin.loadProblem': 'Music Practice : {problem}',
    'plugin.loadProblem.reset':
        '{problem} Les règles et les noms de propriétés ont été rétablis à leurs valeurs par défaut.',
    'plugin.model.noneStarterKit':
        "Aucun type de note d'apprentissage dans l'Obsidian Starter Kit : un type d'apprentissage a un statut sur l'échelle de maîtrise et une propriété « last practiced ».",
    'plugin.model.noneLocal':
        "Aucune note d'apprentissage pour l'instant. Ajoutez à une note le tag type/<domain>/<subject>/<kind> (par exemple type/music/guitar/chord) et donnez-lui un niveau de maîtrise.",
    'plugin.note.added': '{note} ajoutée.',
    'plugin.note.addFailed': "Impossible d'ajouter la note : {error}",

    // Identify this chord
    'plugin.identify.alreadyNamed':
        "Accord déjà nommé {named} : videz « {field} » pour l'identifier à nouveau.",
    'plugin.identify.noProperty':
        "Ce type de note n'a pas de propriété « {field} » pour y nommer l'accord.",
    'plugin.identify.notAChord': "« {symbol} » n'est pas un accord que la bibliothèque sait lire.",
    'plugin.identify.named': 'Cet accord est {name} ({symbol}).',
    'plugin.identify.failed': "Impossible de nommer l'accord : {error}",
    'plugin.identify.noneFound':
        'Aucun accord trouvé : ajoutez six frettes à « {field} » (x02220).',

    // Scores: export, print, save BPM
    'plugin.score.export': 'Exporter',
    'plugin.score.guitarPro': 'Fichier Guitar Pro 7',
    'plugin.score.midi': 'Fichier MIDI',
    'plugin.score.print': 'Imprimer',
    'plugin.score.printFailed': "Impossible d'imprimer la partition : {error}",
    'plugin.score.saved': '{path} enregistré.',
    'plugin.score.exportFailed': "Impossible d'exporter la partition : {error}",
    'plugin.score.saveBpm': 'Enregistrer le BPM',
    'plugin.score.saveBpmLong': 'Enregistrer dans cette note le BPM auquel elle se joue',

    // Exercises, triads, voicings, transitions
    'plugin.exercise.noPosition': 'Aucune position pour jouer {name}.',
    'plugin.triads.exists': '{note} joue déjà cette triade.',
    'plugin.voicing.exists': '{note} joue déjà cette position.',
    'plugin.voicing.noType': "Aucun type de note d'accord de guitare.",
    'plugin.voicing.changeFailed': 'Impossible de changer la position : {error}',
    'plugin.voicing.nowPlays': '{note} joue maintenant {frets}.',
    'plugin.transition.needsSymbols': "Les deux notes d'accord ont besoin d'un symbole d'accord.",

    // Pieces and charts
    'plugin.pieceKey.noChords':
        "Cette note n'a pas de grille d'accords ({block}) et ne lie aucune note d'accord avec un symbole d'accord.",
    'plugin.pieceKey.unreadable': 'Un accord de ce morceau est illisible : {chords}',
    'plugin.chartChanges.noChange':
        "Cette note n'a pas de grille d'accords ({block}) avec un changement d'accord.",
    'plugin.smooth.tooFew':
        "Cette note n'a pas de grille d'accords ({block}) avec au moins deux accords.",
    'plugin.backing.progressionName': 'Progression {n}',
    'plugin.backing.nothing':
        "Cette note n'a ni progression ({progression}), ni grille d'accords ({chords}), et ne lie aucune note d'accord à jouer.",

    // Play, drills, metronome
    'plugin.play.nothingYet':
        "Cette note n'a encore rien à jouer : ajoutez son accord et ses frettes, ou sa gamme.",
    'plugin.play.nothing': 'Rien à jouer dans cette note.',
    'plugin.drill.needsExerciseType':
        "Les exercices de changement d'accord ont besoin d'un type de note d'exercice de guitare pour conserver leurs résultats.",
    'plugin.metronome.noNote': "Le métronome n'a aucune note où enregistrer le BPM.",

    // Imports
    'plugin.import.noArrangementType':
        "Ouvrez une note en mode édition : il n'existe aucun type de note d'arrangement.",
    'plugin.import.done': 'Importé dans {note}.',
    'plugin.import.doneWhat': '{what} importé dans {note}.',
    'plugin.import.failed': "Impossible d'importer : {error}",
    'plugin.import.failedWhat': "Impossible d'importer {what} : {error}",

    // Practice timer
    'plugin.timer.started': 'Minuteur de pratique démarré.',
    'plugin.timer.notRunning': "Le minuteur de pratique n'est pas en cours.",
    'plugin.timer.tooLong':
        "Le minuteur de pratique a tourné pendant {elapsed} : vérifiez les minutes avant d'enregistrer.",
    'plugin.timer.discardTitle': 'Abandonner le minuteur de pratique',
    'plugin.timer.discardConfirm': 'Abandonner',
    'plugin.timer.discarded': "Minuteur de pratique abandonné : rien n'a été enregistré.",
    'plugin.timer.forgotten': '{duration} : oublié ?',
    'plugin.timer.staleLabel': "{stale} Cliquez pour l'enregistrer ; clic droit pour l'abandonner.",

    // Log practice
    'plugin.log.alreadyOpen': 'La fenêtre « Enregistrer la pratique » est déjà ouverte.',
    'plugin.log.activityCreated': 'Activité créée : {name}',
    'plugin.log.alreadyLogged':
        "Déjà enregistré : la note de séance de cet enregistrement a été réutilisée, rien n'est compté deux fois. « Annuler le dernier enregistrement de pratique » annule toujours le premier enregistrement.",
    'plugin.log.logged.one': 'Pratique enregistrée : {count} élément.',
    'plugin.log.logged.other': 'Pratique enregistrée : {count} éléments.',
    'plugin.log.undo': 'Annuler',
    'plugin.log.kapMissing':
        "Le minuteur du Kanban Action Planner a été arrêté, mais son entrée de temps n'est pas apparue à temps. Si elle apparaît sur l'activité, supprimez-la : la note de séance contient déjà ce temps.",

    // Undo
    'plugin.undo.anotherLog':
        'Un autre enregistrement a été fait depuis : utilisez « Annuler le dernier enregistrement de pratique » pour celui-là.',
    'plugin.undo.nothing': "Il n'y a aucun enregistrement de pratique à annuler.",
    'plugin.undo.done':
        'Enregistrement de pratique annulé : les notes sont revenues comme avant et la note de séance est dans la corbeille.',
    'plugin.undo.doneKap':
        "Enregistrement de pratique annulé. L'entrée de temps du minuteur du Kanban Action Planner est de nouveau sur l'activité.",
    'plugin.undo.activityStays': "{name} reste (vous l'avez créée).",
    'plugin.undo.activityKeeps': '{name} garde le type de séance dans ses types de séance.',

    // Activity time left over after a log
    'plugin.surplus.question':
        '{name} indique {stored} min, mais ses entrées de temps et ses séances en donnent {computed}. Garder les {difference} min comme entrée de temps « Manual adjustment », ou les abandonner ?',
    'plugin.surplus.keep': 'Garder',
    'plugin.surplus.drop': 'Abandonner',
    'plugin.surplus.nothingLeft': '{name} : rien à régler, son temps est resté tel quel.',
    'plugin.surplus.kept':
        '{name} : {difference} min gardées comme entrée de temps « Manual adjustment ».',
    'plugin.surplus.dropped':
        '{name} : {difference} min abandonnées, son temps est maintenant de {minutes} min.'
}
