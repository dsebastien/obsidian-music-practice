/** English texts of the text tab area: plain-text tabs, and alphaTab's loading (keys are `texttab.*`). */
export const texttabEn = {
    'texttab.showAsTab': 'Show as tab',
    'texttab.editAlphaTex': 'Edit as alphaTex',
    'texttab.text': 'Text',
    'texttab.textTitle': 'Show as text: the block as you wrote it',
    'texttab.guessed': 'Rhythm guessed from the tab',
    'texttab.editTitle': 'Replace the text tab with alphaTex in the note, to correct the rhythm',
    'texttab.undo': 'Undo',
    'texttab.notice.converted':
        'Converted the tab. The text tab stays in a comment at the end of the block.',
    'texttab.notice.undone': 'The text tab is back.',
    'texttab.error.blockNotFound':
        "Couldn't find this block in the note: it may have changed. Try again.",
    'texttab.error.tabNotFound':
        "Couldn't find this text tab in the note: it may have changed. Try again.",
    'texttab.error.keepView': "Couldn't keep the view: {message}",
    'texttab.error.convert': "Couldn't convert the tab: {message}",
    'texttab.error.undo': "Couldn't undo: the converted tab changed or isn't in the note anymore.",
    'texttab.alphatab.windowClosed': 'the window is closed',
    'texttab.alphatab.notLoaded': 'alphaTab did not load',
    'texttab.alphatab.unknownRelease': 'of an unknown release',
    'texttab.alphatab.otherPlugin':
        'another plugin loaded alphaTab {version}; Music Practice needs {needed}'
} as const
