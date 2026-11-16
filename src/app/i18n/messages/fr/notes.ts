import type { Translation } from '../../translation'
import type { notesEn } from '../en/notes'

/** French texts of the notes area: exactly the keys of the English table. */
export const notesFr: Translation<typeof notesEn> = {
    // Add a learning note
    'notes.add.title': "Ajouter une note d'apprentissage",
    'notes.add.type': 'Type',
    'notes.add.root': 'Fondamentale',
    'notes.add.scaleOrMode': 'Gamme ou mode',
    'notes.add.scaleMajor': 'Majeure',
    'notes.add.scaleNaturalMinor': 'Mineure naturelle',
    'notes.add.scaleHarmonicMinor': 'Mineure harmonique',
    'notes.add.scaleMelodicMinor': 'Mineure mélodique',
    'notes.add.scaleMajorPentatonic': 'Pentatonique majeure',
    'notes.add.scaleMinorPentatonic': 'Pentatonique mineure',
    'notes.add.scaleBlues': 'Blues',
    'notes.add.scaleDorian': 'Dorien',
    'notes.add.scalePhrygian': 'Phrygien',
    'notes.add.scaleLydian': 'Lydien',
    'notes.add.scaleMixolydian': 'Mixolydien',
    'notes.add.scaleLocrian': 'Locrien',
    'notes.add.nameGuitarChord': 'Accord (F#m7, A Major) ou cases (x02220)',
    'notes.add.namePianoChord': 'Accord (F#m7, A Major) ou touches (C4 E4 G4)',
    'notes.add.nameChord': 'Accord (F#m7, A Major)',
    'notes.add.nameArpeggio': "Accord de l'arpège (Am7, A Minor 7)",
    'notes.add.name': 'Nom',
    'notes.add.namePlaceholder': "Knockin' on Heaven's Door - Version simplifiée",
    'notes.add.pattern': 'Motif',
    'notes.add.timeSignature': 'Chiffrage de mesure',
    'notes.add.feel': 'Feeling',
    'notes.add.pickingPlaceholder': "Travis, ou p i m a p' i m a",
    'notes.add.chord': 'Accord',
    'notes.add.shape': 'Forme (facultatif)',
    'notes.add.mastery': 'Maîtrise',
    'notes.add.voicing': 'Position',
    'notes.add.moreVoicings': 'Plus de positions…',
    'notes.add.triads': 'Triades…',
    'notes.add.noneInDatabase': 'Aucune dans la base : voir Plus de positions',
    'notes.add.noneFound': 'Aucune trouvée : pas de diagramme',
    'notes.add.pickedFrets': 'Choisie : {frets}',
    'notes.add.noDiagram': 'Pas de diagramme',
    'notes.add.picked': 'Choisie',
    'notes.add.voicingLabel': 'Position {label} : {frets}',
    'notes.add.preview': 'Note : {title}',
    'notes.add.previewAlias': 'Note : {title} (alias {alias})',
    'notes.add.noChordFrets':
        "Ces cases ne forment aucun accord connu de la bibliothèque : saisissez plutôt l'accord.",
    'notes.add.noChordKeys':
        "Ces touches ne forment aucun accord connu de la bibliothèque : saisissez plutôt l'accord.",
    'notes.add.typeChord':
        'Saisissez un accord : son nom est écrit en toutes lettres, le symbole devient un alias.',
    'notes.add.pickScale': 'Choisissez une fondamentale et une gamme ou un mode.',

    // Creating a note
    'notes.create.exists': '« {title} » existe déjà.',

    // Importing a score file
    'notes.import.unreadable':
        "son texte est illisible (ce n'est pas du texte UTF-8, UTF-16 ou Windows-1252).",
    'notes.import.notScore': "« {name} » n'est pas un fichier de partition que ceci peut lire.",

    // Voicing notes
    'notes.voicing.unknownChord': 'Accord inconnu « {symbol} ».',
    'notes.voicing.noFrets': "Les notes {type} n'ont pas de propriété « {property} ».",
    'notes.voicing.alreadyNote': '{title} a déjà une note à cet endroit.'
}
