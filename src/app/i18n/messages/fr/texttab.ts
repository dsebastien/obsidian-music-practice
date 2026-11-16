import type { Translation } from '../../translation'
import type { texttabEn } from '../en/texttab'

/** French texts of the text tab area: exactly the keys of the English table. */
export const texttabFr: Translation<typeof texttabEn> = {
    'texttab.showAsTab': 'Afficher en tablature',
    'texttab.editAlphaTex': 'Modifier en alphaTex',
    'texttab.text': 'Texte',
    'texttab.textTitle': "Afficher en texte : le bloc tel que vous l'avez écrit",
    'texttab.guessed': 'Rythme deviné à partir de la tablature',
    'texttab.editTitle':
        "Remplacer la tablature en texte par de l'alphaTex dans la note, pour corriger le rythme",
    'texttab.undo': 'Annuler',
    'texttab.notice.converted':
        'Tablature convertie. La tablature en texte reste dans un commentaire à la fin du bloc.',
    'texttab.notice.undone': 'La tablature en texte est revenue.',
    'texttab.error.blockNotFound':
        'Impossible de trouver ce bloc dans la note : il a peut-être changé. Réessayez.',
    'texttab.error.tabNotFound':
        'Impossible de trouver cette tablature en texte dans la note : elle a peut-être changé. Réessayez.',
    'texttab.error.keepView': 'Impossible de conserver la vue : {message}',
    'texttab.error.convert': 'Impossible de convertir la tablature : {message}',
    'texttab.error.undo':
        "Impossible d'annuler : la tablature convertie a changé ou n'est plus dans la note.",
    'texttab.alphatab.windowClosed': 'la fenêtre est fermée',
    'texttab.alphatab.notLoaded': "alphaTab ne s'est pas chargé",
    'texttab.alphatab.unknownRelease': "d'une version inconnue",
    'texttab.alphatab.otherPlugin':
        'un autre plugin a chargé alphaTab {version} ; Music Practice a besoin de {needed}'
}
