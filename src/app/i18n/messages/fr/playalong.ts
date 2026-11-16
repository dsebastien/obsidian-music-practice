import type { Translation } from '../../translation'
import type { playalongEn } from '../en/playalong'

/** French texts of the play-along area: exactly the keys of the English table. */
export const playalongFr: Translation<typeof playalongEn> = {
    'playalong.player': 'Lecteur play-along : {name}',
    'playalong.play': 'Lecture (Espace)',
    'playalong.pause': 'Pause (Espace)',
    'playalong.position': 'Position',
    'playalong.speed': 'Vitesse',
    'playalong.slower': 'Plus lent (−)',
    'playalong.faster': 'Plus rapide (+)',
    'playalong.setA': 'Placer A à la position de lecture ([)',
    'playalong.setB': 'Placer B à la position de lecture (])',
    'playalong.markA': 'A : {time} ([)',
    'playalong.markB': 'B : {time} (])',
    'playalong.loop': 'Boucler de A à B (L)',
    'playalong.clearLoop': 'Effacer la boucle',
    'playalong.countIn': 'Décompte avant chaque passage (C)',
    'playalong.tap': 'Taper',
    'playalong.tapTempo': 'Taper le tempo (T)',
    'playalong.addSection': 'Ajouter une section à la position de lecture (M)',
    'playalong.saveBpm': 'Enregistrer dans cette note le BPM de lecture',
    'playalong.goTo': 'Aller à {label}',
    'playalong.loopSection': 'Boucler {label}',
    'playalong.tempo': '{bpm} BPM ({source})',
    'playalong.noTempo': 'Aucun tempo',
    'playalong.tempoSource.block': 'ligne tempo',
    'playalong.tempoSource.tapped': 'tapé',
    'playalong.tempoSource.target': 'cible',
    'playalong.status.countIn': 'Décompte…',
    'playalong.status.loop': 'Boucle {from} – {to}',
    'playalong.section.default': 'Section {n}',
    'playalong.problem.tempoTwice': 'Ligne {line} : le bloc a déjà un tempo (ligne {other})',
    'playalong.problem.tempoRange':
        'Ligne {line} : le tempo doit être un nombre de BPM de 20 à 300 (tempo: 120)',
    'playalong.problem.fileTwice': 'Ligne {line} : le bloc a déjà un fichier (ligne {other})',
    'playalong.problem.notSection': "La ligne {line} n'est pas une section : écrivez 0:12 Couplet",
    'playalong.mark.tooClose': "A et B doivent être séparés d'au moins une demi-seconde.",
    'playalong.notice.tapFirst': "Tapez d'abord le tempo : Enregistrer le BPM en a besoin.",
    'playalong.notice.countInNoTempo': "Décompte : tapez d'abord le tempo (T, ou le bouton Taper).",
    'playalong.notice.setAB': "Placez d'abord A et B ([ et ]).",
    'playalong.notice.sectionTooShort':
        "Cette section est trop courte pour boucler, ou l'enregistrement se charge encore.",
    'playalong.error.unsupported': 'Cet appareil ne peut pas lire ce fichier.',
    'playalong.error.loadFailed': "Impossible de charger l'enregistrement.",
    'playalong.error.loadFailedWith': "Impossible de charger l'enregistrement : {message}",
    'playalong.error.playFailed': "Impossible de lire l'enregistrement : {message}",
    'playalong.error.addSection': "Impossible d'ajouter la section",
    'playalong.error.writeTempo': "Impossible d'écrire le tempo",
    'playalong.error.failedWith': '{failure} : {message}',
    'playalong.error.blockNotFound':
        'Impossible de trouver ce bloc dans la note : il a peut-être changé. Réessayez.',
    'playalong.error.noFileLine':
        "playalong : indiquez l'enregistrement sur une ligne à part, par exemple {example}",
    'playalong.error.noFile': 'playalong : aucun fichier « {file} » dans le coffre',
    'playalong.error.notMedia': "playalong : « {path} » n'est pas un fichier audio ou vidéo"
}
