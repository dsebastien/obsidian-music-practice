import type { Translation } from '../../translation'
import type { whatsnewEn } from '../en/whatsnew'

/** French texts of the What\'s new tab: exactly the keys of the English table. */
export const whatsnewFr: Translation<typeof whatsnewEn> = {
    'whatsnew.title': 'Nouveautés : {plugin} {version}',
    'whatsnew.updated': 'Mis à jour vers la version {version}.',
    'whatsnew.knowii.name': 'Rejoindre la communauté Knowii',
    'whatsnew.knowii.desc':
        "Apprenez à organiser vos notes et à mettre vos connaissances au travail, avec d'autres travailleurs du savoir.",
    'whatsnew.knowii.button': 'Rejoindre Knowii',
    'whatsnew.support.name': 'Soutenir ce plugin',
    'whatsnew.support.desc':
        'Votre soutien permet de continuer le développement et la maintenance ❤️',
    'whatsnew.support.githubSponsors': 'GitHub Sponsors',
    'whatsnew.support.buyMeACoffee': 'Offrez-moi un café',
    'whatsnew.support.youtube': 'YouTube'
}
