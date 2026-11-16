import type { Translation } from '../../translation'
import type { logEn } from '../en/log'

/** French texts of the log area: exactly the keys of the English table. */
export const logFr: Translation<typeof logEn> = {
    'log.minutesShort': '{minutes} min',

    // Log practice
    'log.modal.title': 'Enregistrer la pratique',
    'log.modal.minutes': 'Minutes',
    'log.modal.date': 'Date',
    'log.modal.focus': 'Thème (facultatif)',
    'log.modal.focusExample': 'Accords barrés',
    'log.modal.pickTitle': "Qu'avez-vous pratiqué ?",
    'log.modal.filterPlaceholder': 'Filtrer les éléments…',
    'log.modal.filterLabel': 'Filtrer les éléments',
    'log.modal.note': 'Note (facultative)',
    'log.modal.discardTimer': 'Abandonner le minuteur',
    'log.modal.submit': 'Enregistrer la pratique',
    'log.modal.noMatch': "Aucune note d'apprentissage ne correspond.",
    'log.modal.otherInstrument': 'Autre instrument : enregistrez-le dans sa propre séance.',
    'log.modal.practiced': 'Pratiqué : {name}',
    'log.modal.sessionFor': 'Séance pour',
    'log.modal.choose': 'Choisir…',
    'log.modal.sessionQuality': 'Qualité de la séance',
    'log.modal.adoptTimer':
        'Utiliser le minuteur de Kanban Action Planner en cours sur {activity} depuis {time} (obligatoire : il chronomètre cette activité)',
    'log.modal.countsFor': "Compte pour l'activité",
    'log.modal.newActivityOption': 'Nouvelle activité…',
    'log.modal.noActivityOption': 'Aucune activité',
    'log.modal.newActivityName': 'Nom de la nouvelle activité',
    'log.modal.conflict':
        '{activities} listent {type} dans leurs types de séance : choisissez celle à laquelle il se rattache.',
    'log.modal.noneListed': 'Aucune activité ne liste encore {type} dans ses types de séance.',
    'log.modal.moved': 'Il est retiré des types de séance de {activities}.',
    'log.modal.willAdd':
        'Ajoute {type} à ses types de séance : les prochaines séances compteront aussi pour elle.',
    'log.modal.willCreate': 'Crée cette activité avec {type} dans ses types de séance.',
    'log.modal.willNone': 'Cette séance ne compte pour aucune activité.',
    'log.modal.bpmPlaceholder': 'BPM (cible : {target})',
    'log.modal.bpmLabel': 'BPM atteint sur {name}',
    'log.modal.masteryLabel': 'Maîtrise de {name}',
    'log.modal.reviewGroup': 'Résultat de la révision',
    'log.modal.review.good': 'Bien',
    'log.modal.review.shaky': 'Hésitant',
    'log.modal.review.failed': 'Raté',
    'log.modal.enterMinutes': 'Saisissez les minutes pratiquées.',
    'log.modal.chooseActivity': "Choisissez l'activité pour laquelle cette séance compte.",
    'log.modal.logged': '{minutes} min enregistrées : {logged}',

    // Mastery
    'log.mastery.title': 'Maîtrise : {name}',
    'log.mastery.current': 'Actuel',

    // Practice plan
    'log.plan.title': 'Plan de pratique',
    'log.plan.minutes': 'Minutes',
    'log.plan.minutesDesc': 'Combien de temps vous pouvez pratiquer maintenant.',
    'log.plan.empty':
        "Rien à pratiquer pour l'instant : aucune note d'apprentissage active ou à réviser.",
    'log.plan.block.warm-up': 'Échauffement',
    'log.plan.block.focus': 'Travail ciblé',
    'log.plan.block.review': 'Révision',
    'log.plan.block.fun': 'Plaisir',
    'log.plan.useInPanel': 'Utiliser dans le panneau',
    'log.plan.logSession': 'Enregistrer cette séance',

    // Practice next
    'log.next.title': 'Pratiquer ensuite',
    'log.next.empty':
        "Aucune note d'apprentissage pour l'instant. Ajoutez un accord, une gamme ou un morceau avec un niveau de maîtrise, et il apparaîtra ici.",
    'log.next.nothingDue':
        "Rien d'actif ni à réviser. Choisissez quelque chose que vous voulez apprendre et commencez à l'apprendre.",
    'log.next.due': 'À réviser',
    'log.next.next': 'Ensuite',
    'log.next.ready': 'Prêt à apprendre',
    'log.next.unlocks': 'Débloque {items}',

    // Practice timer
    'log.duration.lessThanMinute': "moins d'une minute",
    'log.duration.days.one': '{count} jour',
    'log.duration.days.other': '{count} jours',
    'log.duration.daysHours.one': '{count} jour {hours} h',
    'log.duration.daysHours.other': '{count} jours {hours} h',
    'log.duration.hours': '{hours} h',
    'log.duration.hoursMinutes': '{hours} h {minutes} min',
    'log.duration.minutes': '{minutes} min',
    'log.timer.stale': 'Démarré il y a {duration} : oublié ? Abandonnez-le ou enregistrez-le.',
    'log.timer.discard': "Abandonner le minuteur de pratique ({duration}) ? Rien n'est enregistré.",
    'log.timer.discardPracticed':
        "Abandonner le minuteur de pratique ({duration}, dont {practiced} de pratique) ? Rien n'est enregistré.",
    'log.timer.running':
        'Le minuteur de pratique est déjà en cours (démarré il y a {duration}). Arrêtez-le pour enregistrer la séance, ou lancez « Abandonner le minuteur de pratique ».',

    // A log request that can't be written
    'log.request.missing': "La demande d'enregistrement est absente.",
    'log.request.invalidDate': 'Date « {date} » invalide : format attendu AAAA-MM-JJ.',
    'log.request.minutes': 'Les minutes doivent être un nombre entier entre 1 et 1440.',
    'log.request.invalidStart': 'Heure de début « {time} » invalide : format attendu HH:MM.',
    'log.request.noItems': 'Choisissez au moins un élément à enregistrer.',
    'log.request.needsPath': 'Chaque élément doit avoir un chemin.',
    'log.request.listedTwice': '« {path} » est listé deux fois.',
    'log.request.invalidBpm': 'BPM invalide pour « {path} ».',
    'log.request.invalidLevel': 'Niveau invalide pour « {path} ».',
    'log.request.invalidReview':
        'Résultat de révision invalide pour « {path} » : good, shaky ou failed.',
    'log.request.mustBeText': '« {key} » doit être du texte.',
    'log.request.activity':
        "« activity » doit être le nom d'une note d'activité, ou null pour aucune.",

    // The log service
    'log.service.severalInstruments':
        'Enregistrez un seul instrument à la fois : ces éléments en concernent plusieurs.',
    'log.service.busy': "Un enregistrement de pratique est déjà en cours d'écriture.",
    'log.service.notAnActivity': "Ce n'est pas une activité : {path}.",
    'log.service.noActivityNamed': "Aucune note d'activité nommée « {name} ».",
    'log.service.notLearningNote': "Ce n'est pas une note d'apprentissage : {path}",
    'log.service.chooseInstrument': 'Choisissez pour quel instrument est cette séance.',
    'log.service.kapTimerRunning':
        "Un minuteur de Kanban Action Planner est en cours sur {activity} : utilisez-le pour cet enregistrement, ou arrêtez-le d'abord, pour que le temps ne soit pas compté deux fois.",
    'log.service.alreadyLogged':
        "Déjà enregistré dans {session}, avec d'autres valeurs pour {items} : rien n'a été écrit. Modifiez-les avec « Changer la maîtrise » ou « Définir le BPM », ou supprimez cette note de séance pour enregistrer à nouveau.",
    'log.service.kapStopFailed': "Impossible d'arrêter le minuteur de Kanban Action Planner.",
    'log.service.warn.conflict':
        "{type} est listé dans « {property} » par {activities} : la séance ne compte pour aucune activité tant que l'une d'elles ne le retire pas.",
    'log.service.warn.noneListed':
        'Aucune activité ne liste {type} dans « {property} » : la séance ne compte pour aucune activité. « Enregistrer la pratique » demande laquelle utiliser.',
    'log.service.warn.timeStored':
        '{item} : « {property} » vaut {stored} min et ses notes de séance donnent {computed} : laissé tel quel.',
    'log.service.warn.timeNotNumber':
        "{item} : « {property} » n'est pas un nombre, son temps n'a donc pas été recalculé.",
    'log.service.warn.itemNotIndexed':
        "{item} : Obsidian n'avait pas encore indexé le lien de la séance, son temps n'a donc pas été recalculé (le prochain enregistrement le fera).",
    'log.service.warn.otherActivity':
        "La note de séance de cet enregistrement ({session}) compte pour une autre activité ou aucune, pas pour {activity} : son activité n'a pas été modifiée.",
    'log.service.warn.noActivityField':
        "{activity} : la note de séance n'a pas de champ « {property} », son temps ne peut donc pas compter pour l'activité.",
    'log.service.warn.activityNotIndexed':
        "{activity} : Obsidian n'avait pas encore indexé le lien de la séance, le temps de l'activité n'a donc pas été recalculé. Utilisez dans un instant « Recompute tracked time » de Kanban Action Planner sur cette activité.",
    'log.service.warn.activityNotIndexedTimer':
        "{activity} : Obsidian n'avait pas encore indexé le lien de la séance, le temps de l'activité n'a donc pas été recalculé et l'entrée de temps du minuteur y reste (supprimez-la : la séance contient ce temps). Utilisez dans un instant « Recompute tracked time » de Kanban Action Planner sur cette activité.",
    'log.service.warn.entriesNotList':
        "{activity} : ses entrées de temps ne forment pas une liste, son temps n'a donc pas été recalculé.",
    'log.service.activityGone': "L'activité n'existe plus : {path}",
    'log.service.bpmRange': 'Le BPM doit être un nombre entier entre 1 et 1000.',
    'log.service.noFolder': "{session} n'a pas de dossier.",
    'log.service.noFreeName': 'Aucun nom libre pour « {name} ».',

    // Undo of a log
    'log.undo.busy': "Un enregistrement de pratique est en cours d'écriture.",
    'log.undo.reused':
        "Cette exécution a réutilisé la note de séance d'un enregistrement précédent : il n'y a rien à annuler.",
    'log.undo.sessionGone':
        "La note de séance de cet enregistrement a été déplacée ou supprimée ({path}) : rien n'a été annulé.",
    'log.undo.movedOrDeleted': '{path} (déplacé ou supprimé)',
    'log.undo.changed': "Modifié depuis l'enregistrement, rien n'a été annulé : {names}.",
    'log.undo.halfway':
        "L'annulation s'est arrêtée à mi-chemin ({error}) : relancez-la pour terminer.",

    // Activities
    'log.activity.nameIt': 'Donnez un nom à la nouvelle activité.',
    'log.activity.badChars':
        "Un nom d'activité ne peut contenir aucun de ces caractères : {chars}.",
    'log.activity.exists': '« {name} » existe déjà : comptez plutôt les séances pour elle.',

    // The URI handler
    'log.uri.missing': 'URI de Music Practice : ajoutez do=<action> ({list}).',
    'log.uri.unknownAction':
        'URI de Music Practice : action « {action} » inconnue. Utilisez {list}.',
    'log.uri.unknownParams': 'URI de Music Practice : paramètre inconnu {params}.',
    'log.uri.minutesOnly':
        "URI de Music Practice : les minutes ne fonctionnent qu'avec log et plan.",
    'log.uri.minutesRange':
        'URI de Music Practice : les minutes doivent être un nombre entier de 1 à {max}, et non « {text} ».'
}
