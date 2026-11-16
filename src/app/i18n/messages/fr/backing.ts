import type { Translation } from '../../translation'
import type { backingEn } from '../en/backing'

/** French texts of the backing area: exactly the keys of the English table. */
export const backingFr: Translation<typeof backingEn> = {
    'backing.title': 'En rythme : {name}',
    'backing.source.chart': "Grille d'accords",
    'backing.source.linked': "Notes d'accords liées",
    'backing.progression': 'Progression',
    'backing.strum': 'Rythmique',
    'backing.strum.beats': 'Un coup sur chaque temps',
    'backing.strum.bar': 'Un coup par mesure',
    'backing.strum.arpeggio': 'Arpège',
    'backing.strum.blockPattern': 'Le motif du bloc ({pattern})',
    'backing.tempo': 'Tempo (BPM)',
    'backing.click': 'Clic',
    'backing.countIn': 'Décompte',
    'backing.trainer.one': 'Montée en tempo (+{step} BPM à chaque mesure)',
    'backing.trainer.other': 'Montée en tempo (+{step} BPM toutes les {count} mesures)',
    'backing.trainerUpTo.one': "Montée en tempo (+{step} BPM à chaque mesure, jusqu'à {target})",
    'backing.trainerUpTo.other':
        "Montée en tempo (+{step} BPM toutes les {count} mesures, jusqu'à {target})",
    'backing.saveBpm': 'Enregistrer le BPM',
    'backing.meter.chord.one':
        "{count} mesure en {label}, un accord par mesure. Les changements s'appliquent au passage suivant.",
    'backing.meter.chord.other':
        "{count} mesures en {label}, un accord par mesure. Les changements s'appliquent au passage suivant.",
    'backing.meter.chordDotted.one':
        "{count} mesure en {label}, un accord par mesure, comptée en temps pointés. Les changements s'appliquent au passage suivant.",
    'backing.meter.chordDotted.other':
        "{count} mesures en {label}, un accord par mesure, comptées en temps pointés. Les changements s'appliquent au passage suivant.",
    'backing.meter.chart.one':
        "{count} mesure en {label}, selon les barres de mesure de la grille. Les changements s'appliquent au passage suivant.",
    'backing.meter.chart.other':
        "{count} mesures en {label}, selon les barres de mesure de la grille. Les changements s'appliquent au passage suivant.",
    'backing.meter.chartDotted.one':
        "{count} mesure en {label}, selon les barres de mesure de la grille, comptée en temps pointés. Les changements s'appliquent au passage suivant.",
    'backing.meter.chartDotted.other':
        "{count} mesures en {label}, selon les barres de mesure de la grille, comptées en temps pointés. Les changements s'appliquent au passage suivant.",
    'backing.status.countingIn': 'Décompte à {bpm} BPM…',
    'backing.status.playing': 'Mesure {bar} sur {total}, passage {pass}, {bpm} BPM',
    'backing.status.stopped': 'Arrêté.'
}
