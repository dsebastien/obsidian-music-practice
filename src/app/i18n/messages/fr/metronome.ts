import type { Translation } from '../../translation'
import type { metronomeEn } from '../en/metronome'

/** French texts of the metronome area: exactly the keys of the English table. */
export const metronomeFr: Translation<typeof metronomeEn> = {
    'metronome.title': 'Métronome',
    'metronome.error.noWebAudio':
        "Cet appareil n'a pas de Web Audio : le métronome ne peut pas jouer.",
    'metronome.bpm': 'BPM',
    'metronome.nudge': '{by} BPM',
    'metronome.tap': 'Taper',
    'metronome.beatsPerBar': 'Temps par mesure',
    'metronome.clicks': 'Clics',
    'metronome.subdivision.quarter': 'Noires',
    'metronome.subdivision.eighths': 'Croches',
    'metronome.subdivision.triplets': 'Triolets',
    'metronome.subdivision.sixteenths': 'Doubles croches',
    'metronome.countIn': 'Décompte',
    'metronome.countIn.none': 'Aucun',
    'metronome.countIn.bars.one': '{count} mesure',
    'metronome.countIn.bars.other': '{count} mesures',
    'metronome.flash': 'Flash',
    'metronome.volume': 'Volume',
    'metronome.trainer': 'Entraînement progressif',
    'metronome.trainer.info.one': '+{step} à chaque mesure',
    'metronome.trainer.info.other': '+{step} toutes les {count} mesures',
    'metronome.trainer.infoTarget.one': "+{step} à chaque mesure, jusqu'à {target}",
    'metronome.trainer.infoTarget.other': "+{step} toutes les {count} mesures, jusqu'à {target}",
    'metronome.stepUp': 'Augmenter le tempo maintenant',
    'metronome.saveBpm': 'Enregistrer le BPM dans la note',
    'metronome.status.countIn': 'Décompte…',
    'metronome.status.fromNote': "{label}, d'après la note",
    'metronome.meterBeats.one': '{label} ({count} temps)',
    'metronome.meterBeats.other': '{label} ({count} temps)',
    'metronome.item.withTempo': '{name} · {current} → {target} BPM',
    'metronome.item.none':
        'Aucune note : ouvrez-en une, ou choisissez un élément dans le panneau de pratique, pour enregistrer son BPM.',
    'metronome.bpmModal.title': 'BPM : {name}',
    'metronome.bpmModal.current': 'BPM actuel',
    'metronome.bpmModal.target': 'BPM cible',
    'metronome.bpmModal.moveToTempo': 'Cible atteinte : passer à « au tempo »',
    'metronome.saveBpmBar.label': 'Enregistrer dans cette note le BPM de lecture',
    'metronome.saveBpmBar.title': 'Enregistrer le BPM',
    'metronome.click.frets': 'Cliquez sur les cases',
    'metronome.click.keys': 'Cliquez sur les touches',
    'metronome.click.nearIntro':
        'Aucun accord avec exactement ces notes. Accords qui les contiennent :',
    'metronome.click.nearMatch': '{symbol} (manque {missing})',
    'metronome.click.hintFew':
        "Cliquez sur au moins deux notes : l'accord qu'elles forment s'affiche ici.",
    'metronome.click.hintNone':
        'Aucun accord courant ne contient toutes ces notes : retirez-en une.'
}
