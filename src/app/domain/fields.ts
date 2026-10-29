/**
 * The frontmatter property names the plugin reads and writes. Each one is used only when the note
 * type defines it. Review and time-tracking names follow the Kanban Action Planner's settings when
 * it is installed, so both plugins write the same properties.
 */
export interface FieldNames {
    /** Learning notes. */
    lastPracticed: string
    bpmCurrent: string
    bpmTarget: string
    priority: string
    prerequisites: string
    theory: string
    /** Chords and other voicings. */
    shape: string
    chordSymbol: string
    chordRoot: string
    chordQuality: string
    /** Guitar chords: frets and fingers, lowest string first ("x02220"), and the first fret shown. */
    frets: string
    fingers: string
    position: string
    /** Piano chords: pitches ("A3 C#4 E4") and fingering ("5 3 1"). */
    pitches: string
    fingering: string
    /** Exercises: the items they train (links); chord change drills: best and last counts. */
    trains: string
    changesBest: string
    changesLast: string
    /** Pieces: where they come from (links); imported score files are added here (#19). */
    sources: string
    /** Scales: root ("A"), type ("Minor pentatonic"), right-hand fingering (piano). */
    scaleRoot: string
    scaleType: string
    fingeringRight: string
    /** Spaced review (Kanban Action Planner: reviewed date / interval / count properties). */
    lastReviewed: string
    reviewInterval: string
    reviewCount: string
    /** Minutes, on learning notes, sessions and activities (Kanban Action Planner: duration property). */
    timeSpent: string
    /** Activities (Kanban Action Planner: time entries and last session properties). */
    timeEntries: string
    lastSession: string
    /** Session notes. */
    date: string
    startTime: string
    quality: string
    practiced: string
    activities: string
}

export function createDefaultFieldNames(): FieldNames {
    return {
        lastPracticed: 'date_last_practiced',
        bpmCurrent: 'bpm_current',
        bpmTarget: 'bpm_target',
        priority: 'priority',
        prerequisites: 'prerequisites',
        theory: 'theory',
        shape: 'shape',
        chordSymbol: 'chord_symbol',
        chordRoot: 'chord_root',
        chordQuality: 'chord_quality',
        frets: 'frets',
        fingers: 'fingers',
        position: 'position',
        pitches: 'pitches',
        fingering: 'fingering',
        trains: 'trains',
        changesBest: 'changes_best',
        changesLast: 'changes_last',
        sources: 'sources',
        scaleRoot: 'scale_root',
        scaleType: 'scale_type',
        fingeringRight: 'fingering_rh',
        lastReviewed: 'last_reviewed',
        reviewInterval: 'review_interval',
        reviewCount: 'review_count',
        timeSpent: 'time_spent',
        timeEntries: 'time_entries',
        lastSession: 'date_last_session',
        date: 'date',
        startTime: 'start_time',
        quality: 'session_quality',
        practiced: 'practiced',
        activities: 'related_activities'
    }
}
