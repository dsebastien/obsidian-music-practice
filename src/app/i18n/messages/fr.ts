import type { Translation } from '../translation'
import type { en } from './en'
import { commonFr } from './fr/common'
import { settingsFr } from './fr/settings'
import { notationFr } from './fr/notation'
import { pluginFr } from './fr/plugin'
import { whatsnewFr } from './fr/whatsnew'
import { logFr } from './fr/log'
import { panelFr } from './fr/panel'
import { notesFr } from './fr/notes'
import { toolsFr } from './fr/tools'
import { drillsFr } from './fr/drills'
import { metronomeFr } from './fr/metronome'
import { playalongFr } from './fr/playalong'
import { backingFr } from './fr/backing'
import { texttabFr } from './fr/texttab'

/** The French table: exactly the keys of the English one. */
export const fr: Translation<typeof en> = {
    ...commonFr,
    ...settingsFr,
    ...notationFr,
    ...pluginFr,
    ...whatsnewFr,
    ...logFr,
    ...panelFr,
    ...notesFr,
    ...toolsFr,
    ...drillsFr,
    ...metronomeFr,
    ...playalongFr,
    ...backingFr,
    ...texttabFr
}
