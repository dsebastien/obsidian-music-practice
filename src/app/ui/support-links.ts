import { Setting } from 'obsidian'
import { t } from '../i18n/i18n'

/**
 * Single source of truth for the support calls to action shown across every
 * surface of the plugin: the settings tab, the "What's new" dialog, the README
 * and the documentation site. Keep these in sync with `manifest.json`'s
 * `fundingUrl` and with `.github/FUNDING.yml`.
 */
export const KNOWII_COMMUNITY_URL = 'https://www.store.dsebastien.net/product/knowii-community/'
export const GITHUB_SPONSORS_URL = 'https://github.com/sponsors/dsebastien'
export const BUY_ME_A_COFFEE_URL = 'https://www.buymeacoffee.com/dsebastien'
export const YOUTUBE_CHANNEL_URL = 'https://youtube.com/@dsebastien'
export const NEWSLETTER_URL = 'https://dsebastien.net/newsletter'

/** Renders a Buy me a coffee badge (or anything else) below the settings. */
export type SupportBadgeRenderer = (containerEl: HTMLElement) => void

/**
 * Renders the shared support section: community, sponsoring and follow calls to
 * action. Every plugin's settings tab delegates to this so the wording and the
 * links stay identical across the whole plugin collection.
 *
 * @param containerEl where to render
 * @param renderBadge optional renderer for the Buy me a coffee badge, called
 * last (the badge asset lives in each plugin, so it is injected)
 */
export function renderSupportSection(
    containerEl: HTMLElement,
    renderBadge?: SupportBadgeRenderer
): void {
    new Setting(containerEl).setName(t('settings.support.heading')).setHeading()

    new Setting(containerEl)
        .setName(t('settings.support.knowii.name'))
        .setDesc(t('settings.support.knowii.desc'))
        .addButton((button) => {
            button
                .setCta()
                .setButtonText(t('settings.support.knowii.button'))
                .onClick(() => {
                    window.open(KNOWII_COMMUNITY_URL)
                })
        })

    new Setting(containerEl)
        .setName(t('settings.support.plugin.name'))
        .setDesc(t('settings.support.plugin.desc'))
        .addButton((button) => {
            button.setButtonText(t('settings.support.plugin.button')).onClick(() => {
                window.open(GITHUB_SPONSORS_URL)
            })
        })

    new Setting(containerEl)
        .setName(t('settings.support.touch.name'))
        .setDesc(t('settings.support.touch.desc'))
        .addButton((button) => {
            button.setButtonText(t('settings.support.touch.newsletter')).onClick(() => {
                window.open(NEWSLETTER_URL)
            })
        })
        .addButton((button) => {
            button.setButtonText(t('settings.support.touch.youtube')).onClick(() => {
                window.open(YOUTUBE_CHANNEL_URL)
            })
        })

    if (renderBadge) {
        renderBadge(containerEl)
    }

    const spacing = containerEl.createDiv()
    spacing.classList.add('support-header-margin')
}
