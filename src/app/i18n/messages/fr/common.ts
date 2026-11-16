import type { Translation } from '../../translation'
import type { commonEn } from '../en/common'

/** French texts of the common area: exactly the keys of the English table. */
export const commonFr: Translation<typeof commonEn> = {
    'common.cancel': 'Annuler',
    'common.close': 'Fermer',
    'common.save': 'Enregistrer',
    'common.delete': 'Supprimer',
    'common.confirm': 'Confirmer',
    'common.add': 'Ajouter',
    'common.create': 'Créer',
    'common.remove': 'Retirer',
    'common.apply': 'Appliquer',
    'common.done': 'Terminé',
    'common.back': 'Retour',
    'common.next': 'Suivant',
    'common.start': 'Démarrer',
    'common.stop': 'Arrêter',
    'common.play': 'Lecture',
    'common.pause': 'Pause',
    'common.reset': 'Réinitialiser',
    'common.minutes.one': '{count} minute',
    'common.minutes.other': '{count} minutes'
}
