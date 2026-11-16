/**
 * English texts of the log area (the source; keys are `log.*`): Log practice, mastery, practice
 * plans, Practice next, the timer's messages, the log and activity services' messages, the URI's.
 */
export const logEn = {
    'log.minutesShort': '{minutes} min',

    // Log practice
    'log.modal.title': 'Log practice',
    'log.modal.minutes': 'Minutes',
    'log.modal.date': 'Date',
    'log.modal.focus': 'Focus (optional)',
    'log.modal.focusExample': 'Barre chords',
    'log.modal.pickTitle': 'What did you practice?',
    'log.modal.filterPlaceholder': 'Filter items…',
    'log.modal.filterLabel': 'Filter items',
    'log.modal.note': 'Note (optional)',
    'log.modal.discardTimer': 'Discard timer',
    'log.modal.submit': 'Log practice',
    'log.modal.noMatch': 'No learning note matches.',
    'log.modal.otherInstrument': 'Another instrument: log it in its own session.',
    'log.modal.practiced': 'Practiced {name}',
    'log.modal.sessionFor': 'Session for',
    'log.modal.choose': 'Choose…',
    'log.modal.sessionQuality': 'Session quality',
    'log.modal.adoptTimer':
        'Use the Kanban Action Planner timer running on {activity} since {time} (required: it times this activity)',
    'log.modal.countsFor': 'Counts for the activity',
    'log.modal.newActivityOption': 'New activity…',
    'log.modal.noActivityOption': 'No activity',
    'log.modal.newActivityName': 'New activity name',
    'log.modal.conflict':
        '{activities} list {type} in their session types: pick the one it counts for.',
    'log.modal.noneListed': 'No activity lists {type} in its session types yet.',
    'log.modal.moved': 'It is removed from the session types of {activities}.',
    'log.modal.willAdd': 'Adds {type} to its session types: later sessions count for it too.',
    'log.modal.willCreate': 'Creates this activity with {type} in its session types.',
    'log.modal.willNone': 'This session counts for no activity.',
    'log.modal.bpmPlaceholder': 'BPM (target {target})',
    'log.modal.bpmLabel': 'BPM reached on {name}',
    'log.modal.masteryLabel': 'Mastery of {name}',
    'log.modal.reviewGroup': 'Review result',
    'log.modal.review.good': 'Good',
    'log.modal.review.shaky': 'Shaky',
    'log.modal.review.failed': 'Failed',
    'log.modal.enterMinutes': 'Enter the minutes practiced.',
    'log.modal.chooseActivity': 'Choose the activity this session counts for.',
    'log.modal.logged': 'Logged {minutes} min: {logged}',

    // Mastery
    'log.mastery.title': 'Mastery: {name}',
    'log.mastery.current': 'Current',

    // Practice plan
    'log.plan.title': 'Practice plan',
    'log.plan.minutes': 'Minutes',
    'log.plan.minutesDesc': 'How long you can practice now.',
    'log.plan.empty': 'Nothing to practice yet: no active or due learning notes.',
    'log.plan.block.warm-up': 'Warm-up',
    'log.plan.block.focus': 'Focus',
    'log.plan.block.review': 'Review',
    'log.plan.block.fun': 'Fun',
    'log.plan.useInPanel': 'Use in panel',
    'log.plan.logSession': 'Log this session',

    // Practice next
    'log.next.title': 'Practice next',
    'log.next.empty':
        'No learning notes yet. Add a chord, a scale or a piece with a mastery level, and it shows up here.',
    'log.next.nothingDue':
        'Nothing active or due. Pick something you want to learn and start learning it.',
    'log.next.due': 'Due for review',
    'log.next.next': 'Next',
    'log.next.ready': 'Ready to learn',
    'log.next.unlocks': 'Unlocks {items}',

    // Practice timer
    'log.duration.lessThanMinute': 'less than a minute',
    'log.duration.days.one': '{count} day',
    'log.duration.days.other': '{count} days',
    'log.duration.daysHours.one': '{count} day {hours} h',
    'log.duration.daysHours.other': '{count} days {hours} h',
    'log.duration.hours': '{hours} h',
    'log.duration.hoursMinutes': '{hours} h {minutes} min',
    'log.duration.minutes': '{minutes} min',
    'log.timer.stale': 'Started {duration} ago: forgotten? Discard or log it.',
    'log.timer.discard': 'Discard the practice timer ({duration})? Nothing is logged.',
    'log.timer.discardPracticed':
        'Discard the practice timer ({duration}, {practiced} of practice)? Nothing is logged.',
    'log.timer.running':
        'The practice timer is already running (started {duration} ago). Stop it to log the session, or run Discard practice timer.',

    // A log request that can't be written
    'log.request.missing': 'The log request is missing.',
    'log.request.invalidDate': 'Invalid date "{date}": expected YYYY-MM-DD.',
    'log.request.minutes': 'Minutes must be a whole number between 1 and 1440.',
    'log.request.invalidStart': 'Invalid start time "{time}": expected HH:MM.',
    'log.request.noItems': 'Pick at least one item to log.',
    'log.request.needsPath': 'Every item needs a path.',
    'log.request.listedTwice': '"{path}" is listed twice.',
    'log.request.invalidBpm': 'Invalid BPM for "{path}".',
    'log.request.invalidLevel': 'Invalid level for "{path}".',
    'log.request.invalidReview': 'Invalid review result for "{path}": good, shaky or failed.',
    'log.request.mustBeText': '"{key}" must be text.',
    'log.request.activity': '"activity" must be the name of an activity note, or null for none.',

    // The log service
    'log.service.severalInstruments':
        'Log one instrument at a time: these items belong to several.',
    'log.service.busy': 'A practice log is already being written.',
    'log.service.notAnActivity': 'Not an activity: {path}.',
    'log.service.noActivityNamed': 'No activity note named "{name}".',
    'log.service.notLearningNote': 'Not a learning note: {path}',
    'log.service.chooseInstrument': 'Choose which instrument this session is for.',
    'log.service.kapTimerRunning':
        "A Kanban Action Planner timer is running on {activity}: use it for this log, or stop it first, so the time isn't counted twice.",
    'log.service.alreadyLogged':
        'Already logged in {session}, with other values for {items}: nothing was written. Change them with Change mastery or Set BPM, or delete that session note to log again.',
    'log.service.kapStopFailed': 'Could not stop the Kanban Action Planner timer.',
    'log.service.warn.conflict':
        '{type} is listed in "{property}" by {activities}: the session counts for no activity until one of them drops it.',
    'log.service.warn.noneListed':
        'No activity lists {type} in "{property}": the session counts for no activity. Log practice asks which one to use.',
    'log.service.warn.timeStored':
        '{item}: "{property}" is {stored} min and its session notes give {computed}: left as it is.',
    'log.service.warn.timeNotNumber':
        '{item}: "{property}" isn\'t a number, so its time wasn\'t recomputed.',
    'log.service.warn.itemNotIndexed':
        "{item}: Obsidian hadn't indexed the session's link yet, so its time wasn't recomputed (its next log does it).",
    'log.service.warn.otherActivity':
        'The session note of that log ({session}) counts for another activity or none, not {activity}: its activity was left as it is.',
    'log.service.warn.noActivityField':
        '{activity}: the session note has no "{property}" field, so its time can\'t count for the activity.',
    'log.service.warn.activityNotIndexed':
        "{activity}: Obsidian hadn't indexed the session's link yet, so the activity's time wasn't recomputed. Use the Kanban Action Planner's Recompute tracked time on it in a moment.",
    'log.service.warn.activityNotIndexedTimer':
        "{activity}: Obsidian hadn't indexed the session's link yet, so the activity's time wasn't recomputed and the timer's time entry is still on it (delete it: the session holds that time). Use the Kanban Action Planner's Recompute tracked time on it in a moment.",
    'log.service.warn.entriesNotList':
        "{activity}: its time entries aren't a list, so its time wasn't recomputed.",
    'log.service.activityGone': 'The activity is gone: {path}',
    'log.service.bpmRange': 'BPM must be a whole number between 1 and 1000.',
    'log.service.noFolder': '{session} has no folder.',
    'log.service.noFreeName': 'No free name for "{name}".',

    // Undo of a log
    'log.undo.busy': 'A practice log is being written.',
    'log.undo.reused':
        'That run reused the session note of an earlier log: it changed nothing to undo.',
    'log.undo.sessionGone':
        'The session note of that log was moved or deleted ({path}): nothing was undone.',
    'log.undo.movedOrDeleted': '{path} (moved or deleted)',
    'log.undo.changed': 'Changed since the log, nothing was undone: {names}.',
    'log.undo.halfway': 'The undo stopped halfway ({error}): run it again to finish.',

    // Activities
    'log.activity.nameIt': 'Name the new activity.',
    'log.activity.badChars': "An activity name can't hold any of these: {chars}.",
    'log.activity.exists': '"{name}" already exists: count the sessions for it instead.',

    // The URI handler
    'log.uri.missing': 'Music Practice URI: add do=<action> ({list}).',
    'log.uri.unknownAction': 'Music Practice URI: unknown action "{action}". Use {list}.',
    'log.uri.unknownParams': 'Music Practice URI: unknown parameter {params}.',
    'log.uri.minutesOnly': 'Music Practice URI: minutes only work with log and plan.',
    'log.uri.minutesRange':
        'Music Practice URI: minutes must be a whole number from 1 to {max}, not "{text}".'
} as const
