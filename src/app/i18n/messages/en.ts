import { commonEn } from './en/common'
import { settingsEn } from './en/settings'
import { notationEn } from './en/notation'
import { pluginEn } from './en/plugin'
import { whatsnewEn } from './en/whatsnew'
import { logEn } from './en/log'
import { panelEn } from './en/panel'
import { notesEn } from './en/notes'
import { toolsEn } from './en/tools'
import { drillsEn } from './en/drills'
import { metronomeEn } from './en/metronome'
import { playalongEn } from './en/playalong'
import { backingEn } from './en/backing'
import { texttabEn } from './en/texttab'

/** The English table: the source of every key, and the fallback of every language. */
export const en = {
    ...commonEn,
    ...settingsEn,
    ...notationEn,
    ...pluginEn,
    ...whatsnewEn,
    ...logEn,
    ...panelEn,
    ...notesEn,
    ...toolsEn,
    ...drillsEn,
    ...metronomeEn,
    ...playalongEn,
    ...backingEn,
    ...texttabEn
} as const
