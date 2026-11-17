import type { Translation } from '../../translation'
import type { toolsEn } from '../en/tools'

/** French texts of the tools area: exactly the keys of the English table. */
export const toolsFr: Translation<typeof toolsEn> = {
    // Section name (play-along)
    'tools.section.title': 'Ajouter une section',
    'tools.section.nameLabel': 'Nom de la section',

    // Choose a chord reading
    'tools.chooseChord.placeholder':
        'Ces notes peuvent se lire de plusieurs façons : choisissez-en une',

    // Text tab and chord sheet import
    'tools.import.tabTitle': 'Importer une tablature texte',
    'tools.import.sheetTitle': "Importer une grille d'accords",
    'tools.import.tabHelp':
        "Collez une tablature (des lignes de tirets et de cases, une par corde). Elle devient un bloc de tablature que vous pouvez jouer. Une tablature texte n'a pas de rythme exact : le rythme vient de l'espacement.",
    'tools.import.sheetHelp':
        "Collez une grille d'accords (les accords sur leur propre ligne, au-dessus des paroles). Elle devient une grille d'accords que vous pouvez transposer.",
    'tools.import.insert': 'Insérer',
    'tools.import.nothing': "Rien dans ce texte n'a pu être converti.",
    'tools.import.modePlaceholder': 'Comment insérer la partition dans la note ?',
    'tools.import.modeLink': 'Lien vers le fichier',
    'tools.import.modeInline': 'alphaTex intégré',
    'tools.import.modeLinkHelp':
        'Le fichier est copié dans votre dossier de pièces jointes : rien ne se perd.',
    'tools.import.modeInlineHelp':
        'La musique sous forme de texte dans la note, modifiable ; certains détails du fichier peuvent se perdre.',

    // Chord changes of a chart
    'tools.changes.title': "Changements d'accord : {name}",
    'tools.changes.intro':
        "Les plus difficiles d'abord : l'amplitude du déplacement de la main entre les deux accords, puis la fréquence du changement dans le morceau.",
    'tools.changes.times.one': '{count} fois',
    'tools.changes.times.other': '{count} fois',
    'tools.changes.effortUnknown': 'effort inconnu',
    'tools.changes.effort': 'effort {effort}',
    'tools.changes.best': 'meilleur : {best} par minute',
    'tools.changes.and': ' et ',
    'tools.changes.noNote':
        "Aucune note d'accord pour {chords} : ajoutez-en une pour travailler ce changement.",
    'tools.changes.drill': "S'entraîner",

    // Key and scales of a piece
    'tools.pieceKey.title': 'Tonalité et gammes : {name}',
    'tools.pieceKey.chords': 'Accords : {chords}',
    'tools.pieceKey.key': 'Tonalité : {key}',
    'tools.pieceKey.keyBlues': 'Tonalité : {key} (blues)',
    'tools.pieceKey.noKey': 'Aucune tonalité trouvée',
    'tools.pieceKey.notClear': 'Pas net : {keys} conviennent à peu près aussi bien.',
    'tools.pieceKey.or': ' ou ',
    'tools.pieceKey.outside': 'Hors de la tonalité : {chords}',
    'tools.pieceKey.scales': 'Gammes qui conviennent',
    'tools.pieceKey.scaleOutside': '{name} (hors tonalité : {chords})',
    'tools.pieceKey.isKey': 'La tonalité est {key}',
    'tools.pieceKey.setKey': 'Définir la tonalité sur {key}',
    'tools.pieceKey.keySet': 'Tonalité définie sur {key}.',

    // Identify this chord
    'tools.identify.title': 'Identifier cet accord',
    'tools.identify.helpGuitar':
        'Cliquez sur une corde à une case pour la jouer à cet endroit ; cliquez à nouveau pour étouffer la corde.',
    'tools.identify.helpPiano':
        "Cliquez sur les touches de l'accord ; cliquez à nouveau sur une touche pour la retirer.",
    'tools.identify.ways': 'Cet accord se lit de {count} façons : choisissez-en une.',
    'tools.identify.is': "C'est {symbol}.",
    'tools.identify.nameIt': 'Nommer {symbol}',
    'tools.identify.nameSays': 'Le nom de la note indique {name} ({symbol}).',
    'tools.identify.nameSaysShape':
        'Le nom de la note indique {name} ({symbol}), avec la forme {shape}.',
    'tools.identify.nameFromName': "Nommer {symbol}, d'après le nom de la note",
    'tools.identify.failed': "Impossible de nommer l'accord : {message}",
    'tools.simplify.title': 'Simplifier cette grille : {name}',
    'tools.simplify.chart': 'Grille',
    'tools.simplify.chartN': 'Grille {n}',
    'tools.simplify.easier': 'Accords plus faciles : {chords}',
    'tools.simplify.noEasier': "Aucun accord de cette grille n'a de version plus facile.",
    'tools.simplify.capo':
        'Meilleur capodastre : case {capo}. Jouez {shapes} ({open} accords ouverts sur {total}).',
    'tools.simplify.noCapo': 'Aucun capodastre ne fait mieux que sans.',
    'tools.simplify.ownCapo':
        'Cette grille a son propre capodastre (case {capo}) : ses accords sont déjà les positions à jouer.',
    'tools.simplify.piano':
        'Les accords plus faciles et le meilleur capodastre concernent les grilles pour guitare.',
    'tools.simplify.switchOn': 'Activer dans la grille',
    'tools.simplify.alreadyOn': 'Déjà activé dans la grille',
    'tools.simplify.insertCopy': 'Insérer une copie simplifiée',
    'tools.simplify.switched': 'La grille affiche maintenant sa version plus facile.',
    'tools.simplify.inserted': 'Une copie simplifiée se trouve sous la grille.',
    'tools.simplify.changed': 'La grille a changé depuis : relancez la commande.',

    // Tab exercise
    'tools.exercise.title': 'Exercice de tablature : {name}',
    'tools.exercise.position': 'Position',
    'tools.exercise.direction': 'Direction',
    'tools.exercise.rhythm': 'Rythme',
    'tools.exercise.tempo': 'Tempo (BPM)',
    'tools.exercise.upDown': 'Montée et descente',
    'tools.exercise.up': 'Montée',
    'tools.exercise.down': 'Descente',
    'tools.exercise.eighths': 'Croches',
    'tools.exercise.triplets': 'Triolets',
    'tools.exercise.sixteenths': 'Doubles croches',
    'tools.exercise.help':
        'La tablature se joue avec le décompte, le métronome et le réglage de vitesse de sa barre de lecture.',
    'tools.exercise.insert': 'Insérer',
    'tools.exercise.cagedShape': 'Forme de {letter}',
    'tools.exercise.box': 'Position {n}',
    'tools.exercise.nps': '3NPS {n}',

    // Voicings of a chord
    'tools.voicings.title': 'Positions de {symbol}',
    'tools.voicings.titleChord': "Positions d'un accord",
    'tools.voicings.chord': 'Accord',
    'tools.voicings.chordPlaceholder': 'Am7',
    'tools.voicings.orClick': "Ou cliquez sur les cases de l'accord :",
    'tools.voicings.neck': 'Manche',
    'tools.voicings.rootOn': 'Fondamentale sur',
    'tools.voicings.anyString': "N'importe quelle corde",
    'tools.voicings.string6': '6e corde',
    'tools.voicings.string5': '5e corde',
    'tools.voicings.string4': '4e corde',
    'tools.voicings.inversions': 'Renversements',
    'tools.voicings.stretch': 'Écart',
    'tools.voicings.areaAll': 'Tout le manche',
    'tools.voicings.areaOpen': 'Première position',
    'tools.voicings.areaFrets': 'Cases {from}–{to}',
    'tools.voicings.baseFret': 'case {fret}',
    'tools.voicings.typeChord': 'Saisissez un accord pour voir toutes les façons de le jouer.',
    'tools.voicings.none':
        'Aucune position ne convient : élargissez la zone du manche, autorisez les renversements ou un écart.',
    'tools.voicings.easiest': "Les {shown} plus faciles sur {total}, les plus faciles d'abord.",
    'tools.voicings.count.one': "{count} position, la plus facile d'abord.",
    'tools.voicings.count.other': "{count} positions, les plus faciles d'abord.",
    'tools.voicings.dashed': 'En pointillés : la position de cette note.',
    'tools.voicings.labelCurrent': '{label} (cette note)',
    'tools.voicings.useThis': 'Utiliser cette position',
    'tools.voicings.useForNote': 'Utiliser pour cette note',
    'tools.voicings.addAsNote': 'Ajouter comme note',
    'tools.voicings.isCurrent': "C'est déjà la position de cette note.",
    'tools.voicings.conflictOwnOther':
        'Cette note est de forme {own} : ajoutez {other} comme note à part.',
    'tools.voicings.conflictOwn':
        'Cette note est de forme {own} : ajoutez cette position comme note à part.',
    'tools.voicings.conflictOther':
        "Cette note est d'une autre forme : ajoutez {other} comme note à part.",
    'tools.voicings.conflictNone':
        "Cette note est d'une autre forme : ajoutez cette position comme note à part.",

    // Triads
    'tools.triads.title': 'Triades',
    'tools.triads.ofA': "À partir d'un",
    'tools.triads.chord': 'Accord',
    'tools.triads.key': 'Tonalité',
    'tools.triads.chordOrKey': 'Accord ou tonalité',
    'tools.triads.strings': 'Cordes',
    'tools.triads.inversion': 'Renversement',
    'tools.triads.all': 'Tous',
    'tools.triads.rootPosition': 'Position fondamentale',
    'tools.triads.firstInversion': '1er renversement',
    'tools.triads.secondInversion': '2e renversement',
    'tools.triads.nameRoot': 'position fondamentale',
    'tools.triads.nameFirst': '1er renversement',
    'tools.triads.nameSecond': '2e renversement',
    'tools.triads.typeChordOrKey': 'Saisissez un accord (G, A Minor) ou une tonalité (G major).',
    'tools.triads.typeKey': 'Saisissez une tonalité : G major, E minor.',
    'tools.triads.noneForKey': 'Aucune triade pour cette tonalité sur ces cordes.',
    'tools.triads.notChord': "« {text} » n'est pas un accord que la bibliothèque connaît.",
    'tools.triads.noTriads':
        "{symbol} n'a pas de triade ici : il faut trois notes (G, Am, Bdim, Caug, Dsus4).",
    'tools.triads.count.one':
        '{count} triade sur les cordes {set}, en montant sur le manche. Les points montrent R, 3, 5.',
    'tools.triads.count.other':
        '{count} triades sur les cordes {set}, en montant sur le manche. Les points montrent R, 3, 5.',
    'tools.triads.metronome': 'Métronome',
    'tools.triads.useThis': 'Utiliser cette triade',
    'tools.triads.addAsNote': 'Ajouter comme note',

    // Easiest way from one chord to the next
    'tools.transition.title': 'Chemin le plus facile : {from} → {to}',
    'tools.transition.help':
        "Les doigts qui restent ont un anneau, ceux qui glissent un anneau en pointillés. Les plus faciles d'abord.",
    'tools.transition.noFrets': "{name} n'a pas de cases pour partir.",
    'tools.transition.held': '{symbol}, tenu',
    'tools.transition.thisNote': '{symbol}, cette note',
    'tools.transition.reverse': "Dans l'autre sens",
    'tools.transition.addAsNote': 'Ajouter comme note',

    // Smooth a progression
    'tools.progression.title': 'Lisser cette progression',
    'tools.progression.none': 'Aucune position jouable pour ces accords.',
    'tools.progression.help':
        '{chords} : les positions qui rendent toute la progression la plus facile. Les doigts qui restent ont un anneau, ceux qui glissent un anneau en pointillés.',
    'tools.progression.inNotes': 'Dans vos notes : {note}',
    'tools.progression.notYet': 'Pas encore dans vos notes',
    'tools.progression.addMissing.one': 'Ajouter {count} position manquante comme note',
    'tools.progression.addMissing.other': 'Ajouter {count} positions manquantes comme notes'
}
