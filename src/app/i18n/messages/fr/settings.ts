import type { Translation } from '../../translation'
import type { settingsEn } from '../en/settings'

/** French texts of the settings tab: exactly the keys of the English table. */
export const settingsFr: Translation<typeof settingsEn> = {
    // Groups and pages
    'settings.group.notation': 'Blocs de notation',
    'settings.group.playback': 'Lecture',
    'settings.group.metronome': 'Métronome',
    'settings.group.playAlong': 'Jouer avec un enregistrement',
    'settings.group.masteryLevels': 'Niveaux de maîtrise',
    'settings.group.spacedReview': 'Révision espacée',
    'settings.group.practiceScore': 'Score de pratique',
    'settings.group.practicePlan': 'Plan de pratique',
    'settings.group.rubricChord': 'Accords',
    'settings.group.rubricPiece': 'Arrangements et morceaux',
    'settings.group.rubricPattern': 'Gammes, techniques, exercices et autres types',
    'settings.group.learningNotes': "Notes d'apprentissage",
    'settings.group.sessionsActivities': 'Séances et activités',
    'settings.group.levelNames': 'Noms des niveaux',
    'settings.page.rules.name': 'Règles',
    'settings.page.rules.desc':
        'Niveaux de maîtrise, révision espacée, score de pratique et plans de pratique.',
    'settings.page.rubric.name': 'Grille de niveaux',
    'settings.page.rubric.desc':
        "Ce que signifie chaque niveau de maîtrise, affiché quand vous changez la maîtrise d'un élément.",
    'settings.page.fields.name': 'Noms des propriétés',
    'settings.page.fields.desc':
        'Propriétés du frontmatter que le plugin lit et écrit. Les propriétés de révision et de temps suivent Kanban Action Planner quand il est installé.',
    'settings.page.local.name': 'Modèle de notes autonome',
    'settings.page.local.desc':
        "Utilisé quand l'Obsidian Starter Kit n'est pas disponible. Les notes d'apprentissage sont les notes taguées type/<domaine>/<sujet>/<type> (par exemple type/music/guitar/chord) qui ont un niveau de maîtrise.",
    'settings.page.types.name': 'Types de notes utilisés',
    'settings.page.types.desc': "Les types d'apprentissage et de séance trouvés par le plugin.",
    'settings.types.learning': "Types d'apprentissage",
    'settings.types.session': 'Types de séance',

    // Note types row
    'settings.noteTypes.starterKit':
        "Depuis l'Obsidian Starter Kit : {counts}. Ses types de notes gèrent les statuts, les dossiers, les modèles et les dates.",
    'settings.noteTypes.standalone':
        "Depuis le modèle de notes autonome du plugin (l'Obsidian Starter Kit n'est pas disponible) : {counts}.",
    'settings.noteTypes.counts': '{learning}, {sessions}',
    'settings.noteTypes.learning.one': "{count} type d'apprentissage",
    'settings.noteTypes.learning.other': "{count} types d'apprentissage",
    'settings.noteTypes.session.one': '{count} type de séance',
    'settings.noteTypes.session.other': '{count} types de séance',

    // Row shapes built from a description
    'settings.toggleDesc': '{desc} Blocs de code nommés « {language} ».',
    'settings.orientationDesc': '{desc} Un bloc peut en décider autrement avec « orientation: ».',

    // Dropdown options
    'settings.option.vertical': 'Vertical',
    'settings.option.horizontal': 'Horizontal',
    'settings.option.soundfont': 'Soundfont',
    'settings.option.light': 'Synthétiseur léger',
    'settings.option.bpm': 'BPM',
    'settings.option.percent': 'Pourcentage',
    'settings.option.quarter': 'Noires',
    'settings.option.eighth': 'Croches',
    'settings.option.triplet': 'Triolets',
    'settings.option.sixteenth': 'Doubles croches',

    // Status rows
    'settings.status.taken':
        "Un autre plugin dessine déjà les blocs {blocks}, Music Practice les laisse donc tranquilles. Les blocs désactivés s'affichent comme du code ; rechargez le plugin pour laisser un autre plugin les dessiner.",
    'settings.status.off':
        "Les blocs désactivés s'affichent comme du code ; rechargez le plugin pour laisser un autre plugin les dessiner.",
    'settings.playAlongStatus.taken':
        'Un autre plugin dessine déjà les blocs playalong, Music Practice les laisse donc tranquilles.',
    'settings.playAlongStatus.off':
        "Désactivés, les blocs s'affichent comme du code ; rechargez le plugin pour laisser un autre plugin les dessiner.",

    // Reset
    'settings.reset.done': 'Réglages de Music Practice réinitialisés.',
    'settings.reset.title': 'Réinitialiser les réglages de Music Practice ?',
    'settings.reset.body':
        'Les règles, la grille de niveaux, les noms des propriétés et le modèle de notes autonome reviennent à leurs valeurs par défaut. Vos notes ne sont pas modifiées.',

    // Support
    'settings.support.heading': 'Soutien',
    'settings.support.coffeeAlt': 'Offrez-moi un café',
    'settings.support.knowii.name': 'Rejoindre la communauté Knowii',
    'settings.support.knowii.desc':
        "Apprenez à organiser vos notes et à mettre vos connaissances au travail, avec d'autres travailleurs du savoir.",
    'settings.support.knowii.button': 'Rejoindre Knowii',
    'settings.support.plugin.name': 'Soutenir ce plugin',
    'settings.support.plugin.desc':
        'Votre soutien permet de continuer le développement et la maintenance ❤️',
    'settings.support.plugin.button': 'GitHub Sponsors',
    'settings.support.touch.name': 'Rester en contact',
    'settings.support.touch.desc':
        'Obsidian, gestion des connaissances personnelles et prise de notes, directement dans votre boîte mail et votre fil.',
    'settings.support.touch.newsletter': 'Newsletter',
    'settings.support.touch.youtube': 'YouTube',

    // Checks
    'settings.error.invalid': 'Valeur invalide.',
    'settings.error.unknown': 'Réglage inconnu « {key} ».',
    'settings.error.onOff': 'Activé ou désactivé attendu.',
    'settings.error.minNumber': 'Saisissez un nombre supérieur ou égal à {min}.',
    'settings.error.whole': 'Saisissez un nombre entier.',
    'settings.error.atMost': 'Saisissez au plus {max}.',
    'settings.error.text': 'Saisissez du texte.',
    'settings.error.choose': 'Choisissez {values}.',
    'settings.error.needsValue': "Ce réglage a besoin d'une valeur.",
    'settings.error.numberList': 'Saisissez {count} nombres séparés par des virgules.',
    'settings.error.atLeastOne': 'Saisissez au moins une valeur.',
    'settings.error.notEditable': '« {key} » ne peut pas être modifié ici.',
    'settings.error.splitTotal': 'Les quatre blocs doivent totaliser 100 %.',
    'settings.error.levelsIncrease':
        'Les niveaux doivent croître : à apprendre < apprentissage < lentement < au tempo < rouillé < maîtrisé.',
    'settings.error.reviewInterval':
        "L'intervalle de révision maximal doit être au moins égal au premier intervalle (1 jour ou plus).",
    'settings.error.fieldEmpty': 'Les noms de propriétés ne peuvent pas être vides.',
    'settings.error.fieldDuplicate': '« {name} » est utilisé pour deux propriétés.',
    'settings.words.or2': '{a} ou {b}',
    'settings.words.orMore': '{list} ou {last}',

    // Rows with name only
    'settings.label.noteTypes': 'Types de notes',
    'settings.label.status': 'État',
    'settings.label.types': 'Types',
    'settings.label.support': 'Soutien',
    'settings.label.want': 'À apprendre',
    'settings.label.learning': 'En apprentissage',
    'settings.label.slow': 'Jouable lentement',
    'settings.label.tempo': 'Jouable au tempo',
    'settings.label.rusty': 'Rouillé',
    'settings.label.mastered': 'Maîtrisé',
    'settings.label.lastPracticed': 'Dernière pratique',
    'settings.label.bpmCurrent': 'BPM actuel',
    'settings.label.bpmTarget': 'BPM cible',
    'settings.label.priority': 'Priorité',
    'settings.label.prerequisites': 'Prérequis',
    'settings.label.theory': 'Théorie',
    'settings.label.chordSymbol': "Symbole d'accord",
    'settings.label.chordRoot': "Fondamentale de l'accord",
    'settings.label.chordQuality': "Qualité de l'accord",
    'settings.label.lastReviewed': 'Dernière révision',
    'settings.label.reviewInterval': 'Intervalle de révision',
    'settings.label.reviewCount': 'Nombre de révisions',
    'settings.label.date': 'Date de la séance',
    'settings.label.startTime': 'Heure de début',
    'settings.label.quality': 'Qualité de la séance',
    'settings.label.practiced': 'Éléments pratiqués',
    'settings.label.activities': 'Activités',

    // Rows with a description
    'settings.item.planMinutes.name': 'Durée par défaut du plan de pratique',
    'settings.item.planMinutes.desc':
        'Minutes proposées quand vous planifiez une séance de pratique.',
    'settings.item.notesHeading.name': 'Titre des notes de séance',
    'settings.item.notesHeading.desc':
        "Titre de la section de la note de séance qui reçoit la note d'un enregistrement (« Notes »).",
    'settings.item.activityName.name': "Nom de l'activité",
    'settings.item.activityName.desc':
        "Le nom que Enregistrer la pratique propose pour une nouvelle activité, {token} étant l'instrument (« Apprendre {token} » : « Apprendre Guitare »). Sans l'Obsidian Starter Kit ni session_types, l'activité à laquelle comptent vos séances quand aucune séance précédente n'en lie une.",

    'settings.item.toggleChord.name': "Diagrammes d'accords",
    'settings.item.toggleChord.desc': 'Diagrammes de guitare et accords de piano.',
    'settings.item.toggleChords.name': "Grilles d'accords",
    'settings.item.toggleChords.desc': 'ChordPro : accords au-dessus des paroles, transposables.',
    'settings.item.toggleKeyboard.name': 'Claviers',
    'settings.item.toggleKeyboard.desc': 'Gammes, accords et notes sur un clavier de piano.',
    'settings.item.toggleFretboard.name': 'Manches',
    'settings.item.toggleFretboard.desc': 'Gammes, accords et notes sur un manche de guitare.',
    'settings.item.toggleTab.name': 'Tablatures',
    'settings.item.toggleTab.desc':
        'Tablature en alphaTex (ou un fichier Guitar Pro ou MusicXML), avec lecture.',
    'settings.item.toggleScore.name': 'Partitions',
    'settings.item.toggleScore.desc':
        'Notation standard en alphaTex (ou un fichier de partition), avec lecture.',
    'settings.item.toggleStrum.name': 'Rythmiques',
    'settings.item.toggleStrum.desc':
        "Grattés vers le bas et vers le haut sur une grille de temps, avec accents et changements d'accords, jouables.",
    'settings.item.togglePicking.name': 'Motifs de picking',
    'settings.item.togglePicking.desc':
        'Fingerpicking (lettres PIMA ou numéros de cordes, Travis, basse alternée) en petite tablature, joué en mesure sur un accord ou une grille.',
    'settings.item.toggleProgression.name': "Progressions d'accords",
    'settings.item.toggleProgression.desc':
        "Chiffres romains ou numéros Nashville dans n'importe quelle tonalité, avec leurs accords.",
    'settings.item.toggleCircle.name': 'Cycle des quintes',
    'settings.item.toggleCircle.desc':
        "Les tonalités, leurs relatives mineures et les accords d'une tonalité sur la roue.",
    'settings.item.leftHanded.name': 'Gaucher',
    'settings.item.leftHanded.desc':
        "Inverse les diagrammes d'accords de guitare et les manches (la corde grave à droite). Un bloc peut en décider autrement avec « hand: right ».",
    'settings.item.chordOrientation.name': "Orientation des diagrammes d'accords",
    'settings.item.chordOrientation.desc':
        'Vertical : le sillet en haut. Horizontal : les cordes en travers, corde aiguë en haut, comme dans les tablatures.',
    'settings.item.fretboardOrientation.name': 'Orientation du manche',
    'settings.item.fretboardOrientation.desc':
        "Horizontal : la corde aiguë en haut, comme dans les tablatures. Vertical : le sillet en haut, comme un diagramme d'accord.",
    'settings.item.keyboardOrientation.name': 'Orientation du clavier',
    'settings.item.keyboardOrientation.desc':
        'Horizontal : les notes graves à gauche. Vertical : les notes graves en bas. Les accords de piano la suivent.',
    'settings.item.naming.name': 'Noms des notes',
    'settings.item.naming.desc':
        'Comment les diagrammes et les exercices affichent les noms de notes : C D E, Do Ré Mi, ou allemand (H pour si, B pour si bémol). Affichage seulement : les blocs sont lus tels que vous les avez écrits, et les notes gardent des lettres dans leurs noms et leurs propriétés. Un bloc peut en décider autrement avec « naming: ».',
    'settings.item.rootMark.name': 'Marques de fondamentale',
    'settings.item.rootMark.desc':
        "Comment les diagrammes et les exercices marquent la fondamentale : par sa couleur, ou par sa couleur et une forme (un point carré, un carré sur la touche), que l'on distingue sans voir les couleurs. Un bloc peut en décider autrement avec « root-mark: ».",
    'settings.item.imageFolder.name': 'Dossier des images de diagrammes',
    'settings.item.imageFolder.desc':
        "Où un clic droit sur un diagramme l'enregistre en fichier PNG ou SVG : un dossier du coffre (Music/Images), créé s'il manque. Vide : l'emplacement des pièces jointes qu'Obsidian utilise pour la note (Réglages → Fichiers et liens).",
    'settings.item.imageEmbed.name': 'Intégrer les images enregistrées',
    'settings.item.imageEmbed.desc':
        "Après l'enregistrement d'un diagramme en image, place un lien vers elle (une intégration) sur sa propre ligne, juste après le bloc dans la note.",

    'settings.item.playEnabled.name': 'Jouer les diagrammes',
    'settings.item.playEnabled.desc':
        "Un clic sur un diagramme d'accord, de clavier ou de manche le joue, et un clic sur un point ou une touche joue cette note. Une barre sous chaque bloc joue ses diagrammes un par un ou tous à la suite, avec boucle, vitesse et son.",
    'settings.item.playEngine.name': 'Son',
    'settings.item.playEngine.desc':
        'Soundfont : des instruments enregistrés, comme pour les tablatures et les partitions (réaliste). Léger : un petit synthétiseur calculé, comme sur Obsidian Publish.',
    'settings.item.playVolume.name': 'Volume',
    'settings.item.playVolume.desc':
        "De 0 à 100. Le volume de toutes les barres de lecture : diagrammes, rythmiques et motifs de picking, progressions et grilles d'accords. Les barres n'ont pas de contrôle de volume.",
    'settings.item.playBpm.name': 'Tempo des gammes',
    'settings.item.playBpm.desc':
        'Notes par minute quand une gamme est jouée, de 20 à 240. La barre peut le changer pour un seul bloc.',
    'settings.item.playStrum.name': 'Grattage',
    'settings.item.playStrum.desc':
        'Millisecondes entre deux cordes quand un accord de guitare est gratté, de 0 à 200 (12 par défaut). Les accords de piano sonnent ensemble.',
    'settings.item.tempoUnit.name': 'Tempo des tablatures',
    'settings.item.tempoUnit.desc':
        "L'unité que la barre sous une tablature ou une partition affiche d'abord : BPM (le tempo auquel la musique est jouée, avec le pourcentage à côté) ou pourcentage du tempo écrit. Le bouton d'unité d'une barre la change et l'enregistre ici.",

    'settings.item.beatsPerBar.name': 'Temps par mesure',
    'settings.item.beatsPerBar.desc': 'De 2 à 12 ; le premier est accentué.',
    'settings.item.clicks.name': 'Clics',
    'settings.item.clicks.desc': 'Par temps : noires, croches, triolets ou doubles croches.',
    'settings.item.metronomeVolume.name': 'Volume',
    'settings.item.metronomeVolume.desc': 'De 0 à 1.',
    'settings.item.trainerStep.name': 'Palier de la montée en tempo',
    'settings.item.trainerStep.desc': 'BPM ajoutés à chaque palier.',
    'settings.item.trainerBars.name': 'Mesures de la montée en tempo',
    'settings.item.trainerBars.desc':
        'Mesures entre deux paliers (le bouton « + » passe au palier suivant tout de suite).',
    'settings.item.countIn.name': 'Décompte',
    'settings.item.countIn.desc':
        "Mesures de clics avant la première mesure, de 0 (aucune) à 4. Quand il est actif, un exercice de changements d'accords compte 3, 2, 1 avant sa minute.",
    'settings.item.flash.name': 'Flash à chaque temps',
    'settings.item.flash.desc':
        'Une lumière qui clignote à chaque temps, le premier temps dans une autre couleur : pour les salles bruyantes.',
    'settings.item.drillSeconds.name': "Durée de l'exercice de changements d'accords",
    'settings.item.drillSeconds.desc':
        "Secondes, de 10 à 600 (une minute est l'exercice classique).",
    'settings.item.drillQuestions.name': 'Questions par exercice',
    'settings.item.drillQuestions.desc':
        "Exercices de notes, d'accords et de gammes : questions dans un exercice, de 1 à 100.",
    'settings.item.weakShare.name': 'Part des points faibles',
    'settings.item.weakShare.desc':
        "Pourcentage des questions posées sur vos points faibles (le plus d'erreurs, les réponses les plus lentes), de 0 à 100.",
    'settings.item.clearStreak.name': 'Bonnes réponses pour lever un point faible',
    'settings.item.clearStreak.desc':
        "Bonnes réponses d'affilée, chacune plus rapide que le temps ci-dessous, après lesquelles un point n'est plus faible (1 à 10).",
    'settings.item.fastSeconds.name': 'Réponse rapide',
    'settings.item.fastSeconds.desc':
        "Secondes : une bonne réponse plus rapide que cela compte pour lever un point faible (0,5 à 10). L'entraînement de l'oreille a le sien, ci-dessous.",
    'settings.item.earFastSeconds.name': "Réponse rapide, entraînement de l'oreille",
    'settings.item.earFastSeconds.desc':
        "Secondes, pour les intervalles, accords, gammes et degrés à l'oreille : nommer ce que vous entendez prend plus de temps (0,5 à 20, 4 par défaut). Cela décide aussi quand l'entraînement guidé ajoute l'élément suivant.",
    'settings.item.guided.name': "Entraînement de l'oreille guidé",
    'settings.item.guided.desc':
        "Les exercices d'oreille commencent par deux intervalles, accords, gammes ou degrés, et ajoutent le suivant quand vous les connaissez tous (chaque point levé, comme ci-dessus). Désactivé : tous ceux que vous avez choisis dès le début.",

    'settings.item.playAlong.name': 'Lecteur pour jouer avec un enregistrement',
    'settings.item.playAlong.desc':
        'Un bloc de code playalong joue un enregistrement du coffre (audio ou vidéo) avec une boucle A-B, la vitesse sans changer la hauteur, ses sections et un décompte avant chaque passage.',
    'settings.item.preRoll.name': 'Pré-roll',
    'settings.item.preRoll.desc':
        'Secondes jouées avant A à chaque passage de la boucle, de 0 à 2 (0,2 par défaut), pour que la première note ne soit pas coupée.',

    'settings.item.levelWant.name': 'À apprendre',
    'settings.item.levelWant.desc': 'Niveau de la liste de souhaits.',
    'settings.item.levelLearning.name': 'En apprentissage',
    'settings.item.levelLearning.desc': 'Premier niveau actif.',
    'settings.item.levelSlow.name': 'Jouable lentement',
    'settings.item.levelSlow.desc': "L'atteindre démarre la révision espacée.",
    'settings.item.levelTempo.name': 'Jouable au tempo',
    'settings.item.levelTempo.desc': 'Proposé quand le BPM cible est atteint.',
    'settings.item.levelRusty.name': 'Rouillé',
    'settings.item.levelRusty.desc': 'Où une révision ratée fait redescendre un élément maîtrisé.',
    'settings.item.levelMastered.name': 'Maîtrisé',
    'settings.item.levelMastered.desc': 'Terminé ; les éléments maîtrisés restent en révision.',

    'settings.item.firstInterval.name': 'Premier intervalle (jours)',
    'settings.item.firstInterval.desc':
        'Défini quand un élément atteint « Jouable lentement », et après une révision ratée.',
    'settings.item.maxInterval.name': 'Intervalle maximal (jours)',
    'settings.item.maxInterval.desc': 'Les bonnes révisions ne dépassent jamais cet intervalle.',
    'settings.item.goodMultiplier.name': "Multiplicateur d'une bonne révision",
    'settings.item.goodMultiplier.desc':
        "Une bonne révision multiplie l'intervalle par cette valeur.",
    'settings.item.dueSoonMaxDays.name': 'Fenêtre « bientôt à réviser » (jours)',
    'settings.item.dueSoonMaxDays.desc': "Au plus ce nombre de jours avant la fin de l'intervalle.",
    'settings.item.dueSoonDivisor.name': 'Diviseur « bientôt à réviser »',
    'settings.item.dueSoonDivisor.desc':
        "La fenêtre est aussi au plus l'intervalle divisé par cette valeur.",

    'settings.item.priorityBase.name': 'Base de priorité',
    'settings.item.priorityBase.desc':
        'Les points de priorité valent cette valeur moins le numéro de priorité.',
    'settings.item.priorityUnknown.name': 'Points sans priorité',
    'settings.item.priorityUnknown.desc': 'Quand la priorité est à définir ou absente.',
    'settings.item.priorityTbd.name': 'Numéro de priorité « à définir »',
    'settings.item.priorityTbd.desc': 'Le numéro de priorité qui signifie « à définir ».',
    'settings.item.neverPracticed.name': 'Jamais pratiqué',
    'settings.item.neverPracticed.desc': "Points d'ancienneté d'un élément jamais pratiqué.",
    'settings.item.stalenessMaxDays.name': "Plafond d'ancienneté sans intervalle (jours)",
    'settings.item.stalenessMaxDays.desc':
        "Les jours depuis la dernière pratique comptent jusqu'à cette valeur.",
    'settings.item.stalenessIntervalCap.name': "Plafond d'ancienneté avec intervalle",
    'settings.item.stalenessIntervalCap.desc':
        "Jours depuis la dernière pratique divisés par l'intervalle, plafonnés à cette valeur.",
    'settings.item.stalenessIntervalWeight.name': "Poids de l'ancienneté avec intervalle",
    'settings.item.stalenessIntervalWeight.desc': 'Ce rapport est multiplié par cette valeur.',
    'settings.item.bpmGapDivisor.name': "Diviseur de l'écart de BPM",
    'settings.item.bpmGapDivisor.desc':
        'Le pourcentage de BPM manquant est divisé par cette valeur.',
    'settings.item.perUnlock.name': 'Points par déblocage',
    'settings.item.perUnlock.desc':
        'Pour chaque élément « À apprendre » qui renvoie vers celui-ci.',
    'settings.item.maxUnlocks.name': 'Déblocages comptés',
    'settings.item.maxUnlocks.desc': 'Au plus ce nombre de déblocages comptent.',
    'settings.item.rustyBonus.name': 'Bonus de rouille',
    'settings.item.rustyBonus.desc': 'Points en plus pour les éléments rouillés.',

    'settings.item.planSplit.name': 'Blocs (%)',
    'settings.item.planSplit.desc':
        'Échauffement, travail principal, révision et plaisir, pour un total de 100 : « 15, 50, 20, 15 ».',
    'settings.item.minMinutes.name': 'Minutes par élément (minimum)',
    'settings.item.minMinutes.desc':
        'Chaque élément planifié reçoit au moins ce nombre de minutes.',
    'settings.item.maxItems.name': 'Éléments par bloc (maximum)',
    'settings.item.maxItems.desc': "Moins d'éléments, plus de profondeur.",
    'settings.item.warmUpKinds.name': "Types d'échauffement",
    'settings.item.warmUpKinds.desc':
        "Types pratiqués à l'échauffement, séparés par des virgules : « technique, exercise ».",

    'settings.item.fieldSources.name': 'Sources',
    'settings.item.fieldSources.desc':
        'Morceaux : liens vers leur origine ; les fichiers de partition importés sont ajoutés ici.',
    'settings.item.fieldKey.name': 'Tonalité',
    'settings.item.fieldKey.desc': 'Morceaux : « G major », « E minor ».',
    'settings.item.fieldPieceChords.name': 'Accords utilisés',
    'settings.item.fieldPieceChords.desc':
        "Morceaux : les notes d'accords qu'ils utilisent (liens).",
    'settings.item.fieldTimeSignature.name': 'Signature rythmique',
    'settings.item.fieldTimeSignature.desc':
        'Morceaux, rythmiques et motifs de picking : « 3/4 », « 6/8 »… Le métronome la compte quand il pratique la note.',
    'settings.item.fieldShape.name': 'Forme',
    'settings.item.fieldShape.desc': 'Accords et gammes : à vide, barré, CAGED…',
    'settings.item.fieldFrets.name': 'Cases',
    'settings.item.fieldFrets.desc': 'Accords de guitare : « x02220 ».',
    'settings.item.fieldFingers.name': 'Doigts',
    'settings.item.fieldFingers.desc': 'Accords de guitare : « x01230 ».',
    'settings.item.fieldPosition.name': 'Position',
    'settings.item.fieldPosition.desc': 'Accords de guitare : la première case affichée.',
    'settings.item.fieldPitches.name': 'Hauteurs',
    'settings.item.fieldPitches.desc': 'Accords de piano : « A3 C#4 E4 ».',
    'settings.item.fieldFingering.name': 'Doigté',
    'settings.item.fieldFingering.desc': 'Accords de piano : « 5 3 1 ».',
    'settings.item.fieldTrains.name': 'Entraîne',
    'settings.item.fieldTrains.desc': "Exercices : ce qu'ils entraînent (liens).",
    'settings.item.fieldChangesBest.name': 'Meilleurs changements',
    'settings.item.fieldChangesBest.desc':
        "Exercices de changements d'accords : meilleur nombre de changements par minute.",
    'settings.item.fieldChangesLast.name': 'Derniers changements',
    'settings.item.fieldChangesLast.desc':
        "Exercices de changements d'accords : changements du dernier exercice.",
    'settings.item.fieldDrillKind.name': "Type d'exercice",
    'settings.item.fieldDrillKind.desc':
        "Exercices de notes : ce que travaille la note d'exercice (notes du manche, notes du clavier, noms d'accords, formes de gammes).",
    'settings.item.fieldDrillSetting.name': "Réglage de l'exercice",
    'settings.item.fieldDrillSetting.desc':
        'Exercices de notes : le réglage en mots (« string 5, frets 0-5 »).',
    'settings.item.fieldPublicNote.name': 'Note publique',
    'settings.item.fieldPublicNote.desc':
        "Notes d'apprentissage : indique si la note est publiée. Les nouvelles notes d'exercice reçoivent false ; la publication reste votre choix.",
    'settings.item.fieldDrillStats.name': "Points faibles de l'exercice",
    'settings.item.fieldDrillStats.desc':
        'Exercices de notes : la carte des points faibles (« s5f3 C: 7/9 1.8s »).',
    'settings.item.fieldExerciseKind.name': "Type d'exercice musical",
    'settings.item.fieldExerciseKind.desc':
        "Exercices de musique : le type d'exercice. Les notes d'entraînement de l'oreille reçoivent Ear training.",
    'settings.item.fieldScaleRoot.name': 'Fondamentale de la gamme',
    'settings.item.fieldScaleRoot.desc': 'Gammes : « A ».',
    'settings.item.fieldScaleType.name': 'Type de gamme',
    'settings.item.fieldScaleType.desc': 'Gammes : « Minor pentatonic ».',
    'settings.item.fieldFingeringRight.name': 'Doigté de la gamme',
    'settings.item.fieldFingeringRight.desc': 'Gammes de piano, main droite : « 1 2 3 1 2 3 4 5 ».',
    'settings.item.fieldStrumPattern.name': 'Rythmique',
    'settings.item.fieldStrumPattern.desc': 'Rythmiques : « D DU UDU ».',
    'settings.item.fieldStrumFeel.name': 'Feeling',
    'settings.item.fieldStrumFeel.desc':
        'Rythmiques : « straight », « swing » ou un taux de swing (« 60% »).',
    'settings.item.fieldPickingPattern.name': 'Motif de picking',
    'settings.item.fieldPickingPattern.desc':
        'Motifs de fingerpicking : un nom (« travis », « alternate bass », « 1-2-3-4 ») ou « p i m a ».',
    'settings.item.fieldTimeSpent.name': 'Minutes',
    'settings.item.fieldTimeSpent.desc':
        "Sur les notes d'apprentissage, les séances et les activités.",
    'settings.item.fieldPracticedMinutes.name': 'Minutes par élément',
    'settings.item.fieldPracticedMinutes.desc':
        "Sur les séances : « <minutes> [[<note>]] » pour chaque élément pratiqué. Les notes d'apprentissage en tirent leurs minutes.",
    'settings.item.fieldSessionTypes.name': 'Types de séance',
    'settings.item.fieldSessionTypes.desc':
        'Sur les activités : les types de notes de séance qui comptent pour elles (guitar-practice-sessions).',
    'settings.item.fieldTimeEntries.name': 'Entrées de temps',
    'settings.item.fieldTimeEntries.desc':
        "Sur les activités. Lues pour calculer leurs minutes ; un enregistrement retire l'entrée d'un minuteur Kanban Action Planner qu'il reprend.",
    'settings.item.fieldLastSession.name': 'Date de la dernière séance',
    'settings.item.fieldLastSession.desc': 'Sur les activités.',

    'settings.item.localDomains.name': 'Domaines',
    'settings.item.localDomains.desc':
        "Séparés par des virgules : seuls les tags type/<domaine>/… de ces domaines désignent des notes d'apprentissage (« music »).",
    'settings.item.localStatus.name': 'Propriété de maîtrise',
    'settings.item.localStatus.desc': 'La propriété qui contient le niveau (« 20 - Learning »).',
    'settings.item.localTopPriority.name': 'Priorité du focus actuel',
    'settings.item.localTopPriority.desc':
        'Les éléments de ce numéro de priorité sont le focus actuel.',
    'settings.item.localStarted.name': 'Propriété de la date de début',
    'settings.item.localStarted.desc': "Renseignée à l'arrivée en apprentissage (vide : aucune).",
    'settings.item.localMastered.name': 'Propriété de la date de maîtrise',
    'settings.item.localMastered.desc': "Renseignée à l'arrivée à la maîtrise (vide : aucune).",
    'settings.item.localFolder.name': 'Dossier des séances',
    'settings.item.localFolder.desc': 'Jetons : {tokens}.',
    'settings.item.localSuffix.name': 'Suffixe du nom des séances',
    'settings.item.localSuffix.desc': 'Ajouté aux noms des notes de séance ; mêmes jetons.',
    'settings.item.localTemplate.name': 'Modèle de séance',
    'settings.item.localTemplate.desc':
        'Note facultative utilisée comme modèle des nouvelles notes de séance (chemin dans le coffre).',

    'settings.item.reset.name': 'Rétablir les valeurs par défaut',
    'settings.item.reset.desc':
        'Rétablit les règles, la grille de niveaux, les noms des propriétés et le modèle de notes autonome. Demande confirmation.'
}
