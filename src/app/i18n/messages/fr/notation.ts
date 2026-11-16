import type { Translation } from '../../translation'
import type { notationEn } from '../en/notation'

/** French texts of the notation blocks, diagram images and note naming. */
export const notationFr: Translation<typeof notationEn> = {
    'notation.loading': 'Chargement…',
    'notation.blockText': 'Texte du bloc',

    // Note naming and root marks (the settings' dropdowns)
    'notation.naming.letters': 'Lettres (C D E)',
    'notation.naming.solfege': 'Solfège (Do Ré Mi)',
    'notation.naming.german': 'Allemand (H pour si)',
    'notation.rootMark.color': 'Couleur',
    'notation.rootMark.shape': 'Couleur et forme',

    // Drill prompts rebuilt in the chosen naming
    'notation.prompt.findFret': 'Trouvez {note} sur la corde {string}',
    'notation.prompt.findKey': 'Trouvez {note}',
    'notation.prompt.findScale': 'Trouvez les notes de {scale}',

    // Saving a diagram as an image
    'notation.image.saveDiagram': 'Enregistrer le diagramme en {format}',
    'notation.image.saveBlock': 'Enregistrer le bloc en {format}',
    'notation.image.failed': "Impossible d'enregistrer l'image : {error}",
    'notation.image.saved': '{path} enregistré',
    'notation.image.savedLinked': '{path} enregistré et lié après le bloc.',
    'notation.image.savedNotLinked':
        "{path} enregistré. Le lien n'a pas été ajouté : le bloc n'est plus là où il a été dessiné (modifiez la note, puis enregistrez de nouveau), ou ce n'est pas une note.",
    'notation.image.folderIsFile': '« {path} » est un fichier, pas un dossier.',

    // The images folder setting
    'notation.folder.drive': 'Saisissez un dossier du coffre, comme Music/Images (sans lecteur).',
    'notation.folder.dots': 'Saisissez un dossier du coffre, comme Music/Images (sans . ni ..).',
    'notation.folder.unsafe':
        'Les noms de dossiers ne peuvent pas contenir * ? " < > | ni :. Saisissez un dossier comme Music/Images.'
}
