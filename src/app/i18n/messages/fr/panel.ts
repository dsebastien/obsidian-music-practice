import type { Translation } from '../../translation'
import type { panelEn } from '../en/panel'

/** French texts of the panel area: exactly the keys of the English table. */
export const panelFr: Translation<typeof panelEn> = {
    'panel.title': 'Pratique',
    'panel.session': 'Séance',
    'panel.plan': 'Plan',
    'panel.drill': 'Exercice',
    'panel.drillLabel': 'Exercices',
    'panel.drill.chordChanges': "Changements d'accord",
    'panel.drill.notes': 'Notes, accords et gammes',
    'panel.drill.ear': "Entraînement de l'oreille",
    'panel.clear': 'Vider',
    'panel.logSession': 'Enregistrer cette séance',
    'panel.metronome': 'Métronome',
    'panel.timer.off': 'Minuteur arrêté',
    'panel.timer.paused': 'En pause · {time}',
    'panel.timer.resume': 'Reprendre',
    'panel.timer.discard': 'Abandonner',
    'panel.timer.discardLabel': "Abandonner le minuteur de pratique sans l'enregistrer",
    'panel.empty': "Rien pour l'instant : ajoutez des éléments, ou partez d'un plan de pratique.",
    'panel.practiced': 'Pratiqué : {name}',
    'panel.bpm': '{reached} BPM',
    'panel.bpmTarget': '{reached} → {target} BPM',
    'panel.bpmRaise': 'Augmenter le BPM atteint',
    'panel.bpmLower': 'Diminuer le BPM atteint',
    'panel.metronomeFor': 'Métronome pour {name}',
    'panel.remove': 'Retirer de la séance',
    'panel.pickPlaceholder': 'Ajouter un élément à la séance',

    // Item rows
    'panel.item.noMastery': 'Aucune maîtrise',
    'panel.item.reviewOverdue': 'Révision en retard',
    'panel.item.reviewDueSoon': 'Révision bientôt due',
    'panel.item.focus': 'Focus actuel',
    'panel.item.neverPracticed': 'Jamais pratiqué',
    'panel.item.practicedToday': "Pratiqué aujourd'hui",
    'panel.item.practicedAgo': 'Pratiqué il y a {days} j',
    'panel.item.bpmProgress': '{percent} % du BPM cible',
    'panel.item.bpmCurrent': '{current}/{target} BPM',
    'panel.item.minutes': '{minutes} min'
}
