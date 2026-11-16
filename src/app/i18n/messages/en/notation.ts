/** English texts of the notation blocks, diagram images and note naming (keys are `notation.*`). */
export const notationEn = {
    'notation.loading': 'Loading…',
    'notation.blockText': 'Block text',

    // Note naming and root marks (the settings' dropdowns)
    'notation.naming.letters': 'Letters (C D E)',
    'notation.naming.solfege': 'Solfège (Do Ré Mi)',
    'notation.naming.german': 'German (H for B)',
    'notation.rootMark.color': 'Color',
    'notation.rootMark.shape': 'Color and shape',

    // Drill prompts rebuilt in the chosen naming
    'notation.prompt.findFret': 'Find {note} on string {string}',
    'notation.prompt.findKey': 'Find {note}',
    'notation.prompt.findScale': 'Find the notes of {scale}',

    // Saving a diagram as an image
    'notation.image.saveDiagram': 'Save diagram as {format}',
    'notation.image.saveBlock': 'Save block as {format}',
    'notation.image.failed': "Couldn't save the image: {error}",
    'notation.image.saved': 'Saved {path}',
    'notation.image.savedLinked': 'Saved {path} and linked it after the block.',
    'notation.image.savedNotLinked':
        "Saved {path}. The link wasn't added: the block isn't where it was drawn (edit the note, then save again), or this isn't a note.",
    'notation.image.folderIsFile': '"{path}" is a file, not a folder.',

    // The images folder setting
    'notation.folder.drive': 'Enter a folder of the vault, such as Music/Images (no drive).',
    'notation.folder.dots': 'Enter a folder of the vault, such as Music/Images (no . or ..).',
    'notation.folder.unsafe':
        'Folder names can\'t hold * ? " < > | or :. Enter a folder such as Music/Images.'
} as const
