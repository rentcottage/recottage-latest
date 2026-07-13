import { plural } from '../types';
import type { TranslationSchema } from './en';

/**
 * French (Français) translations.
 *
 * Lines ending in `// @todo-translate` still hold the ENGLISH text: translate
 * the value in place (keep `{var}` tokens and plural form keys intact) and
 * remove the marker. Never add or remove keys — the schema comes from en.ts.
 */
const fr: TranslationSchema = {
  common: {
    loading: 'Chargement…',
    retry: 'Réessayer',
    save: 'Enregistrer',
    saving: 'Enregistrement…',
    cancel: 'Annuler',
    close: 'Fermer',
    confirm: 'Confirmer',
    delete: 'Supprimer',
    edit: 'Modifier',
    remove: 'Retirer',
    back: 'Retour',
    next: 'Suivant',
    previous: 'Précédent',
    search: 'Rechercher',
    submit: 'Envoyer',
    send: 'Envoyer',
    continue: 'Continuer',
    yes: 'Oui',
    no: 'Non',
    ok: 'OK',
    required: 'Obligatoire',
    optional: 'Facultatif',
    seeAll: 'Tout voir',
    showMore: 'Afficher plus',
    showLess: 'Afficher moins',
    learnMore: 'En savoir plus',
    readMore: 'Lire la suite',
    viewDetails: 'Voir les détails',
    perNight: 'par nuit',
    error: 'Une erreur est survenue',
    comingSoon: 'Bientôt disponible',
    nights: plural({ one: '{count} nuit', other: '{count} nuits' }),
    guests: plural({ one: '{count} voyageur', other: '{count} voyageurs' }),
    reviews: plural({ one: '{count} avis', other: '{count} avis' }),
    refresh: 'Refresh', // @todo-translate
    actions: 'Actions', // @todo-translate
    networkError: 'Network error. Please try again.', // @todo-translate
    errorTryAgain: 'Something went wrong. Please try again.', // @todo-translate
    location: 'Location', // @todo-translate
    submitted: 'Submitted', // @todo-translate
    statusLabel: 'Status', // @todo-translate
    all: 'All', // @todo-translate
    approve: 'Approve', // @todo-translate
    reject: 'Reject', // @todo-translate
    requestFailed: 'Request failed ({status})', // @todo-translate
    status: {
      pending: 'Pending', // @todo-translate
      approved: 'Approved', // @todo-translate
      rejected: 'Rejected', // @todo-translate
      hidden: 'Hidden', // @todo-translate
      confirmed: 'Confirmed', // @todo-translate
      cancelled: 'Cancelled', // @todo-translate
      completed: 'Completed', // @todo-translate
      paid: 'Paid', // @todo-translate
      pending_host_approval: 'Pending host approval', // @todo-translate
      cancelled_by_host: 'Cancelled by host', // @todo-translate
    },
    active: 'Active', // @todo-translate
    title: 'Title', // @todo-translate
    description: 'Description', // @todo-translate
    price: 'Price', // @todo-translate
    deleting: 'Deleting…', // @todo-translate
    saveChanges: 'Save changes', // @todo-translate
    titleRequired: 'Title is required.', // @todo-translate
    failedToSave: 'Failed to save.', // @todo-translate
    failedToDelete: 'Failed to delete: {error}', // @todo-translate
    unknownError: 'Unknown error', // @todo-translate
    guest: 'Guest', // @todo-translate
    property: 'Property', // @todo-translate
    total: 'Total', // @todo-translate
    bookingId: 'Booking ID', // @todo-translate
    paymentMethod: 'Payment Method', // @todo-translate
    paymentStatus: 'Payment Status', // @todo-translate
    checkIn: 'Check-in', // @todo-translate
    checkOut: 'Check-out', // @todo-translate
    guestsLabel: 'Guests', // @todo-translate
    pending: 'Pending', // @todo-translate
    approved: 'Approved', // @todo-translate
    rejected: 'Rejected', // @todo-translate
    filters: 'Filters', // @todo-translate
    clear: 'Clear', // @todo-translate
    unknown: 'Unknown', // @todo-translate
    and: 'and', // @todo-translate
    max: 'Max {count}', // @todo-translate
    optionalParens: '(optional)', // @todo-translate
    firstName: 'First name', // @todo-translate
    lastName: 'Last name', // @todo-translate
    emailAddress: 'Email address', // @todo-translate
    phoneNumber: 'Phone number', // @todo-translate
    sending: 'Sending…', // @todo-translate
    faq: 'Frequently Asked Questions', // @todo-translate
    gotIt: 'Got It', // @todo-translate
    beds: plural({ one: '{count} bed', other: '{count} beds' }), // @todo-translate
    baths: plural({ one: '{count} bath', other: '{count} baths' }), // @todo-translate
    add: 'Add', // @todo-translate
    justNow: 'Just now', // @todo-translate
    minutesAgo: '{count}m ago', // @todo-translate
    hoursAgo: '{count}h ago', // @todo-translate
    daysAgo: '{count}d ago', // @todo-translate
    monthsAgo: '{count}mo ago', // @todo-translate
    yearsAgo: '{count}y ago', // @todo-translate
    today: 'Today', // @todo-translate
    yesterday: 'Yesterday', // @todo-translate
    uploading: 'Uploading…', // @todo-translate
    done: 'Done', // @todo-translate
    copy: 'Copy', // @todo-translate
    copied: 'Copied!', // @todo-translate
    cottage: 'Cottage', // @todo-translate
    submitting: 'Submitting...', // @todo-translate
    bedrooms: plural({ one: '{count} bedroom', other: '{count} bedrooms' }), // @todo-translate
    bathrooms: plural({ one: '{count} bathroom', other: '{count} bathrooms' }), // @todo-translate
    select: 'Select', // @todo-translate
    home: 'Home', // @todo-translate
    email: 'Email', // @todo-translate
    lastUpdated: 'Last updated: {date}', // @todo-translate
  },
  languageSelector: {
    label: 'Langue',
    select: 'Choisir la langue',
  },
  header: {
    nav: {
      search: 'Rechercher',
      howItWorks: 'Comment ça marche',
      aboutGeorgia: 'À propos de la Géorgie',
      becomeHost: 'Devenir hôte',
    },
    login: 'Se connecter',
    logout: 'Se déconnecter',
    signup: 'S\'inscrire',
    myProfile: 'Mon profil',
    hostDashboard: 'Tableau de bord hôte',
    helpCenter: 'Centre d\'aide',
    myAccount: 'Mon compte',
    loggedIn: 'Connecté',
    searchCottages: 'Rechercher des cottages',
    openMenu: 'Ouvrir le menu',
    closeMenu: 'Fermer le menu',
    help: {
      prompt: 'Comment pouvons-nous vous aider ?',
      searchPlaceholder: 'Rechercher de l\'aide...',
      popularTopics: 'Sujets populaires',
      stillNeedHelp: 'Besoin d\'aide supplémentaire ?',
      emailSupport: 'Support par e-mail',
      bookingTitle: 'Réserver un cottage',
      bookingDesc: 'Comment rechercher et réserver votre séjour idéal',
      cancellationTitle: 'Politique d\'annulation',
      cancellationDesc: 'Comprendre nos conditions d\'annulation',
      safetyTitle: 'Sécurité',
      safetyDesc: 'Votre sécurité est notre priorité absolue',
      paymentTitle: 'Paiement et tarifs',
      paymentDesc: 'Moyens de paiement et informations tarifaires',
      hostCommTitle: 'Communication avec l\'hôte',
      hostCommDesc: 'Comment contacter votre hôte',
      travelTitle: 'Conseils de voyage',
      travelDesc: 'Conseils pour voyager en Géorgie',
    },
  },
  footer: {
    tagline: 'La plateforme n°1 en Géorgie pour réserver des cottages — directement auprès des hôtes, sans frais cachés.',
    installment: 'Paiement échelonné',
    explore: 'Explorer',
    forHosts: 'Pour les hôtes',
    support: 'Assistance',
    hostResources: 'Ressources pour hôtes',
    siteMap: 'Plan du site',
    contactUs: 'Nous contacter',
    cancellationOptions: 'Options d\'annulation',
    rightsReserved: 'Tous droits réservés',
    privacy: 'Confidentialité',
    terms: 'Conditions générales',
  },
  notFound: {
    title: 'Nous n\'avons pas trouvé ce cottage',
    description: 'La page que vous recherchez n\'existe pas ou a été déplacée — mais plus de 500 cottages réels vous attendent !',
    backHome: 'Retour à l\'accueil',
    searchCottages: 'Rechercher des cottages',
    whereToStay: 'Où séjourner',
    experiences: 'Expériences',
  },
  errorBoundary: {
    title: 'Une erreur est survenue',
    description: 'La page a rencontré une erreur inattendue. Recharger la page résout généralement le problème.',
    reload: 'Recharger la page',
  },
  categories: {
    Mountain: 'Montagne',
    Lakeside: 'Bord du lac',
    Traditional: 'Traditionnel',
    Forest: 'Forêt',
    Countryside: 'Campagne',
    Winery: 'Vignoble',
  },
  propertyType: {
    Cottage: 'Cottage',
    Cabin: 'Chalet',
    Farmhouse: 'Ferme',
    Villa: 'Villa',
    House: 'House', // @todo-translate
    Winery: 'Winery', // @todo-translate
  },
  amenities: {
    WiFi: 'Wi-Fi',
    Kitchen: 'Cuisine',
    Fireplace: 'Cheminée',
    'Swimming Pool': 'Piscine',
    Parking: 'Parking',
    'Hot Tub': 'Jacuzzi',
    'Mountain View': 'Vue sur la montagne',
    'Lake Access': 'Accès au lac',
    'BBQ Grill': 'Barbecue',
    'Pet Friendly': 'Animaux admis',
    Heating: 'Chauffage',
    'Air Conditioning': 'Climatisation',
    'Free parking': 'Free parking', // @todo-translate
    'Air conditioning': 'Air conditioning', // @todo-translate
    'Washing machine': 'Washing machine', // @todo-translate
    TV: 'TV', // @todo-translate
    'BBQ grill': 'BBQ grill', // @todo-translate
    'Hot tub': 'Hot tub', // @todo-translate
    Balcony: 'Balcony', // @todo-translate
    'Mountain view': 'Mountain view', // @todo-translate
    'River view': 'River view', // @todo-translate
    'Lake view': 'Lake view', // @todo-translate
    'Pet friendly': 'Pet friendly', // @todo-translate
    'Smoking allowed': 'Smoking allowed', // @todo-translate
    'EV charger': 'EV charger', // @todo-translate
    Gym: 'Gym', // @todo-translate
    Sauna: 'Sauna', // @todo-translate
    'Security camera': 'Security camera', // @todo-translate
    'Smoke alarm': 'Smoke alarm', // @todo-translate
    'First aid kit': 'First aid kit', // @todo-translate
  },
  home: {
    seo: {
      title: 'RentCottage.Ge — Trouvez et réservez votre chalet géorgien',
    },
    seasons: {
      winter: 'Hiver',
      spring: 'Printemps',
      summer: 'Été',
      autumn: 'Automne',
      seasonAria: 'Saison {season}',
      winterTitle: 'L’hiver à la montagne vous attend',
      winterSub: 'Des chalets chaleureux à Goudaouri et Bakouriani — à deux pas des pistes, avec cheminée et jacuzzi',
      winterBadge1: '🎿 À deux pas des pistes',
      winterBadge2: '♨️ Jacuzzi sous la neige',
      winterBadge3: '🔥 Cheminée et chaleur',
      springTitle: 'Le printemps — prenez de l’avance sur la saison',
      springSub: 'Vallées en fleurs et chalets paisibles — réservez tôt au meilleur prix',
      springBadge1: '🌸 Nature en fleurs',
      springBadge2: '💰 Tarifs anticipés',
      springBadge3: '🏞 Saison paisible',
      summerTitle: 'Échappez à la chaleur de la ville',
      summerSub: 'L’air frais des montagnes en Ratcha, Svanétie et Bordjomi — un jardin, un grill et le murmure de la rivière',
      summerBadge1: '⛰ Air frais de montagne',
      summerBadge2: '🍖 Grill et jardin',
      summerBadge3: '🏞 Au bord de la rivière',
      autumnTitle: 'La saison des vendanges en Kakhétie',
      autumnSub: 'Des chalets viticoles au cœur des vignes — dégustations, automne doré et festin géorgien',
      autumnBadge1: '🍷 Chalets viticoles',
      autumnBadge2: '🍇 Vendanges et dégustations',
      autumnBadge3: '🍂 Automne doré',
    },
    destinations: {
      title: 'Destinations populaires',
      subtitle: 'Choisissez une région et découvrez ses plus beaux chalets',
      allRegions: 'Toutes les régions →',
      gudauriTag: 'Station de ski hivernale',
      bakurianiTag: 'Idéal en famille',
      kakhetiTag: 'Pays du vin',
      kazbegiTag: 'Vues sur la montagne',
      gudauri: 'Gudauri', // @todo-translate
      bakuriani: 'Bakuriani', // @todo-translate
      kakheti: 'Kakheti', // @todo-translate
      kazbegi: 'Kazbegi', // @todo-translate
    },
    promos: {
      title: 'Offres et promotions',
      subtitle: 'Réductions à durée limitée — appliquées automatiquement au paiement',
      off: 'de réduction',
      until: 'jusqu’au {date}',
    },
    featured: {
      title: 'Chalets à la une',
      subtitle: 'Les chalets les mieux notés cette semaine',
      loadingLive: 'Chargement des annonces en direct…',
      liveListings: plural({ one: '{count} annonce en direct d’hôtes réels', other: '{count} annonces en direct d’hôtes réels' }),
      viewAll: 'Voir tout →',
      loading: 'Chargement des annonces…',
      emptyTitle: 'Aucun chalet disponible pour le moment',
      emptySubtitle: 'Les annonces arrivent bientôt — revenez d’ici peu.',
      showMore: 'Afficher plus',
    },
    experiences: {
      title: 'Expériences géorgiennes uniques',
      subtitle: 'Plongez au cœur de la culture géorgienne authentique grâce à ces expériences inoubliables',
      empty: 'Pas encore d’expériences. Revenez bientôt.',
      comingSoon: 'Bientôt disponible',
      from: 'À partir de',
      perPerson: '/ personne',
      bookNow: 'Réserver',
      moreTitle: 'D’autres expériences arrivent bientôt !',
      moreDesc: 'Nous ajoutons constamment de nouvelles expériences géorgiennes authentiques pour vous aider à découvrir la richesse culturelle, les traditions et la beauté naturelle de notre magnifique pays.',
      tagDance: 'Cours de danse traditionnelle',
      tagPottery: 'Ateliers de poterie',
      tagRiding: 'Balades à cheval',
      tagTours: 'Circuits culturels',
    },
    trust: {
      title: 'Pourquoi RentCottage.Ge ?',
      verifiedTitle: 'Chalets vérifiés',
      verifiedDesc: 'Nous vérifions personnellement chaque annonce — les photos correspondent à la réalité',
      flexibleTitle: 'Annulation flexible',
      flexibleDesc: 'Annulation gratuite jusqu’à 48 heures avant l’arrivée',
      easyTitle: 'Réservation simple',
      easyDesc: 'Cherchez, réservez et détendez-vous — paiement sécurisé, hôtes réels',
    },
    howItWorks: {
      title: 'Comment ça marche',
      subtitle: 'Réservez en 3 étapes seulement',
      step1Title: 'Rechercher',
      step1Desc: 'Choisissez une région, des dates et le nombre de voyageurs — filtrez par jacuzzi, cheminée ou piscine',
      step2Title: 'Réserver',
      step2Desc: 'Envoyez une demande de réservation ou contactez l’hôte. Le paiement est sûr et sécurisé',
      step3Title: 'Se détendre',
      step3Desc: 'Recevez les détails de l’arrivée et profitez de votre séjour. Nous sommes là si vous avez besoin de nous',
    },
    reviews: {
      title: 'Ce que disent les voyageurs',
      review1: 'Le chalet était exactement comme sur les photos. L’hôte était très attentionné et la réservation n’a pris que quelques minutes.',
      review2: 'Nous avons séjourné à Bakouriani en famille. Aucune surprise sur le prix — vous payez exactement ce qui est affiché. Nous reviendrons.',
      review3: 'Nous avons loué un chalet viticole en Kakhétie entre amis. Dégustations, panoramas, tranquillité — un dix sur dix !',
      who1: 'Nino K. · Gudauri, January 2026', // @todo-translate
      who2: 'Giorgi M. · Bakuriani, February 2026', // @todo-translate
      who3: 'Tamar B. · Sighnaghi, October 2025', // @todo-translate
    },
    hostCta: {
      title: 'Vous avez un chalet ? Gagnez plus',
      subtitle: 'Publiez votre chalet gratuitement, recevez des réservations directement et ne payez une commission que sur les séjours réussis',
      button: 'Publiez votre chalet gratuitement',
    },
    helpModal: {
      needMoreHelpLabel: 'Besoin d’aide supplémentaire ?',
      needMoreHelpText: 'Notre équipe d’assistance est disponible pendant les heures ouvrables pour vous aider.',
      bookingTitle: 'Comment rechercher et réserver votre séjour idéal',
      bookingStep1: '1. Rechercher',
      bookingStep1Desc: 'Saisissez votre destination, vos dates d’arrivée et de départ, ainsi que le nombre de voyageurs dans la barre de recherche.',
      bookingStep2: '2. Parcourir',
      bookingStep2Desc: 'Parcourez les chalets disponibles et utilisez les filtres pour affiner vos options par prix, équipements et type de logement.',
      bookingStep3: '3. Sélectionner',
      bookingStep3Desc: 'Cliquez sur un chalet qui vous intéresse pour consulter les informations détaillées, les photos et les avis.',
      bookingStep4: '4. Réserver',
      bookingStep4Desc: 'Choisissez vos dates, sélectionnez le nombre de voyageurs et cliquez sur « Demander à réserver ». L’hôte répondra sous 24 heures.',
      bookingStep5: '5. Confirmer',
      bookingStep5Desc: 'Une fois approuvée par l’hôte, finalisez votre paiement pour confirmer votre réservation.',
      cancellationTitle: 'Comprendre nos conditions d’annulation',
      cancellationStep1: 'Politique flexible',
      cancellationStep1Desc: 'Les voyageurs peuvent annuler 2 jours ou plus avant l’arrivée et être intégralement remboursés pour les paiements en ligne.',
      cancellationStep2: 'Politique modérée',
      cancellationStep2Desc: 'Les voyageurs peuvent annuler jusqu’à 2 jours avant l’arrivée et être remboursés à 90 % pour les paiements en ligne.',
      cancellationStep3: 'Politique stricte',
      cancellationStep3Desc: 'Si la réservation est annulée dans les 24 heures précédant l’arrivée, le voyageur est remboursé à 80 % pour les paiements en ligne.',
      cancellationStep4: 'Situations d’urgence',
      cancellationStep4Desc: 'Des considérations particulières s’appliquent en cas d’urgences justifiées ou de circonstances exceptionnelles.',
      cancellationStep5: 'Annulation par l’hôte',
      cancellationStep5Desc: 'Si un hôte annule, vous êtes intégralement remboursé (applicable aux paiements en ligne).',
      safetyTitle: 'Votre sécurité est notre priorité absolue',
      safetyStep1: 'Hôtes vérifiés',
      safetyStep1Desc: 'Tous les hôtes font l’objet d’une vérification d’identité et d’une inspection du logement avant publication.',
      safetyStep2: 'Équipe d’assistance',
      safetyStep2Desc: 'Notre équipe d’assistance est disponible pendant les heures ouvrables pour toute question de sécurité ou urgence.',
      safetyStep3: 'Paiements sécurisés',
      safetyStep3Desc: 'Tous les paiements sont traités en toute sécurité via notre plateforme avec une protection contre la fraude.',
      safetyStep4: 'Protection des voyageurs',
      safetyStep4Desc: 'Une couverture d’assurance complète vous protège pendant votre séjour.',
      safetyStep5: 'Contacts d’urgence',
      safetyStep5Desc: 'Les contacts et procédures d’urgence locaux sont fournis avec chaque confirmation de réservation.',
    },
    cookingModal: {
      imageAlt: 'Cours de cuisine géorgienne',
      title: 'Cours de cuisine géorgienne traditionnelle',
      duration: '3 à 4 heures',
      groupSize: '2 à 8 personnes',
      location: 'Tbilissi',
      rating: '4,9 (127 avis)',
      whatYoullLearn: 'Ce que vous apprendrez',
      learn1: 'La préparation du Khachapuri traditionnel',
      learn2: 'Les Khinkali roulés à la main',
      learn3: 'Les mélanges d’épices géorgiens',
      learn4: 'Les secrets des recettes de famille',
      perPerson: 'par personne',
      bookThis: 'Réserver cette expérience',
      noCharge: 'Vous ne serez pas encore débité',
    },
    bookingForm: {
      cookingTitle: 'Réserver un cours de cuisine géorgienne',
      wineTitle: 'Réserver une dégustation de vin',
      fullName: 'Nom complet *',
      fullNamePlaceholder: 'Saisissez votre nom complet',
      email: 'Adresse e-mail *',
      emailPlaceholder: 'Saisissez votre e-mail',
      phone: 'Numéro de téléphone *',
      phonePlaceholder: 'Saisissez votre numéro de téléphone',
      numberOfPeople: 'Nombre de personnes *',
      selectNumberOfPeople: 'Sélectionnez le nombre de personnes',
      selectGroupSize: 'Sélectionnez la taille du groupe',
      peopleOption: '{count} personnes',
      preferredDate: 'Date souhaitée *',
      preferredTime: 'Heure souhaitée',
      selectTime: 'Sélectionnez une heure',
      howHeard: 'Comment avez-vous entendu parler de nous ?',
      selectOption: 'Sélectionnez une option',
      selectOptionShort: 'Sélectionnez',
      optGoogle: 'Recherche Google',
      optSocial: 'Réseaux sociaux',
      optFriendRecommendation: 'Recommandation d’un ami',
      optFriendReferral: 'Parrainage d’un ami',
      optTravelBlog: 'Blog de voyage',
      optHotelConcierge: 'Conciergerie d’hôtel',
      optHotelRecommendation: 'Recommandation d’un hôtel',
      optOther: 'Autre',
      agreeTerms: 'J’accepte la politique d’annulation et les conditions d’utilisation *',
      submit: 'Envoyer la demande de réservation',
      validationFillField: 'Veuillez renseigner {field}',
      validationFillAll: 'Veuillez renseigner tous les champs obligatoires',
      validationFutureDate: 'Veuillez sélectionner une date future',
      successCooking: 'Demande de réservation envoyée avec succès ! Nous vous contacterons bientôt pour confirmer votre réservation.',
      successWine: 'Demande de réservation envoyée avec succès ! Nous vous contacterons sous 24 heures pour confirmer votre dégustation de vin.',
      errorSubmit: 'Une erreur est survenue lors de l’envoi de votre réservation. Veuillez réessayer.',
      transportation: 'Transport depuis Tbilissi',
      transportationYes: 'Oui, j’ai besoin d’un transport (+₾25 par personne)',
      transportationNo: 'Non, j’ai mon propre moyen de transport',
      dietary: 'Restrictions alimentaires ou allergies',
      dietaryPlaceholder: 'Merci de nous indiquer toute restriction alimentaire, allergie ou exigence particulière…',
      maxCharacters: 'Maximum 500 caractères',
    },
    wineModal: {
      imageAlt: 'Dégustation de vin géorgien traditionnel',
      title: 'Dégustation de vin géorgien traditionnel',
      duration: '2 à 3 heures',
      groupSize: '2 à 12 personnes',
      location: 'Région de Kakhétie',
      overviewTitle: 'Aperçu de l’expérience',
      overviewText: 'Découvrez la tradition vinicole géorgienne vieille de 8‑000 ans dans le cadre authentique d’une cave. Dégustez des vins ambrés uniques élaborés dans des jarres en argile qvevri traditionnelles, apprenez les techniques ancestrales et savourez des accords de fromages et de pains locaux avec un maître sommelier.',
      whatYoullTaste: 'Ce que vous dégusterez',
      taste1: '5 vins géorgiens haut de gamme, dont de rares cépages ambrés',
      taste2: 'Des vins qvevri traditionnels vieillis sous terre',
      taste3: 'Les cépages locaux Saperavi, Rkatsiteli et Mtsvane',
      taste4: 'Fromage géorgien artisanal et pain frais',
      includesTitle: 'L’expérience comprend',
      includes1: 'Une dégustation professionnelle avec un sommelier expert',
      includes2: 'Une visite de la cave traditionnelle et des qvevri',
      includes3: 'Des accords de fromages, pains et amuse-bouches locaux',
      includes4: 'Le transport depuis Tbilissi (en option)',
      includes5: 'Des notes de dégustation et des supports pédagogiques',
      perPerson: 'par personne',
      rating: '4,9 (127 avis)',
      bookThis: 'Réserver cette expérience',
      freeCancellation: 'Annulation gratuite jusqu’à 24 heures',
      instantConfirmation: 'Confirmation instantanée',
      groupOptions: 'Options privées ou en groupe',
      cancellationPolicyTitle: 'Politique d’annulation',
      cancellationPolicyText: 'Annulation gratuite jusqu’à 24 heures avant le début de l’expérience. Remboursement de 50 % pour les annulations dans les 24 heures.',
      summaryLine1: '• Expérience de 2 à 3 heures dans la région de Kakhétie',
      summaryLine2: '• 5 vins haut de gamme + accords mets traditionnels',
      summaryLine3: '• Sommelier expert et visite de cave inclus',
      summaryLine4: '• Prix : ₾35 par personne',
    },
  },
  admin: {
    nav: {
      ariaLabel: 'Sections d\'administration',
      overview: 'Vue d\'ensemble',
      bookings: 'Réservations',
      dateChanges: 'Changements de dates',
      hostApplications: 'Candidatures d\'hôtes',
      travelAgencies: 'Agences de voyages',
      experiences: 'Expériences',
      promos: 'Offres et promos',
      experienceBookings: 'Réservations d\'expériences',
      completedStays: 'Séjours terminés',
      users: 'Utilisateurs',
      hostNews: 'Actualités hôtes',
      paymentLogs: 'Journaux de paiement',
    },
    gate: {
      title: 'Accès administrateur',
      passwordLabel: 'Mot de passe',
      passwordPlaceholder: 'Saisissez le mot de passe administrateur',
      lockedMessage: 'Trop de tentatives échouées. Accès verrouillé pendant 2 minutes.',
      incorrectPassword: plural({ one: 'Mot de passe incorrect. {count} tentative restante.', other: 'Mot de passe incorrect. {count} tentatives restantes.' }),
      verifyFailed: 'Vérification impossible pour le moment. Veuillez réessayer.',
      lockedCountdown: 'Trop de tentatives échouées. Réessayez dans {seconds} s.',
      verifying: 'Vérification…',
      unlock: 'Déverrouiller le panneau d\'administration',
      lockAdmin: 'Verrouiller l\'admin',
      sessionNote: 'L\'accès est limité à la session et expire à la fermeture de l\'onglet.',
    },
    page: {
      title: 'Administration des réservations',
      status: {
        cancelledByHost: 'Annulée par l\'hôte',
        cancelledByCustomer: 'Annulée par le client',
        cancelledByAdmin: 'Annulée par l\'admin',
        cancelled: 'Annulée',
        rejectedByHost: 'Refusée par l\'hôte',
        rejectedByAdmin: 'Refusée par l\'admin',
        rejected: 'Refusée',
        confirmed: 'Confirmée',
        awaitingHost: 'En attente de l\'hôte',
        pending: 'En attente',
      },
      rejectModal: {
        title: 'Refuser la réservation',
        description: 'Ajoutez éventuellement un motif de refus. Il sera enregistré et inclus dans les e-mails de notification envoyés au client et à l\'hôte.',
        quickReasonsLabel: 'Motifs rapides',
        customNoteLabel: 'Note de refus personnalisée',
        notePlaceholder: 'Saisissez un motif de refus personnalisé (facultatif)…',
        confirm: 'Confirmer le refus',
        reasonMissingDetails: 'Des informations obligatoires manquaient dans la demande de réservation.',
        reasonPersonalDetails: 'Les coordonnées personnelles étaient manquantes ou incomplètes.',
        reasonIncompleteInfo: 'Les informations de réservation étaient incomplètes.',
        reasonNotAccepted: 'La demande n\'a pas pu être acceptée pour le moment.',
        reasonDatesUnavailable: 'Les dates demandées ne sont plus disponibles.',
      },
      toast: {
        confirmed: 'Réservation confirmée — e-mail de confirmation envoyé au client.',
        rejected: 'Réservation refusée — e-mails de notification envoyés au client et à l\'hôte.',
      },
      tabs: {
        allBookings: 'Toutes les réservations',
      },
      stats: {
        total: 'Total',
        completed: 'Terminées',
        applications: 'Candidatures',
      },
      searchPlaceholder: 'Rechercher un voyageur, un logement…',
      loadingBookings: 'Chargement des réservations…',
      noBookingsFound: 'Aucune réservation trouvée',
      noPendingRequests: 'Aucune demande en attente pour le moment.',
      tryAdjustingFilters: 'Essayez de modifier vos filtres.',
      viewHistory: 'Voir l\'historique',
      reject: 'Refuser',
      noActionNeeded: 'Aucune action requise',
      table: {
        guest: 'Voyageur',
        property: 'Logement',
        dates: 'Dates',
        guests: 'Voyageurs',
        total: 'Total',
        submitted: 'Envoyée',
        status: 'Statut',
      },
    },
    users: {
      title: 'Gestion des utilisateurs',
      subtitle: 'Supprimez des utilisateurs et gérez les e-mails bloqués',
      tabs: {
        allUsers: 'Tous les utilisateurs',
        blockedEmails: 'E-mails bloqués',
      },
      searchPlaceholder: 'Rechercher par nom, e-mail ou téléphone…',
      ofUsersVerifiedPhone: 'sur {total} utilisateurs ont un téléphone vérifié',
      loadingUsers: 'Chargement des utilisateurs…',
      noUsersFound: 'Aucun utilisateur trouvé',
      unconfirmed: 'Non confirmé',
      verified: 'Vérifié',
      notVerified: 'Non vérifié',
      deleteAndBlock: 'Supprimer et bloquer',
      manualBlockTitle: 'Bloquer un e-mail manuellement',
      reasonOptionalPlaceholder: 'Motif (facultatif)',
      blockEmail: 'Bloquer l\'e-mail',
      loadingBlocked: 'Chargement des e-mails bloqués…',
      noBlockedEmails: 'Aucun e-mail bloqué',
      allEmailsAllowed: 'Toutes les adresses e-mail sont actuellement autorisées à s\'inscrire.',
      sourceUserDeleted: 'Utilisateur supprimé',
      unblock: 'Débloquer',
      table: {
        name: 'Nom',
        email: 'E-mail',
        phone: 'Téléphone',
        role: 'Rôle',
        provider: 'Fournisseur',
        registered: 'Inscrit le',
        lastSignIn: 'Dernière connexion',
        reason: 'Motif',
        source: 'Source',
        blockedAt: 'Bloqué le',
      },
      deleteModal: {
        title: 'Supprimer l\'utilisateur et bloquer l\'e-mail',
        cannotUndo: 'Cette action est irréversible',
        fallbackName: 'Utilisateur',
        description: 'Cette action supprimera définitivement l\'utilisateur de Supabase Auth et ajoutera son adresse e-mail à la liste des e-mails bloqués. Il ne pourra plus jamais s\'inscrire avec cette adresse.',
        reasonLabel: 'Motif de la suppression (facultatif)',
        reasonPlaceholder: 'Ex. : violation des conditions d\'utilisation, activité frauduleuse…',
        confirm: 'Supprimer et bloquer l\'e-mail',
      },
      toast: {
        loadUsersFailed: 'Échec du chargement des utilisateurs',
        networkLoadingUsers: 'Erreur réseau lors du chargement des utilisateurs',
        loadBlockedFailed: 'Échec du chargement des e-mails bloqués',
        networkLoadingBlocked: 'Erreur réseau lors du chargement des e-mails bloqués',
        userDeleted: 'Utilisateur supprimé et e-mail bloqué avec succès.',
        deleteFailed: 'Échec de la suppression de l\'utilisateur',
        unblocked: 'E-mail débloqué avec succès.',
        unblockFailed: 'Échec du déblocage',
        blocked: '{email} a été bloqué.',
        blockFailed: 'Échec du blocage de l\'e-mail',
      },
    },
    hostApps: {
      title: 'Candidatures d\'hôtes',
      subtitle: 'Candidatures d\'annonces de cottages et gestion des logements',
      searchPlaceholder: 'Rechercher un hôte, un logement…',
      loadingApplications: 'Chargement des candidatures…',
      pricePerNight: 'Prix/nuit',
      empty: {
        title: 'Aucune candidature trouvée',
        noPending: 'Aucune candidature en attente pour le moment.',
        tryFilters: 'Essayez de modifier vos filtres.',
      },
      table: {
        appId: 'ID candidature',
        applicant: 'Candidat',
        property: 'Logement',
        agreement: 'Contrat',
      },
      agreement: {
        received: 'Contrat reçu',
        receivedShort: 'Reçu',
        sentByHost: 'Contrat envoyé par l\'hôte',
        sentByHostShort: 'Envoyé par l\'hôte',
        notSent: 'Contrat non envoyé',
        notSentShort: 'Non envoyé',
        changeStatusTitle: 'Cliquez pour changer le statut du contrat',
        panelTitle: 'Statut du contrat',
        receivedOn: 'Contrat reçu le {date}',
        updateStatus: 'Mettre à jour le statut :',
      },
      reject: {
        title: 'Refuser la candidature',
        quickReasons: 'Motifs rapides',
        reasonAlreadySubmitted: 'Ce cottage a déjà été soumis',
        reasonDuplicate: 'Candidature en double — logement déjà en cours d\'examen',
        reasonAlreadyListed: 'Ce logement est déjà publié sur la plateforme',
        reasonIncomplete: 'Informations fournies incomplètes ou insuffisantes',
        reasonPhotoQuality: 'Les photos ne répondent pas à nos critères de qualité',
        noteLabel: 'Note de refus',
        noteOptional: '(facultatif — envoyée au candidat)',
        notePlaceholder: 'Ex. : ce cottage a déjà été soumis et est actuellement en cours d\'examen.',
        noteInfo: 'La note de refus sera incluse dans l\'e-mail envoyé au candidat et enregistrée dans le panneau d\'administration.',
        confirm: 'Confirmer le refus',
      },
      delete: {
        title: 'Supprimer définitivement ?',
        cannotUndo: 'Cette action est irréversible',
        warningBefore: 'Vous êtes sur le point de supprimer définitivement',
        warningAfter: 'Cela supprimera l\'annonce, tous les avis associés et les dates bloquées de la base de données.',
        confirm: 'Oui, supprimer définitivement',
      },
      detail: {
        idShort: 'ID : {id}',
        applicationId: 'ID de candidature :',
        rejectionNote: 'Note de refus',
        noRejectionNote: 'Aucune note de refus n\'a été fournie.',
        hiddenNoticeBefore: 'Ce logement est actuellement',
        hiddenNoticeStrong: 'masqué sur le site',
        hiddenNoticeAfter: 'Les voyageurs ne peuvent ni le voir ni le réserver.',
        photos: 'Photos ({count})',
        mainPhotoAlt: 'Photo principale du cottage',
        photoAlt: 'Photo {num}',
        noPhotos: 'Aucune photo envoyée',
        hostInfo: 'Informations sur l\'hôte',
        hostApplicant: 'Hôte candidat',
        propertyDetails: 'Détails du logement',
        type: 'Type',
        bedrooms: 'Chambres',
        bathrooms: 'Salles de bain',
        maxGuests: 'Voyageurs max.',
        description: 'Description',
        mapTitle: 'Carte du logement',
        viewOnMaps: 'Voir sur Google Maps',
        amenities: 'Équipements',
        submittedOn: 'Envoyée le {date}',
      },
      actions: {
        approveApplication: 'Approuver la candidature',
        resendApprovalEmail: 'Renvoyer l\'e-mail d\'approbation',
        resendApprovalEmailTitle: 'Renvoyer l\'e-mail de confirmation d\'approbation à l\'hôte',
        sendAgreementReminder: 'Envoyer un rappel de contrat',
        resendAgreementReminder: 'Renvoyer le rappel de contrat',
        sendReminderTitle: 'Envoyer un e-mail de rappel de contrat',
        lastSent: 'Dernier envoi : {date}',
        lastReminderSent: 'Dernier rappel envoyé : {date}',
        hideFromWebsite: 'Masquer sur le site',
        removePermanently: 'Supprimer définitivement',
        publishAgain: 'Publier à nouveau',
        review: 'Examiner',
        approvalEmail: 'E-mail d\'approbation',
        resendReminder: 'Renvoyer le rappel',
        sendReminder: 'Envoyer un rappel',
        hide: 'Masquer',
        hideTitle: 'Masquer sur le site (réversible)',
        publish: 'Publier',
      },
      toasts: {
        approved: 'Candidature approuvée — hôte notifié par e-mail.',
        hidden: 'Logement masqué sur le site.',
        published: 'Logement publié à nouveau — désormais visible pour les voyageurs.',
        rejected: 'Candidature refusée — hôte notifié par e-mail.',
        approvalEmailResent: 'E-mail d\'approbation renvoyé à l\'hôte avec succès.',
        reminderSent: 'Rappel de contrat envoyé avec succès',
        agreementNotSent: 'Statut du contrat défini sur : non envoyé',
        agreementSentByHost: 'Statut du contrat défini sur : envoyé par l\'hôte',
        agreementReceived: 'Contrat marqué comme reçu',
        agreementUpdated: 'Statut du contrat mis à jour',
        deleted: 'L\'annonce « {title} » a été définitivement supprimée.',
      },
      errors: {
        fetchFailed: 'Échec de la récupération ({status})',
        deleteFailed: 'Échec de la suppression ({status})',
        networkLoad: 'Erreur réseau. Impossible de charger les candidatures.',
      },
    },
    corporate: {
      title: 'Candidatures d\'entreprises',
      subtitle: 'Agences de voyages partenaires touchant 5 % de commission',
      commission: '{pct} % de commission',
      empty: 'Aucune candidature d\'entreprise.',
      emptyFiltered: 'Aucune candidature d\'entreprise {status}.',
      table: {
        agency: 'Agence',
        taxId: 'Identifiant fiscal',
        representative: 'Représentant',
        contact: 'Contact',
      },
      toasts: {
        approved: 'Agence approuvée.',
        rejected: 'Candidature refusée.',
      },
      reject: {
        title: 'Refuser la candidature',
        bodyBefore: 'Vous refusez',
        bodyAfter: 'La note ci-dessous sera envoyée par e-mail au candidat.',
        placeholder: 'Facultatif — expliquez le motif (ex. : documents manquants)…',
        confirm: 'Confirmer le refus',
      },
    },
    experiences: {
      subtitle: 'Gérez les cartes d\'expériences de la page d\'accueil',
      addExperience: 'Ajouter une expérience',
      addTitle: 'Ajouter une expérience',
      editTitle: 'Modifier l\'expérience',
      titlePlaceholder: 'Ex. : cours de cuisine traditionnelle',
      descriptionPlaceholder: 'Ce que les voyageurs vont vivre…',
      descriptionRequired: 'La description est obligatoire.',
      priceInvalid: 'Le prix doit être un nombre positif ou nul.',
      pricePerPerson: 'Prix par personne (₾)',
      status: {
        archived: 'Archivée',
        archivedHidden: 'Archivée (masquée)',
      },
      displayOrder: 'Ordre d\'affichage',
      displayOrderHint: '(plus petit = affiché en premier)',
      photos: 'Photos',
      photosHint: '(la première sert de couverture, max. {max})',
      cover: 'Couverture',
      moveLeft: 'Déplacer à gauche',
      moveRight: 'Déplacer à droite',
      chooseFiles: 'Choisir des fichiers',
      pasteUrlPlaceholder: '…ou collez l\'URL d\'une image',
      addUrl: 'Ajouter l\'URL',
      uploadUpTo: plural({ one: 'Vous pouvez ajouter encore {count} photo (JPG/PNG).', other: 'Vous pouvez ajouter encore {count} photos (JPG/PNG).' }),
      maxPhotosReached: 'Maximum de {max} photos atteint. Supprimez-en une pour en ajouter une autre.',
      loading: 'Chargement des expériences…',
      emptyPrefix: 'Aucune expérience pour le moment. Cliquez sur',
      emptySuffix: 'pour en créer une.',
      table: {
        order: 'Ordre',
        image: 'Image',
      },
      deleteConfirm: 'Supprimer « {title} » ? Cette action est irréversible.',
    },
    experienceBookings: {
      title: 'Demandes de réservation d\'expériences',
      subtitle: 'Demandes de dégustation de vin et de cours de cuisine',
      status: {
        pending: 'En attente',
        confirmed: 'Confirmée',
        completed: 'Terminée',
        cancelled: 'Annulée',
        unknown: 'Inconnu',
      },
      type: {
        wineTasting: 'Dégustation de vin',
        cookingClass: 'Cours de cuisine',
        fallback: 'Expérience',
      },
      allTypes: 'Tous les types',
      wineTastingPill: '🍷 Dégustation de vin',
      cookingClassPill: '🍳 Cours de cuisine',
      markCompleted: 'Marquer comme terminée',
      resetToPending: 'Remettre en attente',
      statusUpdated: 'Statut mis à jour : « {status} ».',
      statusUpdateFailed: 'Échec de la mise à jour du statut. Veuillez réessayer.',
      searchPlaceholder: 'Rechercher par nom ou téléphone…',
      loading: 'Chargement des demandes…',
      emptyTitle: 'Aucune demande d\'expérience trouvée',
      emptyNone: 'Aucune demande de réservation envoyée pour le moment.',
      emptyFiltered: 'Essayez de modifier vos filtres.',
      atTime: 'à {time}',
      submitted: 'Envoyée le {date}',
      hide: 'Masquer',
      details: 'Détails',
      contactDetails: 'Coordonnées',
      bookingDetails: 'Détails de la réservation',
      messageSpecialRequests: 'Message / demandes particulières',
      callCustomer: 'Appeler le client',
      sendEmail: 'Envoyer un e-mail',
    },
    news: {
      title: 'Actualités et annonces pour les hôtes',
      subtitle: 'Envoyez des e-mails groupés à tous les hôtes approuvés et publiés',
      sendAnnouncement: 'Envoyer une annonce',
      composeTitle: 'Envoyer une annonce aux hôtes',
      stepCompose: 'Rédigez votre message ci-dessous',
      stepConfirm: 'Vérifiez avant l\'envoi',
      sendingEmails: 'Envoi des e-mails…',
      sentShort: 'Annonce envoyée !',
      sentTitle: 'Annonce envoyée !',
      audienceNotePrefix: 'Cet e-mail sera envoyé à',
      audienceNoteStrong: 'tous les hôtes dont les cottages sont approuvés et publiés',
      audienceNoteSuffix: 'sur le site. Les hôtes dont les logements sont masqués, refusés ou en attente ne le recevront pas.',
      subject: 'Objet',
      subjectPlaceholder: 'Ex. : mise à jour importante pour tous les hôtes',
      message: 'Message',
      messagePlaceholder: 'Rédigez votre annonce ou actualité ici…',
      fillBoth: 'Veuillez renseigner l\'objet et le message.',
      sendFailed: 'Échec de l\'envoi. Veuillez réessayer.',
      networkError: 'Erreur réseau. Veuillez réessayer.',
      readyToSend: 'Prêt à envoyer ?',
      confirmNotePrefix: 'Un e-mail sera envoyé à',
      confirmNoteStrong: 'tous les hôtes approuvés',
      confirmNoteSuffix: '. Cette action est irréversible.',
      preview: 'Aperçu',
      pleaseWait: 'Veuillez patienter, cela peut prendre un moment.',
      deliveredTo: 'Envoyé avec succès à',
      hostsWord: plural({ one: 'hôte', other: 'hôtes' }),
      outOf: '(sur {total})',
      reviewAndSend: 'Vérifier et envoyer',
      confirmAndSend: 'Confirmer et envoyer',
      loadHistoryFailed: 'Échec du chargement de l\'historique.',
      networkErrorHistory: 'Erreur réseau. Impossible de charger l\'historique des envois.',
      sentAnnouncements: 'Annonces envoyées',
      historySubtitle: 'Historique de tous les e-mails envoyés aux hôtes',
      totalCount: '{count} au total',
      loadingHistory: 'Chargement de l\'historique…',
      emptyTitle: 'Aucune annonce envoyée pour le moment',
      emptyHint: 'Cliquez sur « Envoyer une annonce » pour envoyer votre premier e-mail aux hôtes.',
      sentAt: 'Envoyé le',
      recipients: 'Destinataires',
      sentBy: 'Envoyé par',
      recipientsCount: plural({ one: '{count} hôte', other: '{count} hôtes' }),
    },
    promos: {
      subtitle: 'Réductions par lieu — appliquées automatiquement au paiement',
      addPromo: 'Ajouter une promo',
      addTitle: 'Ajouter une promo',
      editTitle: 'Modifier la promo',
      titlePlaceholder: 'Ex. : l\'été à Batoumi — 10 % de réduction',
      descriptionHint: '(facultatif, affiché sur la bannière de la page d\'accueil)',
      descriptionPlaceholder: 'Réservez un cottage à Batoumi en juillet et faites des économies.',
      discountLabel: 'Réduction (%)',
      locationHint: '(ville ou région)',
      locationPlaceholder: 'Ex. : Batumi ou Adjara',
      startDate: 'Date de début',
      startDateHint: '(vide = maintenant)',
      endDate: 'Date de fin',
      endDateHint: '(incluse, vide = sans fin)',
      activeHint: '— décochez pour préparer une promo sans la publier',
      infoNote: 'Les voyageurs voient la promo sur la page d\'accueil et dans les résultats de recherche pour ce lieu, et la réduction est appliquée automatiquement au paiement sur les cottages concernés. La correspondance des lieux est bilingue (Batumi ↔ ბათუმი).',
      locationRequired: 'Le lieu est obligatoire — ex. : Batumi (la graphie géorgienne est aussi reconnue).',
      discountInvalid: 'La réduction doit être comprise entre 1 et 90 %.',
      endBeforeStart: 'La date de fin ne peut pas être antérieure à la date de début.',
      loadFailed: 'Échec du chargement des promos.',
      deleteConfirm: 'Supprimer la promo « {title} » ? Cette action est irréversible.',
      loading: 'Chargement des promos…',
      emptyPrefix: 'Aucune promo pour le moment. Cliquez sur',
      emptySuffix: 'pour créer votre première offre.',
      table: {
        discount: 'Réduction',
        dates: 'Dates',
      },
      status: {
        live: 'En ligne',
        scheduled: 'Programmée',
        expired: 'Expirée',
        inactive: 'Inactive',
      },
    },
    payments: {
      title: 'Journaux de vérification des paiements',
      subtitle: 'Piste d\'audit en temps réel — callbacks BOG et événements de statut des réservations',
      badgeBogCallback: 'Callback BOG',
      badgePaymentVerified: 'Paiement vérifié',
      badgePaymentFailed: 'Paiement échoué',
      badgePaymentEvent: 'Événement de paiement',
      badgeConfirmed: 'Confirmée',
      badgeCancelledRejected: 'Annulée/Refusée',
      badgeAdminAction: 'Action admin',
      secondsAgo: 'il y a {count} s',
      minutesAgo: 'il y a {count} min',
      hoursAgo: 'il y a {count} h',
      daysAgo: 'il y a {count} j',
      logDetail: 'Détail de l\'entrée de journal',
      timestamp: 'Horodatage',
      eventType: 'Type d\'événement',
      statusTransition: 'Transition de statut',
      triggeredBy: 'Déclenché par',
      notePayload: 'Note / payload',
      linkedBooking: 'Réservation liée',
      method: 'Méthode',
      logId: 'ID du journal',
      failuresDetected: plural({ one: '{count} échec de paiement BOG détecté', other: '{count} échecs de paiement BOG détectés' }),
      failuresSubtitle: 'Attention immédiate requise — examinez les callbacks échoués ci-dessous',
      dismissAlert: 'Ignorer l\'alerte',
      bookingShort: 'Réservation : {id}…',
      inspect: 'Inspecter',
      showMoreFailures: plural({ one: 'Afficher {count} échec supplémentaire', other: 'Afficher {count} échecs supplémentaires' }),
      live: 'En direct',
      liveOff: 'Direct désactivé',
      newEvents: '+{count} nouveaux',
      allEvents: 'Tous les événements',
      bogCallbacks: 'Callbacks BOG',
      payments: 'Paiements',
      statusChanges: 'Changements de statut',
      adminActions: 'Actions admin',
      totalEvents: 'Total des événements',
      paymentEvents: 'Événements de paiement',
      lastRefreshed: 'Dernière actualisation : {time}',
      polling: 'Interrogation toutes les 5 s',
      searchPlaceholder: 'Rechercher un événement, un ID de réservation, un voyageur…',
      loadingLogs: 'Chargement des journaux…',
      noLogs: 'Aucune entrée de journal trouvée',
      noLogsHint: 'Essayez de modifier vos filtres ou votre recherche.',
      time: 'Heure',
      booking: 'Réservation',
      statusChange: 'Changement de statut',
      note: 'Note',
      showingLogs: 'Affichage de {shown} entrées sur {total} (200 dernières)',
      clickToInspect: 'Cliquez sur une ligne pour inspecter le payload complet',
    },
    completed: {
      title: 'Réservations terminées',
      subtitle: 'Séjours confirmés dont la date de départ est passée',
      methodBog: 'BOG Pay',
      methodCash: 'Espèces',
      methodBank: 'Virement bancaire',
      allMethods: 'Toutes les méthodes',
      exportCsv: 'Exporter en CSV',
      downloadCsv: 'Télécharger le CSV',
      noDataToExport: 'Aucune donnée à exporter',
      exportTitle: plural({ one: 'Exporter {count} réservation en CSV', other: 'Exporter {count} réservations en CSV' }),
      totalCompleted: 'Total terminées',
      ofTotal: 'sur {count} au total',
      totalRevenue: 'Revenu total',
      filteredResults: 'résultats filtrés',
      avgBookingValue: 'Valeur moyenne par réservation',
      propertyLocation: 'Logement / lieu',
      searchPropertyPlaceholder: 'Rechercher un nom de logement…',
      checkOutFrom: 'Départ à partir du',
      checkOutTo: 'Départ jusqu\'au',
      loading: 'Chargement des réservations terminées…',
      empty: 'Aucune réservation terminée trouvée',
      tryAdjustingFilters: 'Essayez de modifier vos filtres.',
      emptyHint: 'Les séjours terminés apparaîtront ici une fois les dates de départ passées.',
      clearAllFilters: 'Effacer tous les filtres',
      completedOn: 'Terminée le',
      statusCompleted: 'Terminée',
      csvLocation: 'Lieu',
      csvTotalPriceGel: 'Prix total (GEL)',
      csvBookingStatus: 'Statut de la réservation',
      csvBookedOn: 'Réservée le',
      showingCompleted: plural({ one: 'Affichage de {count} réservation terminée', other: 'Affichage de {count} réservations terminées' }),
      filteredFrom: '(filtrées sur {total})',
      totalRevenueAmount: 'Revenu total : ₾{amount}',
    },
    history: {
      title: 'Historique des statuts',
      loading: 'Chargement de l\'historique…',
      empty: 'Aucun historique enregistré pour cette réservation pour le moment.',
      byActor: 'par {actor}',
      eventCreated: 'Réservation créée',
      eventConfirmed: 'Confirmée par l\'admin',
      eventHostApproved: 'Approuvée par l\'hôte',
      eventHostRejected: 'Refusée par l\'hôte',
      eventHostCancelled: 'Annulée par l\'hôte',
      eventCancelled: 'Annulée',
      eventDatesChanged: 'Dates modifiées',
      eventDatesApproved: 'Changement de dates approuvé',
      eventDatesRejected: 'Changement de dates refusé',
      eventDateChangeRequested: 'Changement de dates demandé',
      eventPaymentInitiated: 'Paiement initié',
      actorAdmin: 'Admin',
      actorCustomer: 'Client',
      actorSystem: 'Système',
    },
    dateChanges: {
      title: 'Demandes de changement de dates',
      subtitle: 'Demandes envoyées par les clients pour modifier les dates de réservation',
      pendingCount: '{count} en attente',
      loading: 'Chargement des demandes…',
      empty: 'Aucune demande de changement de dates',
      emptyPending: 'Aucune demande en attente pour le moment.',
      emptyFilter: 'Rien à afficher pour ce filtre.',
      currentDates: 'Dates actuelles',
      requestedDates: 'Dates demandées',
      requestedAt: 'Demandée le',
      processed: 'Traitée',
      approvedToast: 'Changement de dates approuvé — client notifié.',
      rejectedToast: 'Changement de dates refusé — client notifié.',
      genericError: 'Une erreur est survenue. Veuillez réessayer.',
      networkError: 'Erreur réseau. Veuillez réessayer.',
    },
  },
  booking: {
    corporate: {
      onBehalf: 'Booking on behalf of your client', // @todo-translate
      commissionNote: '5% commission will be credited to your agency dashboard.', // @todo-translate
      clientNameLabel: 'Client name (optional)', // @todo-translate
      clientNamePlaceholder: 'e.g. John Smith', // @todo-translate
    },
    status: {
      requestSent: 'Booking request sent!', // @todo-translate
      payAtPropertyNote: 'You\'ll pay at the property. The host will review your request shortly.', // @todo-translate
      hostWillRespond: 'The host will respond shortly.', // @todo-translate
      loginRequired: 'Please log in to request a booking.', // @todo-translate
      phoneRequired: 'Phone number required', // @todo-translate
      bookingFailed: 'Booking failed', // @todo-translate
      unexpectedError: 'An unexpected error occurred. Please try again.', // @todo-translate
      goToProfile: 'Go to My Profile', // @todo-translate
    },
    form: {
      checkIn: 'Check-in', // @todo-translate
      checkOut: 'Check-out', // @todo-translate
      guests: 'Guests', // @todo-translate
    },
    blocked: {
      datesBooked: 'These dates are already booked', // @todo-translate
      unavailableDueTo: 'Unavailable due to bookings on {sources}.', // @todo-translate
      externalPlatform: 'an external platform', // @todo-translate
      hostBlock: 'host block', // @todo-translate
      hostBlockedPeriod: 'The host has blocked part of your selected period.', // @todo-translate
      chooseDifferentDates: 'Please choose different dates.', // @todo-translate
      externalBadge: 'External', // @todo-translate
      hostBlockedBadge: 'Host blocked', // @todo-translate
    },
    unavailablePeriods: 'Unavailable periods:', // @todo-translate
    moreUnavailablePeriods: plural({ one: '+{count} more unavailable period', other: '+{count} more unavailable periods' }), // @todo-translate
    payment: {
      method: 'Payment Method', // @todo-translate
      payNow: 'Pay Now', // @todo-translate
      onlinePayment: 'Online payment', // @todo-translate
      payAtProperty: 'Pay at Property', // @todo-translate
      payOnArrival: 'Pay on arrival', // @todo-translate
    },
    price: {
      perNightTimes: plural({ one: '₾{price} × {count} night', other: '₾{price} × {count} nights' }), // @todo-translate
      promo: 'Promo', // @todo-translate
      serviceFee: 'Service fee', // @todo-translate
      total: 'Total', // @todo-translate
      totalLower: 'total', // @todo-translate
    },
    bookButton: 'Book', // @todo-translate
    submittingBooking: 'Submitting booking...', // @todo-translate
    redirectingToBank: 'Redirecting to Bank of Georgia...', // @todo-translate
    payNothingNow: 'You pay nothing now — booking is free', // @todo-translate
    payCashOnArrival: 'You will pay cash or card when you arrive', // @todo-translate
    securePaymentBog: 'Secure payment via Bank of Georgia', // @todo-translate
    perNight: '/ night', // @todo-translate
    priceVariesByGuests: 'Price varies by guest count', // @todo-translate
  },
  experience: {
    seo: {
      title: 'Book Georgian Experiences | RentCottage.Ge', // @todo-translate
      titleActive: 'Book {title} | RentCottage.Ge', // @todo-translate
      description: 'Book authentic Georgian experiences. Immerse yourself in 8,000 years of culture.', // @todo-translate
    },
    hero: {
      kicker: 'Authentic Georgian Experiences', // @todo-translate
      title: 'Book Your Experience', // @todo-translate
      subtitle: 'A cottage + an experience = the perfect getaway', // @todo-translate
    },
    loading: 'Loading experiences…', // @todo-translate
    empty: 'No experiences are available right now. Please check back soon.', // @todo-translate
    gallery: {
      prevPhoto: 'Previous photo', // @todo-translate
      nextPhoto: 'Next photo', // @todo-translate
      photoN: 'Photo {number}', // @todo-translate
    },
    pickToStart: 'Pick an experience to start booking.', // @todo-translate
    auth: {
      title: 'Sign in to book this experience', // @todo-translate
      subtitle: 'We need a verified account so we can confirm your booking and stay in touch.', // @todo-translate
      createAccount: 'Create account', // @todo-translate
    },
    success: {
      title: 'Request Sent!', // @todo-translate
      receivedFor: 'We received your booking request for the', // @todo-translate
      contactSoon: 'Our team will contact you within 24 hours to confirm.', // @todo-translate
      bookAnother: 'Book Another Experience', // @todo-translate
    },
    labels: {
      wineTasting: 'Wine Tasting', // @todo-translate
      cookingClass: 'Cooking Class', // @todo-translate
      generic: 'experience', // @todo-translate
    },
    form: {
      titleWithLabel: 'Book {label}', // @todo-translate
      titleWine: 'Book Wine Tasting', // @todo-translate
      titleCooking: 'Book Cooking Class', // @todo-translate
      titleGeneric: 'Book Experience', // @todo-translate
      subtitle: 'Fill in your details and we\'ll confirm within 24 hours.', // @todo-translate
      errNameRequired: 'Please enter your full name.', // @todo-translate
      errPhoneRequired: 'Please enter a phone number.', // @todo-translate
      errDateRequired: 'Please select a preferred date.', // @todo-translate
      errGuestsMin: 'Guests must be at least 1.', // @todo-translate
      errLoginRequired: 'Please log in to book this experience.', // @todo-translate
      errSubmit: 'Something went wrong. Please try again.', // @todo-translate
      fullName: 'Full Name', // @todo-translate
      fullNamePlaceholder: 'e.g. Ana Beridze', // @todo-translate
      email: 'Email Address', // @todo-translate
      phone: 'Phone Number', // @todo-translate
      phonePlaceholder: '+995 5XX XXX XXX', // @todo-translate
      preferredDate: 'Preferred Date', // @todo-translate
      time: 'Time', // @todo-translate
      anyTime: 'Any time', // @todo-translate
      numberOfGuests: 'Number of Guests', // @todo-translate
      specialRequests: 'Special Requests', // @todo-translate
      specialRequestsPlaceholder: 'Dietary restrictions, special occasions…', // @todo-translate
      sending: 'Sending Request…', // @todo-translate
      submit: 'Send Booking Request', // @todo-translate
      footNote: 'Free cancellation · Confirmed within 24 hours', // @todo-translate
    },
  },
  auth: {
    checkYourEmail: 'Check your email', // @todo-translate
    backToLogin: 'Back to log in', // @todo-translate
    emailPlaceholder: 'Enter your email', // @todo-translate
    passwordLabel: 'Password', // @todo-translate
    passwordPlaceholder: 'Enter your password', // @todo-translate
    orContinueWithEmail: 'or continue with email', // @todo-translate
    orSignupWithEmail: 'or sign up with email', // @todo-translate
    continueWithGoogle: 'Continue with Google', // @todo-translate
    continueWithFacebook: 'Continue with Facebook', // @todo-translate
    loggingIn: 'Logging in…', // @todo-translate
    noAccount: 'Don\'t have an account?', // @todo-translate
    haveAccount: 'Already have an account?', // @todo-translate
    forgotPassword: 'Forgot password?', // @todo-translate
    rememberPassword: 'Remember your password?', // @todo-translate
    errors: {
      captchaRequired: 'Please complete the CAPTCHA verification.', // @todo-translate
      emailRequired: 'Please enter your email address.', // @todo-translate
      nameRequired: 'Please enter your first and last name.', // @todo-translate
      passwordTooShort: 'Password must be at least 8 characters.', // @todo-translate
      passwordsMismatch: 'Passwords do not match.', // @todo-translate
      acceptTermsRequired: 'Please accept the Terms of Service to continue.', // @todo-translate
      otpSendFailed: 'Could not send the verification code. Please try again.', // @todo-translate
      otpResendFailed: 'Could not resend the code.', // @todo-translate
      emailExists: 'An account with this email already exists. Try logging in instead.', // @todo-translate
      generic: 'Something went wrong. Please try again.', // @todo-translate
    },
    forgot: {
      title: 'Reset password', // @todo-translate
      description: 'Enter the email address linked to your account. We\'ll send you a link to reset your password.', // @todo-translate
      sentLinkTo: 'We sent a password reset link to', // @todo-translate
      sentInstructions: 'Click the link in the email to set a new password. Check your spam folder if you don\'t see it.', // @todo-translate
      submit: 'Send reset link', // @todo-translate
    },
    signup: {
      createAccount: 'Create account', // @todo-translate
      sentConfirmationTo: 'We sent a confirmation link to', // @todo-translate
      confirmationInstructions: 'Click the link in the email to activate your account. Check your spam folder if you don\'t see it within a minute.', // @todo-translate
      phoneHint: 'We\'ll text a verification code to this number.', // @todo-translate
      passwordPlaceholder: 'Create a password', // @todo-translate
      passwordHint: 'Minimum 8 characters', // @todo-translate
      confirmPasswordLabel: 'Confirm password', // @todo-translate
      confirmPasswordPlaceholder: 'Confirm your password', // @todo-translate
      agreePrefix: 'I agree to the', // @todo-translate
      termsOfService: 'Terms of Service', // @todo-translate
      and: 'and', // @todo-translate
      privacyPolicy: 'Privacy Policy', // @todo-translate
      sendingCode: 'Sending code…', // @todo-translate
      codeSentTo: 'We sent a 6-digit code to', // @todo-translate
      phoneVerifiedCaptcha: 'Phone verified. Complete the captcha to finish.', // @todo-translate
      creatingAccount: 'Creating account…', // @todo-translate
    },
  },
  phoneVerify: {
    title: 'Verify your phone', // @todo-translate
    invalidPhone: 'Please enter a valid Georgian phone number (e.g. +995 555 12 34 56).', // @todo-translate
    phonePlaceholder: '+995 555 12 34 56', // @todo-translate
    phoneHint: 'We\'ll text you a 6-digit code.', // @todo-translate
    sendCode: 'Send code', // @todo-translate
    sendFailed: 'Could not send the code. Please try again.', // @todo-translate
    codeLabel: 'Verification code', // @todo-translate
    codeSentTo: 'Enter the 6-digit code sent to', // @todo-translate
    enterCode: 'Enter the 6-digit code.', // @todo-translate
    invalidCode: 'Invalid code.', // @todo-translate
    attemptsLeft: plural({ one: '{count} attempt left.', other: '{count} attempts left.' }), // @todo-translate
    resend: 'Resend code', // @todo-translate
    resendIn: 'Resend code in {seconds}s', // @todo-translate
    verifying: 'Verifying…', // @todo-translate
    verifyContinue: 'Verify & continue', // @todo-translate
  },
  profileGate: {
    title: 'Complete your profile', // @todo-translate
    completeTitle: 'Profile complete!', // @todo-translate
    completeDesc: 'Your information has been saved. You can now make bookings.', // @todo-translate
    missingBoth: 'Your Google account didn\'t provide your first and last name. Please fill in the missing fields to continue.', // @todo-translate
    missingFirst: 'Your Google account didn\'t provide your first name. Please fill in the missing field to continue.', // @todo-translate
    missingLast: 'Your Google account didn\'t provide your last name. Please fill in the missing field to continue.', // @todo-translate
    firstNameRequired: 'First name is required.', // @todo-translate
    lastNameRequired: 'Last name is required.', // @todo-translate
    firstNamePlaceholder: 'Enter your first name', // @todo-translate
    lastNamePlaceholder: 'Enter your last name', // @todo-translate
    sessionExpired: 'Session expired. Please log in again.', // @todo-translate
    saveFailed: 'Could not save name. Please try again.', // @todo-translate
    phoneReason: 'Add and verify a phone number so hosts can reach you about your stay — and so you can book cottages. We\'ll text you a 6-digit code.', // @todo-translate
  },
  calendar: {
    stepDateTitle: 'Select a Date', // @todo-translate
    stepTimeTitle: 'Select a Time Slot', // @todo-translate
    stepFormTitle: 'Review & Confirm', // @todo-translate
    selectDatePrompt: 'Choose an available date from the calendar below', // @todo-translate
    selectTimePrompt: 'Pick a time that works best for you', // @todo-translate
    noSlotsAvailable: 'No time slots available for this date', // @todo-translate
    nameLabel: 'Full Name', // @todo-translate
    phoneLabel: 'Phone Number', // @todo-translate
    phonePlaceholder: '+995 5XX XXX XXX', // @todo-translate
    dateLabel: 'Date', // @todo-translate
    timeLabel: 'Time', // @todo-translate
    modifyTime: 'Modify time', // @todo-translate
    confirmBooking: 'Confirm Booking', // @todo-translate
    submitting: 'Booking...', // @todo-translate
    bookingSuccess: 'Booking confirmed! We\'ll contact you shortly.', // @todo-translate
    bookingError: 'Booking failed. Please try again.', // @todo-translate
    available: 'Available', // @todo-translate
    selected: 'Selected', // @todo-translate
    loadingAvailability: 'Loading availability...', // @todo-translate
    until: 'until {time}', // @todo-translate
  },
  contact: {
    sendMessage: 'Send Message', // @todo-translate
    contactInfo: 'Contact Info', // @todo-translate
    quickHelp: 'Quick Help', // @todo-translate
    successTitle: 'Message Sent Successfully!', // @todo-translate
    successText: 'We\'ll get back to you within 24 hours.', // @todo-translate
    errorTitle: 'Send Failed', // @todo-translate
    errorText: 'Please check all fields and ensure your message is under 500 characters.', // @todo-translate
    subject: 'Subject *', // @todo-translate
    subjectPlaceholder: 'What is this regarding?', // @todo-translate
    message: 'Message *', // @todo-translate
    messagePlaceholder: 'Tell us how we can help you...', // @todo-translate
    characterCount: '{length}/500 characters', // @todo-translate
    sending: 'Sending...', // @todo-translate
    getInTouch: 'Get in Touch', // @todo-translate
    emailResponseTime: 'Response within 2 hours', // @todo-translate
    liveChat: 'Live Chat', // @todo-translate
    liveChatText: 'For a quick response, reach us on Instagram or Facebook.', // @todo-translate
    officeHours: 'Office Hours', // @todo-translate
    mondayFriday: 'Monday - Friday', // @todo-translate
    saturday: 'Saturday', // @todo-translate
    sunday: 'Sunday', // @todo-translate
    hoursWeekdays: '9:00 AM - 8:00 PM', // @todo-translate
    hoursSaturday: '10:00 AM - 6:00 PM', // @todo-translate
    hoursSunday: '12:00 PM - 5:00 PM', // @todo-translate
    emergencyNote: '* Emergency support available for current bookings during extended hours', // @todo-translate
    followUs: 'Follow Us', // @todo-translate
    followUsText: 'Stay connected with us on social media for the latest updates, new listings, and travel inspiration from Georgia.', // @todo-translate
    facebookNote: 'Message us for quick support', // @todo-translate
    instagramNote: 'DM us for quick support', // @todo-translate
    faqBookQ: 'How do I make a booking?', // @todo-translate
    faqBookA: 'Search for your desired location and dates, browse available cottages, and click "Request to Book" on your chosen property. The host will respond within 24 hours.', // @todo-translate
    faqPaymentQ: 'What payment methods do you accept?', // @todo-translate
    faqPaymentA: 'We accept all major credit cards (Visa, MasterCard, American Express), PayPal, and bank transfers. All payments are processed securely through our platform.', // @todo-translate
    faqCancelQ: 'Can I cancel my booking?', // @todo-translate
    faqCancelA: 'Yes, cancellation policies vary by property. Check the specific cancellation policy on each listing before booking. Most hosts offer flexible cancellation options.', // @todo-translate
    faqContactHostQ: 'How do I contact my host?', // @todo-translate
    faqContactHostA: 'Once your booking is confirmed, you can message your host directly through our platform. Contact information will be provided in your booking confirmation.', // @todo-translate
    faqIssuesQ: 'What if I have issues during my stay?', // @todo-translate
    faqIssuesA: 'Contact your host first for immediate assistance. For urgent issues, our support team is available all week to help resolve any problems during your stay.', // @todo-translate
    faqBecomeHostQ: 'How do I become a host?', // @todo-translate
    faqBecomeHostA: 'Click on "Become a Host" in our menu, fill out the application form with your property details, and our team will review your application within 24 hours.', // @todo-translate
    responseTimeLabel: 'Response Time:', // @todo-translate
    responseTimeText: 'Our support team typically responds within 2-4 hours during business hours.', // @todo-translate
    copyrightNote: 'We\'re here to help with your Georgian cottage rental experience.', // @todo-translate
  },
  cancellation: {
    title: 'Cancellation Information', // @todo-translate
    intro: 'Our cancellation policies are designed to provide flexibility while protecting both guests and hosts. Each property may have different cancellation terms based on the host\'s preferences.', // @todo-translate
    importantTitle: 'Important to Know', // @todo-translate
    important1: 'Cancellation policies are clearly displayed on each property listing', // @todo-translate
    important2: 'More flexible policies may attract more bookings', // @todo-translate
    important3: 'Stricter policies provide more protection against last-minute cancellations', // @todo-translate
    important4: 'Hosts can adjust their policy based on seasonal demand', // @todo-translate
    policiesTitle: 'Available Cancellation Policies', // @todo-translate
    flexible: 'Flexible', // @todo-translate
    moderate: 'Moderate', // @todo-translate
    strict: 'Strict', // @todo-translate
    flexibleRefund: 'For online payments, if the booking is canceled 2 or more days before the check-in date, the guest will receive a full refund.', // @todo-translate
    moderateRefund: 'For online payments, if the booking is canceled within 2 days before check-in, the guest will receive a 90% refund.', // @todo-translate
    strictRefund: 'For online payments, if the booking is canceled within 24 hours before check-in, the guest will receive an 80% refund.', // @todo-translate
    mostPopular: 'Most Popular', // @todo-translate
    refundPolicyLabel: 'Refund Policy:', // @todo-translate
    additionalTitle: 'Additional Cancellation Details', // @todo-translate
    hostCancellationsTitle: 'Host Cancellations', // @todo-translate
    hostCancel1: 'If a host cancels, you receive a full refund', // @todo-translate
    hostCancel2: 'Repeated cancellations can affect your listing status', // @todo-translate
    hostCancel3: 'Emergency cancellations are handled case-by-case', // @todo-translate
    forceMajeureTitle: 'Force Majeure Events', // @todo-translate
    forceMajeure1: 'Natural disasters and government restrictions', // @todo-translate
    forceMajeure2: 'Special cancellation policies may apply', // @todo-translate
    forceMajeure3: 'Both hosts and guests are protected', // @todo-translate
    howToTitle: 'How to Cancel Your Booking', // @todo-translate
    step1Title: 'Go to Your Trips', // @todo-translate
    step1Desc: 'Log in to your account and navigate to "Your Trips" section', // @todo-translate
    step2Title: 'Select Your Booking', // @todo-translate
    step2Desc: 'Find the booking you want to cancel and click on it', // @todo-translate
    step3Title: 'Click Cancel', // @todo-translate
    step3Desc: 'Review the cancellation policy and confirm your cancellation', // @todo-translate
    step4Title: 'Receive Confirmation', // @todo-translate
    step4Desc: 'You\'ll receive an email confirmation and refund details', // @todo-translate
    faqRefundQ: 'When will I receive my refund?', // @todo-translate
    faqRefundA: 'Refunds are processed automatically based on the property\'s cancellation policy. You\'ll receive refunds to your original payment method within 5-10 business days.', // @todo-translate
    faqModifyQ: 'Can I modify my booking instead of cancelling?', // @todo-translate
    faqModifyA: 'Yes, you can request to modify your booking dates or guest count. Contact the host directly or reach out to our support team for assistance with modifications.', // @todo-translate
    faqEmergencyQ: 'What if there\'s an emergency?', // @todo-translate
    faqEmergencyA: 'We understand that emergencies happen. Contact our support team immediately with documentation, and we\'ll review your situation for possible exceptions to the standard policy.', // @todo-translate
    faqHostCancelQ: 'What happens if the host cancels?', // @todo-translate
    faqHostCancelA: 'If a host cancels your booking, you\'ll receive a full refund automatically. We\'ll also help you find alternative accommodations and may provide additional compensation.', // @todo-translate
  },
  propertyCard: {
    verified: 'Verified', // @todo-translate
    hostedBy: 'Hosted by {host}', // @todo-translate
    perNight: '/ night', // @todo-translate
  },
  imageSlider: {
    photoAlt: '{title} - photo {num}', // @todo-translate
  },
  misc: {
    auth: {
      emailBlocked: 'This email address is not allowed to register. Registration with this email is blocked.', // @todo-translate
      genericError: 'Something went wrong. Please try again.', // @todo-translate
      invalidCredentials: 'Incorrect email or password. Please try again.', // @todo-translate
    },
    failedToLoadListings: 'Failed to load listings', // @todo-translate
    autocomplete: {
      use: 'Use', // @todo-translate
      enterCustomLocation: 'Enter as custom location', // @todo-translate
    },
  },
  host: {
    dashboard: {
      nav: {
        overview: 'Vue d\'ensemble',
        bookingCalendar: 'Calendrier des réservations',
        bookings: 'Réservations',
        cancelled: 'Annulées',
        myProperties: 'Mes logements',
        dateRequests: 'Demandes de dates',
        earnings: 'Revenus',
        reviews: 'Avis',
        blockedDates: 'Dates bloquées',
        addCalendar: 'Ajouter un calendrier',
        activity: 'Activité',
      },
      hostFallbackName: 'Hôte',
      refreshData: 'Actualiser les données',
      backToWebsite: 'Retour au site',
      signOut: 'Se déconnecter',
      propertiesCount: plural({ one: '{count} logement', other: '{count} logements' }),
      totalBookings: plural({ one: '{count} réservation au total', other: '{count} réservations au total' }),
      liveData: 'Données en direct',
      addProperty: 'Ajouter un logement',
    },
    gate: {
      signInPrompt: 'Connectez-vous pour accéder à votre tableau de bord hôte, gérer vos réservations et suivre vos revenus.',
      signInToContinue: 'Se connecter pour continuer',
      noAccount: 'Vous n\'avez pas de compte ?',
      createOne: 'Créez-en un'
    },
    overview: {
      title: 'Vue d\'ensemble du tableau de bord',
      subtitle: 'Toute l\'activité de vos logements',
      approvedCount: '{count} approuvées',
      activeBookings: 'Réservations actives',
      pendingRequests: plural({ one: '{count} demande en attente', other: '{count} demandes en attente' }),
      totalCancellations: 'Total des annulations',
      completed: 'Terminées',
      finishedStays: 'Séjours terminés',
      pendingDateChanges: 'Changements de dates en attente',
      recentBookingActivity: 'Activité récente des réservations',
      noBookingsYet: 'Aucune réservation pour le moment',
      noBookingsHint: 'Les réservations de vos logements apparaîtront ici',
    },
    activity: {
      title: 'Notifications et activité',
      subtitle: 'Activité récente des réservations et demandes pour vos logements',
      newBookingFrom: 'Nouvelle demande de réservation de {name}',
      confirmedFor: 'Réservation confirmée pour {name}',
      cancelledBy: 'Réservation annulée par {name}',
      completedCheckout: 'Séjour terminé — départ de {name}',
      dateChangeFrom: 'Demande de changement de dates de {name}',
      awaitingResponse: 'En attente de votre réponse',
      pendingBookingRequests: plural({ one: '{count} demande de réservation en attente', other: '{count} demandes de réservation en attente' }),
      adminWillReview: 'L\'administrateur examinera et confirmera ou rejettera en votre nom',
      dateChangeRequestsPending: plural({ one: '{count} demande de changement de dates en attente', other: '{count} demandes de changement de dates en attente' }),
      guestsRequestingDates: 'Des voyageurs demandent des modifications de dates pour leurs réservations',
      feedTitle: 'Fil d\'activité',
      eventsCount: plural({ one: '{count} événement', other: '{count} événements' }),
      loadingActivity: 'Chargement de l\'activité…',
      noActivityYet: 'Aucune activité pour le moment',
      noActivityHint: 'L\'activité liée aux réservations apparaîtra ici',
    },
    earnings: {
      subtitle: 'Revenus des réservations confirmées et terminées',
      totalEarnings: 'Revenus totaux',
      confirmedPlusCompleted: 'Confirmées + terminées',
      confirmedBookings: 'Réservations confirmées',
      activeConfirmedStays: 'Séjours confirmés en cours',
      completedStays: 'Séjours terminés',
      fullyCompletedStays: 'Séjours entièrement terminés',
      monthlyBreakdown: 'Répartition mensuelle',
      paymentHistory: 'Historique des paiements',
      paymentHistorySubtitle: 'Toutes les réservations ayant généré des revenus',
      noEarningsYet: 'Aucun revenu pour le moment',
      noEarningsHint: 'Les revenus apparaissent ici une fois les réservations confirmées',
      table: {
        property: 'Logement',
        stayDates: 'Dates du séjour',
        status: 'Statut',
        payment: 'Paiement',
        amount: 'Montant',
        date: 'Date',
      },
    },
    reviews: {
      title: 'Reviews & Ratings', // @todo-translate
      subtitle: 'Guest feedback for your properties', // @todo-translate
      overallRating: 'Overall Rating', // @todo-translate
      fromReviews: plural({ one: 'from {count} review', other: 'from {count} reviews' }), // @todo-translate
      totalReviews: 'Total Reviews', // @todo-translate
      acrossAllProperties: 'across all properties', // @todo-translate
      fiveStarReviews: '5-Star Reviews', // @todo-translate
      percentOfAll: '{percent}% of all reviews', // @todo-translate
      noReviewsYetShort: 'no reviews yet', // @todo-translate
      ratingPerProperty: 'Rating per Property', // @todo-translate
      loadingReviews: 'Loading reviews…', // @todo-translate
      noReviewsYet: 'No reviews yet', // @todo-translate
      noReviewsHint: 'Reviews from guests will appear here after their stay', // @todo-translate
      unknownProperty: 'Unknown property', // @todo-translate
    },
    properties: {
      subtitle: 'All your submitted property listings and their status', // @todo-translate
      noPropertiesYet: 'No properties yet', // @todo-translate
      noPropertiesHint: 'Submit your first property to get started', // @todo-translate
      listYourCottage: 'List Your Cottage', // @todo-translate
      cover: 'Cover', // @todo-translate
      photosCount: plural({ one: '{count} photo', other: '{count} photos' }), // @todo-translate
      statusLiveOnSite: 'Live on site — guests can book this property', // @todo-translate
      statusNotApproved: 'Not approved — contact support for more info', // @todo-translate
      statusAwaitingReview: 'Awaiting admin review — usually takes 24–48 hours', // @todo-translate
      autoConfirm: 'Auto Confirm', // @todo-translate
      manualApproval: 'Manual Approval', // @todo-translate
      editName: 'Edit name', // @todo-translate
      editCottageName: 'Edit cottage name', // @todo-translate
      moreAmenities: '+{count} more', // @todo-translate
      submittedOn: 'Submitted {date}', // @todo-translate
      editSettings: 'Edit Settings', // @todo-translate
      propertyPhotoAlt: 'Property photo', // @todo-translate
    },
    bookings: {
      title: 'Bookings', // @todo-translate
      subtitle: 'All bookings across your properties', // @todo-translate
      cancelledTitle: 'Cancelled Bookings', // @todo-translate
      cancelledSubtitle: 'History of all cancelled reservations', // @todo-translate
      status: {
        pending: 'Pending', // @todo-translate
        awaitingApproval: 'Awaiting Approval', // @todo-translate
        pendingPayment: 'Pending Payment', // @todo-translate
        confirmed: 'Confirmed', // @todo-translate
        cancelled: 'Cancelled', // @todo-translate
        cancelledByHost: 'Cancelled by Host', // @todo-translate
        rejected: 'Rejected', // @todo-translate
        completed: 'Completed', // @todo-translate
        paymentFailed: 'Payment Failed', // @todo-translate
      },
      paymentStatus: {
        paid: 'Paid', // @todo-translate
        refunded: 'Refunded', // @todo-translate
        refundPending: 'Refund Pending', // @todo-translate
      },
      paymentMethod: {
        atProperty: 'At Property', // @todo-translate
        online: 'Online', // @todo-translate
      },
      countdown: {
        expired: 'Deadline expired', // @todo-translate
        timeLeft: '{hours}h {mins}m left', // @todo-translate
      },
      rejectReasons: {
        datesUnavailable: 'The dates are no longer available', // @todo-translate
        cannotHost: 'The property cannot host this request', // @todo-translate
        cannotAccept: 'The booking request cannot be accepted at this time', // @todo-translate
        minStay: 'Minimum stay requirement not met', // @todo-translate
      },
      errors: {
        approveFailed: 'Failed to approve booking', // @todo-translate
        rejectFailed: 'Failed to reject booking', // @todo-translate
        cancelFailed: 'Failed to cancel booking', // @todo-translate
      },
      tabs: {
        all: 'All', // @todo-translate
        needsApproval: 'Needs Approval', // @todo-translate
      },
      rejectModal: {
        title: 'Reject Booking', // @todo-translate
        subtitle: 'Add a reason for the guest (optional but recommended)', // @todo-translate
        quickReasons: 'Quick reasons', // @todo-translate
        customMessage: 'Custom message', // @todo-translate
        customPlaceholder: 'Type a custom reason for the guest…', // @todo-translate
        confirmRejection: 'Confirm Rejection', // @todo-translate
      },
      pendingApprovalBanner: plural({ one: '{count} booking request needs your approval', other: '{count} booking requests need your approval' }), // @todo-translate
      pendingApprovalHint: 'Review and approve or reject below — guests are waiting.', // @todo-translate
      reviewNow: 'Review Now', // @todo-translate
      cancelledCount: plural({ one: '{count} cancelled booking', other: '{count} cancelled bookings' }), // @todo-translate
      searchPlaceholder: 'Search property, location…', // @todo-translate
      privacyNoticePrefix: 'Guest contact details are private and only revealed', // @todo-translate
      privacyNoticeEmphasis: '1 day before check-in', // @todo-translate
      loadingBookings: 'Loading bookings…', // @todo-translate
      emptyTitle: 'No bookings found', // @todo-translate
      emptyPendingHint: 'No bookings awaiting your approval right now.', // @todo-translate
      emptyFilterHint: 'Try adjusting your filters.', // @todo-translate
      guest: 'Guest', // @todo-translate
      table: {
        property: 'Property', // @todo-translate
        dates: 'Dates', // @todo-translate
        guests: 'Guests', // @todo-translate
        total: 'Total', // @todo-translate
        payment: 'Payment', // @todo-translate
        method: 'Method', // @todo-translate
        status: 'Status', // @todo-translate
        submitted: 'Submitted', // @todo-translate
        actions: 'Actions', // @todo-translate
      },
      private: 'Private', // @todo-translate
      dateChangeRequested: 'Date change requested', // @todo-translate
      approvedSuccess: 'Approved!', // @todo-translate
      approve: 'Approve', // @todo-translate
      reject: 'Reject', // @todo-translate
      cancelBooking: 'Cancel Booking', // @todo-translate
      cancelConfirmTitle: 'Cancel this booking?', // @todo-translate
      cancelConfirmText: 'The guest will be notified by email. This cannot be undone.', // @todo-translate
      yesCancel: 'Yes, Cancel', // @todo-translate
      keep: 'Keep', // @todo-translate
    },
    calendar: {
      title: 'Booking Calendar', // @todo-translate
      subtitle: 'Monthly overview of all bookings and blocked dates across your properties', // @todo-translate
      loading: 'Loading calendar…', // @todo-translate
      allProperties: 'All properties', // @todo-translate
      today: 'Today', // @todo-translate
      blocked: 'Blocked', // @todo-translate
      clickDayHint: 'Click a day to see details', // @todo-translate
      bookingsCount: plural({ one: '{count} booking', other: '{count} bookings' }), // @todo-translate
      blockedDate: 'Blocked date', // @todo-translate
      noBookingsOnDate: 'No bookings on this date', // @todo-translate
      visible: 'Visible', // @todo-translate
      detailsRevealedOnCheckIn: 'Details revealed on check-in', // @todo-translate
      upcomingTitle: 'Upcoming Bookings', // @todo-translate
      upcomingSubtitle: 'Next stays across your properties', // @todo-translate
      noUpcoming: 'No upcoming bookings yet', // @todo-translate
    },
    blockedDates: {
      title: 'Blocked Dates', // @todo-translate
      subtitle: 'Mark dates unavailable to prevent guest bookings on specific days', // @todo-translate
      noProperties: 'No properties yet', // @todo-translate
      noPropertiesHint: 'Submit a property to manage its availability', // @todo-translate
      blockNewDates: 'Block New Dates', // @todo-translate
      oneDay: '1 day', // @todo-translate
      selected: 'Selected', // @todo-translate
      range: 'Range', // @todo-translate
      alreadyBlocked: 'Already blocked', // @todo-translate
      from: 'From', // @todo-translate
      to: 'To', // @todo-translate
      sameDaySingle: 'Same day (single)', // @todo-translate
      selectEndDate: 'Select end date', // @todo-translate
      reasonPlaceholder: 'Reason (optional) — e.g. Personal use, Maintenance', // @todo-translate
      blockTheseDates: 'Block These Dates', // @todo-translate
      blockThisDate: 'Block This Date', // @todo-translate
      clear: 'Clear', // @todo-translate
      singleDayHint: 'Click the same date again to block just this day, or select a different date for a range.', // @todo-translate
      blockedPeriods: 'Blocked Periods', // @todo-translate
      refresh: 'Refresh', // @todo-translate
      emptyTitle: 'No blocked dates yet.', // @todo-translate
      emptySubtitle: 'All dates are available for guests.', // @todo-translate
      unknownProperty: 'Unknown', // @todo-translate
      removeBlock: 'Remove block', // @todo-translate
      saveFailed: 'Failed to save blocked dates. Please try again.', // @todo-translate
      datesBlockedSuccess: 'Dates blocked successfully!', // @todo-translate
      dateBlockedSuccess: 'Date blocked successfully!', // @todo-translate
      removeFailed: 'Failed to remove blocked dates.', // @todo-translate
      removedSuccess: 'Blocked dates removed.', // @todo-translate
    },
    dateChange: {
      title: 'Date Change Requests', // @todo-translate
      subtitle: 'Guest-requested booking date modifications for your properties', // @todo-translate
      emptyTitle: 'No date change requests', // @todo-translate
      emptySubtitle: 'Guest date change requests will appear here', // @todo-translate
      table: {
        currentDates: 'Current Dates', // @todo-translate
        requestedDates: 'Requested Dates', // @todo-translate
        price: 'Price', // @todo-translate
        requested: 'Requested', // @todo-translate
      },
      status: {
        approved: 'Approved', // @todo-translate
      },
    },
    editModal: {
      title: 'Edit Property Settings', // @todo-translate
      tabSettings: 'Property Settings', // @todo-translate
      tabPhotos: 'Photos & Cover', // @todo-translate
      cottageName: 'Cottage Name', // @todo-translate
      cottageNameHint: 'This is the listing title guests see on cards and the property page.', // @todo-translate
      cottageNamePlaceholder: 'e.g. Cozy Mountain Cottage in Kazbegi', // @todo-translate
      pricingModel: 'Pricing Model', // @todo-translate
      pricingModelHint: 'Choose how your nightly price is calculated for guests.', // @todo-translate
      fixedPrice: 'Fixed Price', // @todo-translate
      fixedPriceDesc: 'One nightly rate for all guests, regardless of how many people stay.', // @todo-translate
      fixedPriceBadge: 'Simple & consistent', // @todo-translate
      perGuestPrice: 'By Guest Count', // @todo-translate
      perGuestPriceDesc: 'Set different nightly prices depending on how many guests are staying.', // @todo-translate
      perGuestPriceBadge: 'Flexible pricing', // @todo-translate
      nightlyRateLabel: 'Nightly Rate (₾)', // @todo-translate
      nightlyRatePlaceholder: 'e.g. 120', // @todo-translate
      fixedPriceNote: 'This price applies to all bookings regardless of guest count.', // @todo-translate
      tierInfo: 'Set the nightly price for each guest count. The system will automatically use the correct price when a guest selects their group size.', // @todo-translate
      guestRange: '{min}–{max} guests', // @todo-translate
      tierPricePlaceholder: 'Price per night', // @todo-translate
      perNightSuffix: '/ night', // @todo-translate
      tiersBasedOnMax: 'Tiers are based on your property\'s max guest count ({count} guests).', // @todo-translate
      description: 'Property Description', // @todo-translate
      descriptionHint: 'Describe your cottage — what makes it special, the setting, what guests will love', // @todo-translate
      descriptionPlaceholder: 'Tell guests what makes your place special…', // @todo-translate
      exactLocation: 'Exact Location', // @todo-translate
      exactLocationHint: 'Add your cottage\'s exact location so guests can find you easily.', // @todo-translate
      addressLabel: 'Address (optional)', // @todo-translate
      addressPlaceholder: 'e.g. Kazbegi, Stepantsminda village, Georgia', // @todo-translate
      googleMapsLabel: 'Google Maps Link (optional)', // @todo-translate
      googleMapsHint: 'In Google Maps, click "Share" → "Copy link" and paste it here.', // @todo-translate
      latitudeLabel: 'Latitude (optional)', // @todo-translate
      latitudePlaceholder: 'e.g. 42.6593', // @todo-translate
      longitudeLabel: 'Longitude (optional)', // @todo-translate
      longitudePlaceholder: 'e.g. 44.6390', // @todo-translate
      coordsHint: 'To get coordinates: open Google Maps, right-click your exact location, and the coordinates will appear at the top of the menu.', // @todo-translate
      amenitiesLabel: 'Amenities', // @todo-translate
      amenitiesHint: 'Select all amenities your property offers.', // @todo-translate
      customAmenityPlaceholder: 'Add custom amenity…', // @todo-translate
      approvalMode: 'Booking Approval Mode', // @todo-translate
      approvalModeHint: 'Choose how booking requests for this property are handled.', // @todo-translate
      autoConfirm: 'Auto Confirm', // @todo-translate
      autoConfirmDescPrefix: 'Booking requests are', // @todo-translate
      autoConfirmDescEmphasis: 'automatically confirmed', // @todo-translate
      autoConfirmDescSuffix: 'the moment a guest submits.', // @todo-translate
      autoConfirmBadge: 'Instant confirmation', // @todo-translate
      manualApproval: 'Manual Approval', // @todo-translate
      manualDescPrefix: 'You review each request and have', // @todo-translate
      manualDescEmphasis: '24 hours', // @todo-translate
      manualDescSuffix: 'to approve or reject.', // @todo-translate
      manualApprovalBadge: 'Host approval required', // @todo-translate
      paymentMethods: 'Accepted Payment Methods', // @todo-translate
      paymentMethodsHint: 'Choose how guests can pay for this property.', // @todo-translate
      payBoth: 'Both', // @todo-translate
      payBothDesc: 'Guests can choose either option.', // @todo-translate
      payOnline: 'Online only', // @todo-translate
      payOnlineDesc: 'Card payment only.', // @todo-translate
      payAtProperty: 'Pay at property only', // @todo-translate
      payAtPropertyDesc: 'Cash on arrival only.', // @todo-translate
      savedSuccess: 'Changes saved successfully!', // @todo-translate
      coverInfoPrefix: 'The', // @todo-translate
      coverInfoCoverPhoto: 'cover photo', // @todo-translate
      coverInfoMiddle: 'is shown as the main image on listing cards, the homepage, and the property detail page. Click', // @todo-translate
      coverInfoMakeCover: '"Make Cover Photo"', // @todo-translate
      coverInfoSuffix: 'on any photo to set it as the primary image.', // @todo-translate
      uploadNewPhoto: 'Upload New Photo', // @todo-translate
      uploadPhotoMax: 'Upload Photo (max 15MB)', // @todo-translate
      noPhotos: 'No photos uploaded yet', // @todo-translate
      noPhotosHint: 'Upload your first photo above', // @todo-translate
      allPhotos: 'All Photos ({count})', // @todo-translate
      photoAlt: 'Property photo {num}', // @todo-translate
      coverBadge: 'Cover', // @todo-translate
      makeCover: 'Make Cover Photo', // @todo-translate
      currentCover: 'Current Cover Photo', // @todo-translate
      currentCoverAlt: 'Current cover', // @todo-translate
      currentCoverHint: 'This photo appears first on all listing cards and the property detail page.', // @todo-translate
      cardFraming: 'Card Framing — adjust which part of the photo is visible in listing cards', // @todo-translate
      cardFramingHint: 'If the cottage is cut off in the preview card, shift the focus up or down here.', // @todo-translate
      framingTop: 'Show Top', // @todo-translate
      framingCenter: 'Centered', // @todo-translate
      framingBottom: 'Show Bottom', // @todo-translate
      framingPreviewNote: 'The preview above updates instantly so you can see how it looks in cards.', // @todo-translate
      coverUpdated: 'Cover photo updated! It will now appear as the main image across the site.', // @todo-translate
      settingsFooterNote: 'Changes go live once admin reviews any listing updates', // @todo-translate
      savedShort: 'Saved!', // @todo-translate
      saveChanges: 'Save Changes', // @todo-translate
      photosFooterNote: 'Cover photo changes take effect immediately', // @todo-translate
      errorTitleRequired: 'Cottage name cannot be empty.', // @todo-translate
      errorDescriptionRequired: 'Description cannot be empty.', // @todo-translate
      errorInvalidPrice: 'Please enter a valid price per night.', // @todo-translate
      errorInvalidTierPrice: 'Please enter a valid price for every guest tier.', // @todo-translate
      errorInvalidCoords: 'Latitude and longitude must be valid numbers.', // @todo-translate
      errorSaveFailed: 'Failed to save changes. Please try again.', // @todo-translate
      errorFileTooLarge: 'File is too large. Maximum size is 15MB.', // @todo-translate
      errorUploadFailed: 'Upload failed. Please try again.', // @todo-translate
      errorPhotoSaveFailed: 'Photo uploaded but failed to save. Please try again.', // @todo-translate
      errorUploadUnexpected: 'Unexpected error during upload.', // @todo-translate
      errorSetCoverFailed: 'Failed to set cover photo. Please try again.', // @todo-translate
      errorSaveFramingFailed: 'Failed to save framing. Please try again.', // @todo-translate
    },
    ical: {
      stepAirbnbLogin: 'Log in to Airbnb → go to your Listing', // @todo-translate
      stepAirbnbAvailabilityTab: 'Click "Availability" tab', // @todo-translate
      stepAirbnbSyncSection: 'Scroll to "Sync calendars" section', // @todo-translate
      stepAirbnbAvailabilitySync: 'Click "Availability" → "Sync calendars"', // @todo-translate
      stepAirbnbRefresh: 'Airbnb refreshes imported calendars every ~24 hours', // @todo-translate
      stepBookingLogin: 'Log in to Booking.com Extranet', // @todo-translate
      stepBookingCalendarSync: 'Go to "Calendar" → "Sync calendars"', // @todo-translate
      stepBookingRefresh: 'Booking.com refreshes imported calendars every ~24 hours', // @todo-translate
      stepExportCopy: 'Click "Export calendar" and copy the .ics link', // @todo-translate
      stepImportPaste: 'Click "Import calendar" and paste the link below', // @todo-translate
      stepPasteBelowAdd: 'Paste it below and click Add', // @todo-translate
      addModalTitle: 'Add External Calendar', // @todo-translate
      platform: 'Platform', // @todo-translate
      howToGetLink: 'How to get your {platform} iCal link:', // @todo-translate
      labelField: 'Label', // @todo-translate
      optionalSuffix: '(optional)', // @todo-translate
      labelPlaceholder: 'e.g. My {platform} listing', // @todo-translate
      calendarExportUrl: '{platform} Calendar Export URL', // @todo-translate
      errorUrlRequired: 'Please enter a calendar URL', // @todo-translate
      errorUrlInvalid: 'URL must start with http:// or https://', // @todo-translate
      adding: 'Adding…', // @todo-translate
      addCalendar: 'Add Calendar', // @todo-translate
      addFirstCalendar: 'Add First Calendar', // @todo-translate
      statusSynced: 'Synced', // @todo-translate
      statusError: 'Error', // @todo-translate
      statusNotSynced: 'Not synced', // @todo-translate
      lastSynced: 'Last synced: {date}', // @todo-translate
      refreshSyncTitle: 'Refresh sync', // @todo-translate
      removeCalendarTitle: 'Remove calendar', // @todo-translate
      errorAddFailed: 'Failed to add calendar', // @todo-translate
      errorSyncFailed: 'Sync failed', // @todo-translate
      errorRemoveFailed: 'Remove failed', // @todo-translate
      toastCalendarAdded: 'Calendar added! Click Sync to import blocked dates.', // @todo-translate
      toastSyncedEvents: plural({ one: 'Synced {count} event', other: 'Synced {count} events' }), // @todo-translate
      toastSyncedCalendars: plural({ one: 'Synced {count} calendar', other: 'Synced {count} calendars' }), // @todo-translate
      toastImportedPeriods: plural({ one: '{count} blocked period imported', other: '{count} blocked periods imported' }), // @todo-translate
      toastSyncFailed: 'Sync failed: {error}', // @todo-translate
      toastCalendarRemoved: 'Calendar removed', // @todo-translate
      toastRemoveFailed: 'Failed to remove: {error}', // @todo-translate
      toastLinkCopied: 'Export link copied to clipboard!', // @todo-translate
      noProperties: 'No properties yet', // @todo-translate
      noPropertiesHint: 'Submit a property first to connect its calendar', // @todo-translate
      selectProperty: 'Select Property', // @todo-translate
      syncingAll: 'Syncing all…', // @todo-translate
      syncAll: 'Sync All Calendars', // @todo-translate
      tabImport: 'Import Calendars', // @todo-translate
      tabExport: 'Export Calendar', // @todo-translate
      tabBlocked: 'Blocked Dates', // @todo-translate
      connectedTitle: 'Connected External Calendars', // @todo-translate
      connectedHint: 'Import blocked dates from Airbnb and Booking.com to prevent double bookings', // @todo-translate
      notConnected: 'Not connected', // @todo-translate
      calendarsConnected: plural({ one: '{count} calendar connected', other: '{count} calendars connected' }), // @todo-translate
      loadingCalendars: 'Loading calendars…', // @todo-translate
      noCalendars: 'No external calendars connected', // @todo-translate
      noCalendarsHint: 'Add your Airbnb or Booking.com calendar to automatically block booked dates', // @todo-translate
      exportTitle: 'Export Your Website Calendar', // @todo-translate
      exportHint: 'Copy this link and import it into Airbnb and Booking.com so your website bookings block dates on those platforms too.', // @todo-translate
      exportUrlLabel: 'Your Website Calendar Export URL', // @todo-translate
      importInto: 'Import into {platform}:', // @todo-translate
      exportNote: 'This link is public and always up to date. It includes all confirmed bookings and manually blocked dates from your website. External platforms typically refresh imported calendars every 24 hours.', // @todo-translate
      blockedTitle: 'Externally Blocked Dates', // @todo-translate
      blockedHint: 'Dates imported from Airbnb and Booking.com — unavailable to guests on your website', // @todo-translate
      noBlocks: 'No external blocks imported yet', // @todo-translate
      noBlocksSyncHint: 'Click "Sync All Calendars" to pull the latest bookings', // @todo-translate
      noBlocksConnectHint: 'Connect a calendar in the Import tab first', // @todo-translate
      thFrom: 'From', // @todo-translate
      thTo: 'To', // @todo-translate
      thSummary: 'Summary', // @todo-translate
      thSource: 'Source', // @todo-translate
      noSummary: 'No summary', // @todo-translate
    },
  },
  payment: {
    success: {
      seo: {
        title: 'Payment Successful — RentCottage.Ge', // @todo-translate
        description: 'Your cottage booking payment was successful. View your booking confirmation.', // @todo-translate
      },
      noBookingInfo: 'No booking information found.', // @todo-translate
      goHome: 'Go Home', // @todo-translate
      verifying: 'Verifying payment...', // @todo-translate
      processing: 'Processing payment...', // @todo-translate
      confirmingWithBank: 'We\'re confirming your payment with Bank of Georgia. This usually takes a few seconds.', // @todo-translate
      pendingTitle: 'Payment being processed', // @todo-translate
      pendingDesc: 'Your payment is being verified by Bank of Georgia. This can sometimes take a minute. You\'ll receive a confirmation email once it\'s complete.', // @todo-translate
      bookingReference: 'Booking reference', // @todo-translate
      viewMyBookings: 'View My Bookings', // @todo-translate
      title: 'Payment Successful!', // @todo-translate
      confirmedDesc: 'Your booking is confirmed. A confirmation email has been sent to you.', // @todo-translate
      bookingConfirmed: 'Booking Confirmed', // @todo-translate
      duration: 'Duration', // @todo-translate
      totalPaid: 'Total paid', // @todo-translate
      bookingId: 'Booking ID', // @todo-translate
      browseMoreCottages: 'Browse More Cottages', // @todo-translate
      failedTitle: 'Payment could not be verified', // @todo-translate
      failedDesc: 'Bank of Georgia did not confirm a successful payment. No charges were made. If you believe this is an error, please contact our support team with your booking reference.', // @todo-translate
      tryBookingAgain: 'Try Booking Again', // @todo-translate
    },
    returnToHome: 'Return to Home', // @todo-translate
    reference: 'Reference', // @todo-translate
    needHelp: 'Need help?', // @todo-translate
    contactSupport: 'Contact support', // @todo-translate
    failed: {
      seo: {
        title: 'Payment Failed — RentCottage.Ge', // @todo-translate
        description: 'Your payment could not be completed. No charges have been made. Please try again.', // @todo-translate
      },
      title: 'Payment Failed or Cancelled', // @todo-translate
      desc: 'Your payment was not completed. No charges have been made to your account. You can try again or choose a different payment method.', // @todo-translate
      reasonsTitle: 'Common reasons for failure:', // @todo-translate
      reasonInsufficientFunds: 'Insufficient funds on card', // @todo-translate
      reasonCardDeclined: 'Card declined by the bank', // @todo-translate
      reasonSessionTimeout: 'Payment session timed out', // @todo-translate
      reasonCancelledByYou: 'Transaction cancelled by you', // @todo-translate
      reason3dsFailed: '3D Secure authentication failed', // @todo-translate
      statusUpdated: 'Booking status updated.', // @todo-translate
      tryAgain: 'Try Again', // @todo-translate
      browseCottages: 'Browse Cottages', // @todo-translate
    },
  },
  authPages: {
    justAMoment: 'Just a moment', // @todo-translate
    callback: {
      blockedTitle: 'Registration Not Allowed', // @todo-translate
      blockedDesc: 'This email address is not allowed to register. Registration with this email is blocked.', // @todo-translate
      backToHome: 'Back to Home', // @todo-translate
      authFailed: 'Authentication failed. Please try again.', // @todo-translate
      redirecting: 'Redirecting you back...', // @todo-translate
      completingSignIn: 'Completing sign in...', // @todo-translate
    },
    validation: {
      passwordMinLength: 'Password must be at least 8 characters.', // @todo-translate
      passwordsNoMatch: 'Passwords do not match.', // @todo-translate
      captchaRequired: 'Please complete the CAPTCHA verification.', // @todo-translate
    },
    reset: {
      verifyingLink: 'Verifying reset link...', // @todo-translate
      expiredTitle: 'Link expired or invalid', // @todo-translate
      expiredDesc: 'This password reset link has expired or already been used. Please request a new one.', // @todo-translate
      successTitle: 'Password updated!', // @todo-translate
      successDesc: 'Your password has been changed successfully. You can now log in with your new password.', // @todo-translate
      goHomeLogin: 'Go to home & log in', // @todo-translate
      title: 'Set new password', // @todo-translate
      subtitle: 'Choose a strong password for your account.', // @todo-translate
      newPassword: 'New password', // @todo-translate
      newPasswordPlaceholder: 'Enter new password', // @todo-translate
      minChars: 'Minimum 8 characters', // @todo-translate
      confirmNewPassword: 'Confirm new password', // @todo-translate
      saveButton: 'Save new password', // @todo-translate
    },
  },
  corporate: {
    seo: {
      title: 'For Travel Agencies — Earn 5% Commission | RentCottage.Ge', // @todo-translate
      description: 'Partner with RentCottage.Ge as a travel agency. Book cottages on behalf of your clients and earn 5% commission on every confirmed booking.', // @todo-translate
    },
    hero: {
      badge: 'For Travel Agencies', // @todo-translate
      title1: 'Book cottages for your clients.', // @todo-translate
      title2: 'Earn 5% on every booking.', // @todo-translate
      desc1: 'Register your agency, get approved within 24 hours, and start booking any cottage on RentCottage.Ge on behalf of your clients — with a clean dashboard, full booking history, and automatic', // @todo-translate
      descStrong: '5% commission', // @todo-translate
      desc2: 'on the rent paid.', // @todo-translate
      point1: '5% commission per booking', // @todo-translate
      point2: 'Full rental history', // @todo-translate
      point3: 'Dedicated dashboard', // @todo-translate
    },
    statusCards: {
      pendingTitle: 'Your application is under review', // @todo-translate
      pendingMessage: 'We\'re reviewing your application for {agencyName}. You\'ll get an email as soon as a decision is made — usually within 24 hours.', // @todo-translate
      rejectedTitle: 'Application not approved', // @todo-translate
      rejectedMessage: 'Your application for {agencyName} was not approved.', // @todo-translate
      rejectedReason: 'Reason: {reason}', // @todo-translate
      rejectedContact: 'Contact us if you\'d like to discuss next steps.', // @todo-translate
      successTitle: 'Application received', // @todo-translate
      successMessage: 'Thanks for applying. We\'ll review your details and email you within 24 hours. You can now sign in with your tax ID and password to check your status.', // @todo-translate
    },
    applyAsAgency: 'Apply as an agency', // @todo-translate
    signIn: 'Sign in', // @todo-translate
    networkError: 'Network error. Please try again.', // @todo-translate
    form: {
      requiredNote1: 'All fields marked with', // @todo-translate
      requiredNote2: 'are required.', // @todo-translate
      agencyName: 'Agency name *', // @todo-translate
      agencyNamePlaceholder: 'e.g. Tbilisi Travel LLC', // @todo-translate
      taxIdFull: 'Tax / company ID number *', // @todo-translate
      taxIdPlaceholder: 'e.g. 405123456', // @todo-translate
      repFirstName: 'Representative first name *', // @todo-translate
      repLastName: 'Representative last name *', // @todo-translate
      firstNamePlaceholder: 'First name', // @todo-translate
      lastNamePlaceholder: 'Last name', // @todo-translate
      email: 'Email *', // @todo-translate
      phone: 'Phone *', // @todo-translate
      password: 'Password * (min. 8 chars)', // @todo-translate
      confirmPassword: 'Confirm password *', // @todo-translate
      fillAllRequired: 'Please fill in all required fields.', // @todo-translate
      requestFailed: 'Request failed ({status})', // @todo-translate
      submitting: 'Submitting…', // @todo-translate
      submitButton: 'Submit application', // @todo-translate
      alreadyHaveAccount: 'Already have an account?', // @todo-translate
      signInWithTaxId: 'Sign in with your tax ID', // @todo-translate
    },
    signin: {
      title: 'Sign in as an agency', // @todo-translate
      subtitle: 'Use the tax ID and password you registered with.', // @todo-translate
      taxIdLabel: 'Tax ID *', // @todo-translate
      passwordLabel: 'Password *', // @todo-translate
      enterCredentials: 'Please enter your tax ID and password.', // @todo-translate
      failed: 'Sign-in failed ({status})', // @todo-translate
      signingIn: 'Signing in…', // @todo-translate
      newHere: 'New here?', // @todo-translate
    },
    dashboard: {
      seo: {
        title: 'Corporate Dashboard | RentCottage.Ge', // @todo-translate
        description: 'Agency dashboard — bookings on behalf of clients and commission tracking.', // @todo-translate
      },
      loading: 'Loading dashboard…', // @todo-translate
      noAccount: 'No agency account is linked to this login.', // @todo-translate
      stillUnderReview: 'Your application is still under review.', // @todo-translate
      notActive: 'Your agency account is not active.', // @todo-translate
      loadFailed: 'Your corporate account could not be loaded.', // @todo-translate
      unavailableTitle: 'Dashboard unavailable', // @todo-translate
      backToCorporate: 'Back to /corporate', // @todo-translate
      kicker: 'Agency Dashboard', // @todo-translate
      taxId: 'Tax ID {taxId}', // @todo-translate
      earningCommission: 'Earning {pct}% commission', // @todo-translate
      bookCottage: 'Book a cottage', // @todo-translate
      signOut: 'Sign out', // @todo-translate
      statBookings: 'Bookings made', // @todo-translate
      statRevenue: 'Confirmed rent revenue', // @todo-translate
      statCommission: 'Your commission ({pct}%)', // @todo-translate
      bookingHistory: 'Booking history', // @todo-translate
      totalCount: '{count} total', // @todo-translate
      emptyTitle: 'No bookings yet.', // @todo-translate
      emptyDesc: 'Book a cottage on behalf of a client to start earning commission.', // @todo-translate
      thClient: 'Client', // @todo-translate
      thStay: 'Stay', // @todo-translate
      thRent: 'Rent', // @todo-translate
      thCommission: 'Commission', // @todo-translate
      status: {
        confirmed: 'confirmed', // @todo-translate
        pending: 'pending', // @todo-translate
        pendingHostApproval: 'pending host approval', // @todo-translate
        cancelled: 'cancelled', // @todo-translate
        cancelledByHost: 'cancelled by host', // @todo-translate
        rejected: 'rejected', // @todo-translate
      },
    },
  },
  profile: {
    header: {
      joined: 'Joined {date}', // @todo-translate
    },
    editProfile: 'Edit Profile', // @todo-translate
    tabs: {
      profile: 'Profile', // @todo-translate
      myBookings: 'My Bookings', // @todo-translate
      wishlist: 'Wishlist', // @todo-translate
      reviews: 'Reviews', // @todo-translate
    },
    banners: {
      incompleteTitle: 'Profile incomplete', // @todo-translate
      addFirstAndLastName: 'Please add your first and last name to complete your profile.', // @todo-translate
      addFirstName: 'Please add your first name to complete your profile.', // @todo-translate
      addLastName: 'Please add your last name to complete your profile.', // @todo-translate
      completeAction: 'Complete', // @todo-translate
      addPhoneTitle: 'Add a phone number', // @todo-translate
      addPhoneBody: 'Adding a phone number makes it easier to stay in touch about your bookings.', // @todo-translate
    },
    avatar: {
      alt: 'Profile', // @todo-translate
      sectionTitle: 'Profile Photo', // @todo-translate
      changePhoto: 'Change photo', // @todo-translate
      uploadPhoto: 'Upload photo', // @todo-translate
      removePhoto: 'Remove photo', // @todo-translate
      fileHint: 'JPG, PNG, WebP · max 5 MB', // @todo-translate
      errorNotImage: 'Please select an image file.', // @todo-translate
      errorTooLarge: 'Image must be under 5 MB.', // @todo-translate
      errorUpload: 'Upload failed. Please try again.', // @todo-translate
      errorRemove: 'Could not remove photo. Please try again.', // @todo-translate
    },
    edit: {
      firstNameRequired: 'First name is required.', // @todo-translate
      lastNameRequired: 'Last name is required.', // @todo-translate
      invalidPhone: 'Please enter a valid Georgian phone number (e.g. +995 555 12 34 56).', // @todo-translate
      saveFailed: 'Failed to save. Please try again.', // @todo-translate
      phonePlaceholder: '+995 555 000 000', // @todo-translate
      phoneHint: 'Georgian number. Changing it requires SMS verification.', // @todo-translate
      saveChanges: 'Save Changes', // @todo-translate
    },
    fields: {
      firstName: 'First Name', // @todo-translate
      lastName: 'Last Name', // @todo-translate
      email: 'Email', // @todo-translate
      phone: 'Phone', // @todo-translate
      location: 'Location', // @todo-translate
      bio: 'Bio', // @todo-translate
      memberSince: 'Member Since', // @todo-translate
    },
    view: {
      title: 'Profile Information', // @todo-translate
      noBio: 'No bio added yet.', // @todo-translate
    },
    phone: {
      verified: 'Verified', // @todo-translate
      notVerified: 'Not verified', // @todo-translate
      verifyNow: 'Verify now', // @todo-translate
      verifyTitle: 'Verify your phone number', // @todo-translate
      verifyReason: 'We\'ll text a 6-digit code to confirm this number is yours.', // @todo-translate
    },
    bookings: {
      loading: 'Loading your bookings...', // @todo-translate
      emptyTitle: 'No bookings yet', // @todo-translate
      emptyBody: 'Your booking requests will appear here once you book a cottage.', // @todo-translate
      exploreCottages: 'Explore Cottages', // @todo-translate
    },
    wishlist: {
      empty: 'Your saved properties will appear here.', // @todo-translate
    },
    reviews: {
      empty: 'Your reviews will appear here.', // @todo-translate
    },
    booking: {
      status: {
        confirmed: 'Confirmed', // @todo-translate
        pending: 'Pending Review', // @todo-translate
        pendingHostApproval: 'Awaiting Host Approval', // @todo-translate
        pendingPayment: 'Pending Payment', // @todo-translate
        cancelled: 'Cancelled', // @todo-translate
        cancelledByHost: 'Cancelled by Host', // @todo-translate
        rejected: 'Not Approved', // @todo-translate
        completed: 'Completed', // @todo-translate
        paymentFailed: 'Payment Failed', // @todo-translate
        refundPending: 'Refund Pending', // @todo-translate
      },
      total: 'Total: ₾{price}', // @todo-translate
      payAtProperty: 'Pay at Property', // @todo-translate
      paidOnline: 'Paid Online', // @todo-translate
      onlinePayment: 'Online Payment', // @todo-translate
      changesLocked: 'Changes locked after check-in', // @todo-translate
      changePending: 'Change Pending', // @todo-translate
      changeDates: 'Change Dates', // @todo-translate
      cancelConfirm: 'Are you sure you want to cancel this booking? A confirmation email will be sent to you. This action cannot be undone.', // @todo-translate
      cancelling: 'Cancelling...', // @todo-translate
      confirmCancel: 'Yes, Cancel Booking', // @todo-translate
      keepBooking: 'Keep Booking', // @todo-translate
      cancelFailed: 'Could not cancel booking. Please try again.', // @todo-translate
      cancelSuccess: 'Booking cancelled. A confirmation email has been sent to you.', // @todo-translate
      browseOther: 'Browse other cottages', // @todo-translate
      hostContact: {
        title: 'Host Contact Details', // @todo-translate
        visible: 'Visible', // @todo-translate
        messageHost: 'Message Host', // @todo-translate
        privateTitle: 'Host contact details are private', // @todo-translate
        revealPrefix: 'Host contact information will be revealed', // @todo-translate
        revealTiming: '1 day before check-in', // @todo-translate
        emailSubject: 'Booking #{ref} – {title}', // @todo-translate
        emailBody: 'Hi {name},\n\nI have a booking at {title} (Check-in: {checkIn}, Check-out: {checkOut}).\n\nI wanted to reach out regarding my upcoming stay.\n\nBest regards', // @todo-translate
        emailFallbackName: 'there', // @todo-translate
      },
      dateChange: {
        pendingTitle: 'Date change pending approval', // @todo-translate
        requestedLabel: 'Requested:', // @todo-translate
        originalActive: 'Your original dates remain active until the host responds.', // @todo-translate
        rejectedTitle: 'Date change request was not approved', // @todo-translate
        rejectedBody: 'Your original booking dates remain unchanged. You may submit a new request.', // @todo-translate
      },
      cancelledByHost: {
        title: 'This booking was cancelled by the host', // @todo-translate
        body: 'The host cancelled this confirmed booking. You should have received an email with details.', // @todo-translate
        refundPrefix: 'Since you paid online, a', // @todo-translate
        refundStrong: 'refund will be processed', // @todo-translate
        refundSuffix: 'within 5–10 business days.', // @todo-translate
      },
      rejectedBanner: {
        title: 'Booking request was not approved', // @todo-translate
        reasonFromHost: 'Reason from host', // @todo-translate
        defaultReason: 'The host was unable to accommodate this booking request. Feel free to explore other available cottages.', // @todo-translate
      },
      awaitingApproval: {
        title: 'Awaiting host approval', // @todo-translate
        body: 'Your booking request has been submitted. The host will review it and you will receive an email once a decision is made.', // @todo-translate
      },
    },
    review: {
      writeReview: 'Write a Review', // @todo-translate
      reviewed: 'Reviewed', // @todo-translate
      submitSuccess: 'Review submitted! Thank you for your feedback.', // @todo-translate
      overallRating: 'Overall Rating', // @todo-translate
      yourExperience: 'Your Experience', // @todo-translate
      placeholder: 'Share what you loved about this place — the atmosphere, the host, the location...', // @todo-translate
      submitReview: 'Submit Review', // @todo-translate
      rating1: 'Poor', // @todo-translate
      rating2: 'Fair', // @todo-translate
      rating3: 'Good', // @todo-translate
      rating4: 'Very Good', // @todo-translate
      rating5: 'Excellent', // @todo-translate
    },
    changeDates: {
      title: 'Request Date Change', // @todo-translate
      errorBothDates: 'Please select both dates.', // @todo-translate
      errorOrder: 'Check-out must be after check-in.', // @todo-translate
      errorPast: 'Check-in date cannot be in the past.', // @todo-translate
      errorSubmit: 'Failed to submit request. Please try again.', // @todo-translate
      submittedTitle: 'Request Submitted!', // @todo-translate
      submittedBodyPrefix: 'Your date change request for', // @todo-translate
      submittedBodySuffix: 'is now pending admin approval.', // @todo-translate
      submittedNote: 'You\'ll receive a confirmation email once the host approves or rejects your request. Your original dates remain active in the meantime.', // @todo-translate
      requestedCheckIn: 'Requested check-in', // @todo-translate
      requestedCheckOut: 'Requested check-out', // @todo-translate
      newTotal: 'New total', // @todo-translate
      newCheckIn: 'New Check-in', // @todo-translate
      newCheckOut: 'New Check-out', // @todo-translate
      newTotalPrice: 'New total: ₾{price}', // @todo-translate
      originalTotalPrice: 'Original total: ₾{price}', // @todo-translate
      info: 'This will submit a request — your dates won\'t change until the host approves it. You\'ll receive an email with the decision.', // @todo-translate
    },
  },
  property: {
    seo: {
      title: '{title} — {location} Cottage Rental | RentCottage.Ge', // @todo-translate
      description: 'Book {title} in {location}, Georgia. ₾{price}/night · {bedrooms} bedrooms · Rating {rating}. Authentic Georgian cottage experience with verified host.', // @todo-translate
      keywords: '{location} cottage rental, Georgian cottage {location}, rent cottage Georgia', // @todo-translate
    },
    loading: 'Loading property...', // @todo-translate
    backToResults: 'Back to search results', // @todo-translate
    verified: 'Verified', // @todo-translate
    share: 'Share', // @todo-translate
    copied: 'Copied!', // @todo-translate
    shareTitleFallback: 'Georgian Cottage', // @todo-translate
    shareLocationFallback: 'Georgia', // @todo-translate
    shareText: 'Check out this cottage in {location} on RentCottage.Ge!', // @todo-translate
    hostedBy: 'Hosted by {host}', // @todo-translate
    superhost: 'Superhost', // @todo-translate
    superhostTenure: 'Superhost · 3 years hosting', // @todo-translate
    factGuestsSub: 'Maximum', // @todo-translate
    factBedroomsSub: 'Sleeping', // @todo-translate
    factBathroomsSub: 'Private', // @todo-translate
    factVerifiedSub: 'Checked listing', // @todo-translate
    aboutTitle: 'About this place', // @todo-translate
    descriptionFallback: 'Experience authentic Georgian hospitality in this beautifully restored {title}. Located in the heart of {location}, this charming property offers stunning views and easy access to local attractions. The space features traditional Georgian architecture combined with modern amenities for your comfort. Perfect for couples, families, or small groups looking to explore the beauty of Georgia while enjoying a peaceful retreat. Your host {host} is a local expert who can provide insider tips on the best restaurants, hiking trails, and cultural experiences in the area.', // @todo-translate
    amenitiesTitle: 'What this place offers', // @todo-translate
    allAmenities: 'All amenities ({count})', // @todo-translate
    locationTitle: 'Where you\'ll be', // @todo-translate
    mapTitle: 'Property location map', // @todo-translate
    viewOnGoogleMaps: 'View on Google Maps', // @todo-translate
    externalPlatform: 'External', // @todo-translate
    errors: {
      captcha: 'Please complete the CAPTCHA verification.', // @todo-translate
      fillDates: 'Please fill in all dates and guest count.', // @todo-translate
      checkoutAfterCheckin: 'Check-out must be after check-in.', // @todo-translate
      datesUnavailable: 'The selected dates are unavailable. Please choose different dates.', // @todo-translate
      phoneRequired: 'Please add a phone number to your profile before making a booking. Go to My Profile to complete your account.', // @todo-translate
      paymentNoUrl: 'Payment system error: no checkout URL returned. Please try again.', // @todo-translate
      network: 'Network error. Please check your connection and try again.', // @todo-translate
    },
    gallery: {
      photoAlt: '{title} — photo {number}', // @todo-translate
      allPhotos: 'All photos ({count})', // @todo-translate
      thumbnailAlt: 'Thumbnail {number}', // @todo-translate
    },
  },
  reviews: {
    noReviewsYet: 'No reviews yet', // @todo-translate
    writeReview: 'Write a Review', // @todo-translate
    youReviewed: 'You reviewed this property', // @todo-translate
    reviewed: 'Reviewed', // @todo-translate
    submitSuccess: 'Thank you! Your review has been submitted.', // @todo-translate
    yourReview: 'Your Review', // @todo-translate
    ratingLabel: 'Rating', // @todo-translate
    experienceLabel: 'Your experience', // @todo-translate
    experiencePlaceholder: 'Share your experience — what did you love about this place?', // @todo-translate
    submitError: 'Something went wrong. Please try again.', // @todo-translate
    submitting: 'Submitting…', // @todo-translate
    submitReview: 'Submit Review', // @todo-translate
    beFirst: 'Be the first to leave a review!', // @todo-translate
    showFewer: 'Show fewer reviews', // @todo-translate
    showAll: 'Show all {count} reviews', // @todo-translate
    time: {
      today: 'Today', // @todo-translate
      yesterday: 'Yesterday', // @todo-translate
      daysAgo: plural({ one: '{count} day ago', other: '{count} days ago' }), // @todo-translate
      monthsAgo: plural({ one: '{count} month ago', other: '{count} months ago' }), // @todo-translate
      yearsAgo: plural({ one: '{count} year ago', other: '{count} years ago' }), // @todo-translate
    },
    mock: {
      text1: 'Absolutely magical place! The views were breathtaking and the host was incredibly welcoming. Every detail was perfect — from the cozy fireplace to the fresh mountain air.', // @todo-translate
      text2: 'Perfect getaway spot. Very clean, well-equipped, and the location is ideal for exploring the surrounding area. We loved every minute of our stay.', // @todo-translate
      text3: 'Beautiful cottage with authentic Georgian charm. Highly recommend for a peaceful retreat. The local food recommendations from the host were a bonus!', // @todo-translate
      text4: 'Exceeded our expectations in every way. The photos don\'t do it justice — even more beautiful in person. Will definitely be back next summer!', // @todo-translate
    },
  },
  search: {
    seo: {
      title: 'Search Georgian Cottage Rentals — RentCottage.Ge', // @todo-translate
      titleWithLocation: 'Cottage Rentals in {location} — RentCottage.Ge', // @todo-translate
      description: 'Browse hundreds of verified Georgian cottages, mountain retreats and lakeside properties. Filter by location, price and amenities. Find your perfect cottage rental in Georgia.', // @todo-translate
      descriptionWithLocation: 'Browse verified Georgian cottage rentals in {location}. Filter by price, amenities and property type. Book authentic Georgian cottages and mountain retreats.', // @todo-translate
    },
    where: 'Where', // @todo-translate
    checkIn: 'Check-in', // @todo-translate
    checkOut: 'Check-out', // @todo-translate
    guestsLabel: 'Guests', // @todo-translate
    any: 'Any', // @todo-translate
    add: 'Add', // @todo-translate
    addDate: 'Add date', // @todo-translate
    addDates: 'Add dates', // @todo-translate
    inShort: 'In', // @todo-translate
    outShort: 'Out', // @todo-translate
    searchDestinations: 'Search destinations', // @todo-translate
    matchingDestinations: 'Matching destinations', // @todo-translate
    noDestinationsFound: 'No destinations found', // @todo-translate
    agesHint: 'Ages 13 or above', // @todo-translate
    searchDetails: 'Search Details', // @todo-translate
    filters: 'Filters', // @todo-translate
    clearAll: 'Clear all', // @todo-translate
    clearFilters: 'Clear Filters', // @todo-translate
    showResults: 'Show Results', // @todo-translate
    priceRange: 'Price Range', // @todo-translate
    amenities: 'Amenities', // @todo-translate
    propertyType: 'Property Type', // @todo-translate
    region: 'Region', // @todo-translate
    sortBy: 'Sort by:', // @todo-translate
    sortAlphabetical: 'Alphabetical (A–Z)', // @todo-translate
    sortPriceLow: 'Price: Low to High', // @todo-translate
    sortPriceHigh: 'Price: High to Low', // @todo-translate
    sortRating: 'Highest Rated', // @todo-translate
    sortReviews: 'Most Reviews', // @todo-translate
    allCottages: 'All Cottages', // @todo-translate
    categoryCottages: '{category} Cottages', // @todo-translate
    cottagesIn: 'Cottages in {location}', // @todo-translate
    cottagesInWithCategory: 'Cottages in {location} — {category}', // @todo-translate
    cottagesFound: plural({ one: '{count} cottage found', other: '{count} cottages found' }), // @todo-translate
    cottagesAvailable: plural({ one: '{count} cottage available', other: '{count} cottages available' }), // @todo-translate
    promoAppliedAtCheckout: 'Discount applied automatically at checkout on eligible cottages', // @todo-translate
    noCottagesFound: 'No cottages found', // @todo-translate
    noCategoryProperties: 'No {category} properties available right now.', // @todo-translate
    checkBackCategory: 'Check back soon — hosts with {category} properties will appear here once registered.', // @todo-translate
    tryAdjusting: 'Try adjusting your search criteria or filters to find more options.', // @todo-translate
    loadMore: 'Load More Cottages', // @todo-translate
    allLoaded: 'All cottages loaded', // @todo-translate
    destinations: {
      tbilisiDesc: 'Capital city with rich history', // @todo-translate
      batumiDesc: 'Black Sea coastal resort', // @todo-translate
      kutaisiDesc: 'Ancient city in western Georgia', // @todo-translate
      mtskhetaDesc: 'UNESCO World Heritage site', // @todo-translate
      sighnaghiDesc: 'City of Love in wine region', // @todo-translate
      gudauriDesc: 'Mountain ski resort', // @todo-translate
      borjomiDesc: 'Famous for mineral water springs', // @todo-translate
      telaviDesc: 'Heart of Kakheti wine region', // @todo-translate
      goriDesc: 'Historic city in central Georgia', // @todo-translate
      mestiaDesc: 'Gateway to Svaneti mountains', // @todo-translate
    },
    regions: {
      Adjara: 'Adjara', // @todo-translate
      Guria: 'Guria', // @todo-translate
      Imereti: 'Imereti', // @todo-translate
      Kakheti: 'Kakheti', // @todo-translate
      'Kvemo Kartli': 'Kvemo Kartli', // @todo-translate
      'Mtskheta-Mtianeti': 'Mtskheta-Mtianeti', // @todo-translate
      'Racha-Lechkhumi': 'Racha-Lechkhumi', // @todo-translate
      'Samegrelo-Zemo Svaneti': 'Samegrelo-Zemo Svaneti', // @todo-translate
      'Samtskhe-Javakheti': 'Samtskhe-Javakheti', // @todo-translate
      'Shida Kartli': 'Shida Kartli', // @todo-translate
      Svaneti: 'Svaneti', // @todo-translate
      Tbilisi: 'Tbilisi', // @todo-translate
    },
  },
  becomeHost: {
    seo: {
      title: 'Become a Host — List Your Georgian Cottage on RentCottage.Ge', // @todo-translate
    },
    hero: {
      title: 'Rent out your cottage and earn more', // @todo-translate
      subtitle: 'List for free, get bookings directly, and pay a commission only on successful stays', // @todo-translate
      badgeFreeListing: '✓ Free listing', // @todo-translate
      badgeSetPrice: '✓ You set the price', // @todo-translate
      badgeSupport: '✓ Support in Georgian', // @todo-translate
    },
    success: {
      title: 'Application Submitted!', // @todo-translate
      message: 'Thank you for your interest in becoming a host. Our team will review your application and contact you within 24 hours.', // @todo-translate
      submitAnother: 'Submit Another Application', // @todo-translate
    },
    validation: {
      heading: 'Please Complete Required Fields', // @todo-translate
      uploadPhotosPrompt: 'Please upload at least 3 photos of your cottage to continue.', // @todo-translate
      allRequired: 'All fields marked with * are required. Please fill out all required information to continue.', // @todo-translate
      completeCaptcha: 'Please complete the CAPTCHA before submitting.', // @todo-translate
      stepMissing: 'Step {step} missing: {fields}', // @todo-translate
      needPhotos: 'Step 3: need 3 photos, have {count}', // @todo-translate
      missingFields: 'Missing: {fields}', // @todo-translate
      fieldWithStep: '{field} (step {step})', // @todo-translate
      descriptionTooLong: 'Description too long (max 2000)', // @todo-translate
      photosHaveNeed: 'Photos (step 3) — have {count}, need 3', // @todo-translate
      serverRejected: 'Server rejected the submission (HTTP {status})', // @todo-translate
      networkError: 'Network error: {message}', // @todo-translate
    },
    fields: {
      propertyType: 'Property Type', // @todo-translate
      propertyCategories: 'Property Categories', // @todo-translate
      location: 'Location', // @todo-translate
      bedrooms: 'Bedrooms', // @todo-translate
      bathrooms: 'Bathrooms', // @todo-translate
      maxGuests: 'Max Guests', // @todo-translate
      propertyTitle: 'Property Title', // @todo-translate
      description: 'Description', // @todo-translate
      price: 'Price', // @todo-translate
      perGuestPrice: 'Per-guest price', // @todo-translate
      firstName: 'First Name', // @todo-translate
      lastName: 'Last Name', // @todo-translate
      email: 'Email Address', // @todo-translate
      phone: 'Phone Number', // @todo-translate
    },
    step1: {
      title: 'Tell us about your property', // @todo-translate
      selectAllThatApply: '(select all that apply)', // @todo-translate
      selected: 'Selected: {list}', // @todo-translate
      locationPlaceholder: 'Start typing a city name (e.g., Tbilisi, Batumi...)', // @todo-translate
    },
    step2: {
      title: 'What amenities do you offer?', // @todo-translate
    },
    step3: {
      title: 'Upload Photos of Your Cottage', // @todo-translate
      guidelinesTitle: 'Photo Guidelines', // @todo-translate
      guideline1: 'Upload at least 3 photos (maximum 10)', // @todo-translate
      guideline2: 'Include exterior, interior, and key amenity photos', // @todo-translate
      guideline3: 'Use high-quality images (max 15MB each)', // @todo-translate
      guideline4: 'Show your cottage in the best light', // @todo-translate
      photosLabel: 'Cottage Photos * (Minimum 3 required)', // @todo-translate
      uploadTitle: 'Upload Photos', // @todo-translate
      dragDrop: 'Drag and drop your photos here, or click to browse', // @todo-translate
      chooseFiles: 'Choose Files', // @todo-translate
      supportedFormats: 'Supported formats: JPG, PNG, GIF. Maximum file size: 15MB per image.', // @todo-translate
      uploadedPhotos: 'Uploaded Photos ({count}/10)', // @todo-translate
      photoAlt: 'Cottage photo {number}', // @todo-translate
      mainPhoto: 'Main', // @todo-translate
      tipsTitle: 'Photo Tips for Better Bookings', // @todo-translate
      mustHaveTitle: 'Must-Have Shots:', // @todo-translate
      mustHave1: 'Exterior front view', // @todo-translate
      mustHave2: 'Living room/main area', // @todo-translate
      mustHave3: 'All bedrooms', // @todo-translate
      mustHave4: 'Kitchen and dining area', // @todo-translate
      additionsTitle: 'Great Additions:', // @todo-translate
      addition1: 'Bathroom(s)', // @todo-translate
      addition2: 'Outdoor spaces/garden', // @todo-translate
      addition3: 'Special amenities', // @todo-translate
      addition4: 'Scenic views', // @todo-translate
    },
    step4: {
      title: 'Describe your property', // @todo-translate
      titlePlaceholder: 'Give your property a catchy title', // @todo-translate
      descriptionPlaceholder: 'Describe what makes your property special. Include details about the space, surroundings, nearby attractions, and what guests can expect...', // @todo-translate
      charCount: '{count}/2000 characters', // @todo-translate
      pricingModel: 'Pricing Model', // @todo-translate
      fixedPrice: 'Fixed Price', // @todo-translate
      fixedPriceDesc: 'One nightly rate for all guests, regardless of group size.', // @todo-translate
      fixedPriceBadge: 'Simple & consistent', // @todo-translate
      byGuestCount: 'By Guest Count', // @todo-translate
      byGuestCountDesc: 'Set different nightly prices per number of guests.', // @todo-translate
      byGuestCountBadge: 'Flexible pricing', // @todo-translate
      nightlyRate: 'Nightly Rate (₾)', // @todo-translate
      pricePlaceholder: 'e.g. 200', // @todo-translate
      fixedPriceNote: 'This rate applies to all bookings regardless of guest count.', // @todo-translate
      selectMaxGuestsFirst: 'Please select Max Guests in Step 1 first to set up per-guest pricing.', // @todo-translate
      perGuestInfo: 'Set a nightly price for each guest count. The system picks the right price automatically at booking.', // @todo-translate
      pricePerNight: 'Price per night', // @todo-translate
      perNight: '/ night', // @todo-translate
      acceptedPayments: 'Accepted Payment Methods', // @todo-translate
      acceptedPaymentsDesc: 'Choose how guests can pay for this cottage. You can change this later from your host dashboard.', // @todo-translate
      paymentBoth: 'Both', // @todo-translate
      paymentBothDesc: 'Guests choose online or pay at property.', // @todo-translate
      paymentOnline: 'Online only', // @todo-translate
      paymentOnlineDesc: 'Card payment only, guests pay when booking.', // @todo-translate
      paymentAtProperty: 'Pay at property only', // @todo-translate
      paymentAtPropertyDesc: 'Guests pay you on arrival.', // @todo-translate
    },
    step5: {
      title: 'Contact Information', // @todo-translate
      firstNamePlaceholder: 'Your first name', // @todo-translate
      lastNamePlaceholder: 'Your last name', // @todo-translate
      emailPlaceholder: 'your.email@example.com', // @todo-translate
      phonePlaceholder: '+995 xxx xxx xxx', // @todo-translate
      whatHappensNext: 'What happens next?', // @todo-translate
      next1: 'Our team will review your application within 24 hours', // @todo-translate
      next2: 'We\'ll schedule a property inspection at your convenience', // @todo-translate
      next3: 'Once approved, your listing goes live and you start earning', // @todo-translate
    },
    nav: {
      nextStep: 'Next Step', // @todo-translate
      submitApplication: 'Submit Application', // @todo-translate
    },
    benefits: {
      title: 'Why host with us?', // @todo-translate
      earnTitle: 'Earn Extra Income', // @todo-translate
      earnDesc: 'Turn your unused space into a profitable income stream with our competitive commission rates', // @todo-translate
      protectionTitle: 'Host Protection', // @todo-translate
      protectionDesc: 'We provide a secure booking platform and user verification to support safe stays', // @todo-translate
      supportTitle: 'Support Available All Week', // @todo-translate
      supportDesc: 'Our dedicated support team is always here to help you succeed as a host', // @todo-translate
    },
  },
  howItWorks: {
    seo: {
      title: 'How RentCottage.Ge Works — Book Georgian Cottages Easily', // @todo-translate
    },
    hero: {
      subtitle: 'Discover how easy it is to find your perfect Georgian cottage or become a successful host', // @todo-translate
      imageAlt: 'Georgian cottage in mountain valley', // @todo-translate
    },
    tabs: {
      guests: 'For Guests', // @todo-translate
      hosts: 'For Hosts', // @todo-translate
    },
    guests: {
      title: 'Your Journey to the Perfect Georgian Getaway', // @todo-translate
      subtitle: 'From search to checkout, we\'ve made finding and booking your ideal cottage simple and secure', // @todo-translate
      step1Title: 'Search & Discover', // @todo-translate
      step1Desc: 'Enter your destination, dates, and number of guests to find available cottages', // @todo-translate
      step1Detail1: 'Browse through hundreds of verified Georgian cottages', // @todo-translate
      step1Detail2: 'Use filters to find exactly what you\'re looking for', // @todo-translate
      step1Detail3: 'View detailed photos, amenities, and guest reviews', // @todo-translate
      step1Detail4: 'Compare prices and locations easily', // @todo-translate
      step2Title: 'Connect with Hosts', // @todo-translate
      step2Desc: 'Message hosts directly to ask questions and request bookings', // @todo-translate
      step2Detail1: 'Send booking requests with your travel details', // @todo-translate
      step2Detail2: 'Ask hosts about local recommendations and amenities', // @todo-translate
      step2Detail3: 'Get responses within 24 hours', // @todo-translate
      step2Detail4: 'Build confidence through direct communication', // @todo-translate
      step3Title: 'Secure Booking', // @todo-translate
      step3Desc: 'Complete your reservation with our secure payment system', // @todo-translate
      step3Detail1: 'Pay securely through our encrypted platform', // @todo-translate
      step3Detail2: 'Receive instant booking confirmation', // @todo-translate
      step3Detail3: 'Get detailed check-in instructions', // @todo-translate
      step3Detail4: 'Access 24/7 customer support during business hours', // @todo-translate
      step4Title: 'Enjoy Your Stay', // @todo-translate
      step4Desc: 'Arrive at your cottage and experience authentic Georgian hospitality', // @todo-translate
      step4Detail1: 'Easy check-in with clear instructions', // @todo-translate
      step4Detail2: 'Enjoy all listed amenities and local experiences', // @todo-translate
      step4Detail3: 'Get support from your host throughout your stay', // @todo-translate
      step4Detail4: 'Leave reviews to help future guests', // @todo-translate
      whyTitle: 'Why Choose RentCottage.Ge?', // @todo-translate
      benefit1Title: 'Verified Properties', // @todo-translate
      benefit1Desc: 'All cottages are inspected and verified by our team for quality and safety', // @todo-translate
      benefit2Title: 'Local Support', // @todo-translate
      benefit2Desc: 'Get help from our Georgian team who knows the country inside and out', // @todo-translate
      benefit3Title: 'Best Price Guarantee', // @todo-translate
      benefit3Desc: 'Find the same cottage cheaper elsewhere? We\'ll match the price', // @todo-translate
      cta: 'Start Your Search', // @todo-translate
    },
    hosts: {
      title: 'Your Path to Successful Hosting', // @todo-translate
      subtitle: 'Turn your Georgian cottage into a profitable business while sharing your culture with travelers', // @todo-translate
      step1Title: 'List Your Property', // @todo-translate
      step1Desc: 'Create a compelling listing that showcases your cottage\'s unique charm', // @todo-translate
      step1Detail1: 'Upload high-quality photos of your cottage', // @todo-translate
      step1Detail2: 'Write an engaging description highlighting unique features', // @todo-translate
      step1Detail3: 'Set competitive pricing for your area', // @todo-translate
      step1Detail4: 'List all amenities and nearby attractions', // @todo-translate
      step2Title: 'Get Verified', // @todo-translate
      step2Desc: 'Our team reviews and approves your listing to ensure quality standards', // @todo-translate
      step2Detail1: 'Complete identity verification process', // @todo-translate
      step2Detail2: 'Schedule property inspection with our team', // @todo-translate
      step2Detail3: 'Receive feedback and recommendations', // @todo-translate
      step2Detail4: 'Get approved and go live on the platform', // @todo-translate
      step3Title: 'Welcome Guests', // @todo-translate
      step3Desc: 'Start receiving bookings and providing exceptional hospitality', // @todo-translate
      step3Detail1: 'Respond to booking inquiries within 24 hours', // @todo-translate
      step3Detail2: 'Communicate with guests before and during their stay', // @todo-translate
      step3Detail3: 'Provide local recommendations and support', // @todo-translate
      step3Detail4: 'Maintain your property to high standards', // @todo-translate
      step4Title: 'Earn & Grow', // @todo-translate
      step4Desc: 'Build your reputation and increase your income through great reviews', // @todo-translate
      step4Detail1: 'Receive payments securely through our platform', // @todo-translate
      step4Detail2: 'Get reviews from satisfied guests', // @todo-translate
      step4Detail3: 'Access host resources and support', // @todo-translate
      step4Detail4: 'Expand your hosting business over time', // @todo-translate
      whyTitle: 'Why Host with Us?', // @todo-translate
      benefit1Title: 'Competitive Earnings', // @todo-translate
      benefit1Desc: 'Keep the majority of your booking revenue with our low commission rates', // @todo-translate
      benefit2Desc: 'Comprehensive insurance coverage and verified guest screening', // @todo-translate
      benefit3Title: 'Dedicated Support', // @todo-translate
      benefit3Desc: 'Get help from our host specialists during business hours', // @todo-translate
      cta: 'Start Hosting Today', // @todo-translate
    },
  },
  hostResources: {
    seo: {
      title: 'Host Resources — Tips & Guides for Georgian Cottage Hosts | RentCottage.Ge', // @todo-translate
    },
    hero: {
      subtitle: 'Everything you need to become a successful host and provide exceptional experiences for your guests', // @todo-translate
    },
    quickNav: {
      title: 'Quick Navigation', // @todo-translate
      gettingStarted: 'Getting Started', // @todo-translate
      listingTips: 'Listing Tips', // @todo-translate
      guestCommunication: 'Guest Communication', // @todo-translate
      safetyGuidelines: 'Safety Guidelines', // @todo-translate
    },
    gettingStarted: {
      title: 'Getting Started as a Host', // @todo-translate
      createListingTitle: 'Create Your Listing', // @todo-translate
      createListing2: 'Write a compelling property description', // @todo-translate
      createListing4: 'List all available amenities accurately', // @todo-translate
      verificationTitle: 'Verification Process', // @todo-translate
      verification1: 'Complete identity verification', // @todo-translate
      verification2: 'Property inspection by our team', // @todo-translate
      verification3: 'Review and approval process', // @todo-translate
      verification4: 'Go live and start receiving bookings', // @todo-translate
      proTipTitle: 'Pro Tip', // @todo-translate
      proTipText: 'Complete your listing with all details before submitting for review. Incomplete listings take longer to approve and may require additional back-and-forth communication.', // @todo-translate
    },
    listingTips: {
      title: 'Optimize Your Listing', // @todo-translate
      photographyTitle: 'Photography Best Practices', // @todo-translate
      photo1Title: 'Natural Lighting', // @todo-translate
      photo1Desc: 'Take photos during golden hour or with plenty of natural light. Avoid using flash when possible.', // @todo-translate
      photo2Title: 'Wide Angles', // @todo-translate
      photo2Desc: 'Use wide-angle shots to show the full space and make rooms appear larger and more inviting.', // @todo-translate
      photo3Title: 'Clean & Staged', // @todo-translate
      photo3Desc: 'Ensure spaces are clean, decluttered, and staged to look welcoming and comfortable.', // @todo-translate
      descriptionsTitle: 'Writing Compelling Descriptions', // @todo-translate
      desc1Title: 'Tell a Story', // @todo-translate
      desc1Desc: 'Share the unique history or special features that make your cottage memorable.', // @todo-translate
      desc2Title: 'Highlight Amenities', // @todo-translate
      desc2Desc: 'Mention key amenities and nearby attractions that guests will find valuable.', // @todo-translate
      desc3Title: 'Be Honest', // @todo-translate
      desc3Desc: 'Accurately describe your space to set proper expectations and avoid disappointment.', // @todo-translate
      pricingTitle: 'Pricing Strategy', // @todo-translate
      pricing1Title: 'Research Competition', // @todo-translate
      pricing1Desc: 'Check similar properties in your area to understand market rates and position competitively.', // @todo-translate
      pricing2Title: 'Seasonal Pricing', // @todo-translate
      pricing2Desc: 'Adjust rates for peak seasons, holidays, and local events to maximize revenue.', // @todo-translate
      pricing3Title: 'Value-Based Pricing', // @todo-translate
      pricing3Desc: 'Price based on unique amenities, location benefits, and overall guest experience value.', // @todo-translate
    },
    communication: {
      title: 'Guest Communication Excellence', // @todo-translate
      responseTimesTitle: 'Response Time Guidelines', // @todo-translate
      inquiriesTitle: 'Booking Inquiries', // @todo-translate
      inquiriesDesc: 'Initial guest questions', // @todo-translate
      inquiriesTime: 'Within 1 hour', // @todo-translate
      requestsTitle: 'Booking Requests', // @todo-translate
      requestsDesc: 'Accept or decline requests', // @todo-translate
      requestsTime: 'Within 24 hours', // @todo-translate
      messagesTitle: 'General Messages', // @todo-translate
      messagesDesc: 'Ongoing communication', // @todo-translate
      messagesTime: 'Within 4 hours', // @todo-translate
      templatesTitle: 'Communication Templates', // @todo-translate
      welcomeTitle: 'Welcome Message', // @todo-translate
      welcomeExample: '"Welcome to [Property Name]! I\'m excited to host you. Here\'s everything you need to know for check-in..."', // @todo-translate
      checkinTitle: 'Check-in Instructions', // @todo-translate
      checkinExample: '"Your check-in is at 3 PM. The key is located in the lockbox by the front door. The code is..."', // @todo-translate
      recommendationsTitle: 'Local Recommendations', // @todo-translate
      recommendationsExample: '"For the best Georgian cuisine, I recommend visiting [Restaurant Name]. It\'s just 10 minutes away..."', // @todo-translate
      relationshipsTitle: 'Building Guest Relationships', // @todo-translate
      beforeArrivalTitle: 'Before Arrival', // @todo-translate
      before1: 'Send welcome message with check-in details', // @todo-translate
      before2: 'Share local recommendations and tips', // @todo-translate
      before3: 'Provide emergency contact information', // @todo-translate
      duringStayTitle: 'During Stay', // @todo-translate
      during1: 'Check in within 24 hours of arrival', // @todo-translate
      during2: 'Be available for questions or issues', // @todo-translate
      during3: 'Respect guest privacy and space', // @todo-translate
    },
    safety: {
      title: 'Safety & Security Guidelines', // @todo-translate
      propertyTitle: 'Property Safety', // @todo-translate
      property1: 'Install smoke and carbon monoxide detectors', // @todo-translate
      property2: 'Provide fire extinguisher and first aid kit', // @todo-translate
      property3: 'Ensure all electrical systems are up to code', // @todo-translate
      property4: 'Secure all windows and doors properly', // @todo-translate
      guestVerificationTitle: 'Guest Verification', // @todo-translate
      guest1: 'Review guest profiles and previous reviews', // @todo-translate
      guest2: 'Communicate with guests before arrival', // @todo-translate
      guest3: 'Trust your instincts about bookings', // @todo-translate
      guest4: 'Keep records of all guest interactions', // @todo-translate
      emergencyTitle: 'Emergency Contacts', // @todo-translate
      police: 'Police', // @todo-translate
      ambulance: 'Ambulance', // @todo-translate
      fireDepartment: 'Fire Department', // @todo-translate
    },
    support: {
      title: 'Need More Help?', // @todo-translate
      subtitle: 'Our hosting support team is here to assist you', // @todo-translate
      contactTitle: 'Contact Support', // @todo-translate
      contactDesc: 'Get help with your hosting questions', // @todo-translate
      sendMessage: 'Send Message', // @todo-translate
      policyDesc: 'Learn about our host cancellation rules', // @todo-translate
      viewPolicy: 'View Policy', // @todo-translate
    },
  },
  aboutGeorgia: {
    seo: {
      title: 'About Georgia — Travel Guide to Georgian Culture, Wine & Landscapes | RentCottage.Ge', // @todo-translate
    },
    hero: {
      imageAlt: 'Greater Caucasus mountain range Georgia — open alpine valley', // @todo-translate
      title: 'Discover Georgia', // @todo-translate
      subtitle: 'A land where ancient traditions meet stunning natural beauty, offering unforgettable experiences at every turn', // @todo-translate
    },
    quickNav: {
      title: 'Explore Georgia', // @todo-translate
      culture: 'Culture & History', // @todo-translate
      nature: 'Natural Beauty', // @todo-translate
      cuisine: 'Cuisine & Wine', // @todo-translate
      regions: 'Regions to Visit', // @todo-translate
    },
    intro: {
      title: 'Welcome to Georgia', // @todo-translate
      p1: 'Nestled between Europe and Asia, Georgia is a country of extraordinary diversity and ancient heritage. From the snow-capped peaks of the Caucasus Mountains to the subtropical Black Sea coast, Georgia offers landscapes that will take your breath away.', // @todo-translate
      p2: 'With over 3,000 years of winemaking tradition, UNESCO World Heritage sites, and a culture of legendary hospitality, Georgia provides experiences that connect you with both nature and history in the most authentic way possible.', // @todo-translate
      statYearsLabel: 'Years of History', // @todo-translate
      statGrapesLabel: 'Native Grape Varieties', // @todo-translate
      imageAlt: 'Georgian hospitality', // @todo-translate
    },
    culture: {
      title: 'Rich Culture & Ancient History', // @todo-translate
      orthodoxyAlt: 'Georgian Orthodox Church', // @todo-translate
      orthodoxyTitle: 'Orthodox Christianity', // @todo-translate
      orthodoxyDesc: 'Georgia was one of the first countries to adopt Christianity as its state religion in 337 AD. Ancient churches and monasteries dot the landscape, each telling stories of faith and resilience.', // @todo-translate
      polyphonyAlt: 'Georgian Polyphonic Singing', // @todo-translate
      polyphonyTitle: 'Polyphonic Singing', // @todo-translate
      polyphonyDesc: 'Georgian polyphonic singing is recognized by UNESCO as a Masterpiece of Oral and Intangible Heritage. This ancient tradition creates hauntingly beautiful harmonies that echo through the mountains.', // @todo-translate
      danceAlt: 'Georgian Traditional Dance', // @todo-translate
      danceTitle: 'Traditional Dance', // @todo-translate
      danceDesc: 'Georgian dance is a spectacular display of athleticism and grace. From the warrior-like Khorumi to the elegant Kartuli, each dance tells a story of Georgian history and spirit.', // @todo-translate
      unescoTitle: 'UNESCO World Heritage Sites', // @todo-translate
      mtskhetaTitle: 'Mtskheta', // @todo-translate
      mtskhetaDesc: 'Ancient capital and spiritual heart of Georgia, home to Svetitskhoveli Cathedral', // @todo-translate
      svanetiTitle: 'Upper Svaneti', // @todo-translate
      svanetiDesc: 'Medieval villages with distinctive stone towers in the Caucasus Mountains', // @todo-translate
      colchicTitle: 'Colchic Rainforests', // @todo-translate
      colchicDesc: 'Ancient temperate rainforests along the Black Sea coast', // @todo-translate
    },
    nature: {
      title: 'Spectacular Natural Beauty', // @todo-translate
      caucasusTitle: 'Caucasus Mountains', // @todo-translate
      caucasusDesc: 'The Greater Caucasus range forms Georgia\'s northern border, offering some of Europe\'s most pristine wilderness. From the glacial peaks of Kazbegi to the alpine meadows of Tusheti, these mountains provide endless opportunities for hiking, mountaineering, and connecting with nature.', // @todo-translate
      blackSeaTitle: 'Black Sea Coast', // @todo-translate
      blackSeaDesc: 'Georgia\'s 310-kilometer Black Sea coastline features a subtropical climate with lush vegetation, beautiful beaches, and charming coastal towns. From the vibrant city of Batumi to the ancient fortress of Gonio, the coast offers a perfect blend of relaxation and exploration.', // @todo-translate
      peaksTitle: 'Mountain Peaks', // @todo-translate
      peaksDesc: '5,047m Shkhara - highest peak in Georgia', // @todo-translate
      springsTitle: 'Mineral Springs', // @todo-translate
      springsDesc: '2,000+ natural hot and cold springs', // @todo-translate
      protectedTitle: 'Protected Areas', // @todo-translate
      protectedDesc: '20% of territory under protection', // @todo-translate
      climateTitle: 'Climate Zones', // @todo-translate
      climateDesc: 'From subtropical to alpine climates', // @todo-translate
    },
    cuisine: {
      title: 'World-Renowned Cuisine & Wine', // @todo-translate
      culinaryTitle: 'Culinary Traditions', // @todo-translate
      culinaryDesc: 'Georgian cuisine is a unique fusion of European and Asian influences, featuring fresh herbs, bold spices, and time-honored cooking techniques. Every meal is a celebration, often accompanied by heartfelt toasts and traditional songs.', // @todo-translate
      khachapuriName: 'Khachapuri', // @todo-translate
      khachapuriDesc: 'Cheese-filled bread, Georgia\'s national dish', // @todo-translate
      khinkaliName: 'Khinkali', // @todo-translate
      khinkaliDesc: 'Soup dumplings with meat or cheese filling', // @todo-translate
      mtsvadiName: 'Mtsvadi', // @todo-translate
      mtsvadiDesc: 'Grilled meat skewers with Georgian spices', // @todo-translate
      churchkhelaName: 'Churchkhela', // @todo-translate
      churchkhelaDesc: 'Traditional candy made with grape juice and nuts', // @todo-translate
      imageAlt: 'Georgian Cuisine', // @todo-translate
      wineTitle: 'The Cradle of Wine', // @todo-translate
      wineHistoryAlt: 'Qvevri Wine Making', // @todo-translate
      wineHistoryTitle: '8,000 Years of Winemaking', // @todo-translate
      wineHistoryDesc: 'Archaeological evidence shows Georgia has been making wine for over 8,000 years, making it the birthplace of wine.', // @todo-translate
      wineGrapesAlt: 'Georgian Vineyards', // @todo-translate
      wineGrapesTitle: '525 Native Grape Varieties', // @todo-translate
      wineGrapesDesc: 'Georgia has more indigenous grape varieties than any other country, creating unique wines found nowhere else.', // @todo-translate
      wineUnescoAlt: 'Wine Tasting', // @todo-translate
      wineUnescoTitle: 'UNESCO Heritage Method', // @todo-translate
      wineUnescoDesc: 'The traditional qvevri winemaking method is recognized by UNESCO as an Intangible Cultural Heritage.', // @todo-translate
    },
    regions: {
      title: 'Regions to Explore', // @todo-translate
      highlightsLabel: 'Must-See Highlights:', // @todo-translate
      kakhetiName: 'Kakheti', // @todo-translate
      kakhetiDesc: 'Georgia\'s premier wine region with rolling vineyards and historic towns', // @todo-translate
      kakhetiH1: 'Sighnaghi - City of Love', // @todo-translate
      kakhetiH2: 'Bodbe Monastery', // @todo-translate
      kakhetiH3: 'Wine tastings', // @todo-translate
      kakhetiH4: 'Alazani Valley', // @todo-translate
      svanetiName: 'Svaneti', // @todo-translate
      svanetiDesc: 'Medieval mountain region with distinctive stone towers and pristine nature', // @todo-translate
      svanetiH1: 'Mestia town', // @todo-translate
      svanetiH2: 'Ushguli village', // @todo-translate
      svanetiH3: 'Svan towers', // @todo-translate
      svanetiH4: 'Hiking trails', // @todo-translate
      adjaraName: 'Adjara', // @todo-translate
      adjaraDesc: 'Subtropical coastal region with beaches, mountains, and unique culture', // @todo-translate
      adjaraH1: 'Batumi city', // @todo-translate
      adjaraH2: 'Black Sea beaches', // @todo-translate
      adjaraH3: 'Botanical Garden', // @todo-translate
      adjaraH4: 'Mountain villages', // @todo-translate
      samtskheName: 'Samtskhe-Javakheti', // @todo-translate
      samtskheDesc: 'Historic region with ancient fortresses and volcanic landscapes', // @todo-translate
      samtskheH1: 'Vardzia cave city', // @todo-translate
      samtskheH2: 'Rabati Castle', // @todo-translate
      samtskheH3: 'Javakheti Plateau', // @todo-translate
      samtskheH4: 'Borjomi springs', // @todo-translate
      mtianetiName: 'Mtskheta-Mtianeti', // @todo-translate
      mtianetiDesc: 'Ancient capital region with UNESCO sites and mountain adventures', // @todo-translate
      mtianetiH1: 'Mtskheta city', // @todo-translate
      mtianetiH2: 'Jvari Monastery', // @todo-translate
      mtianetiH3: 'Kazbegi National Park', // @todo-translate
      mtianetiH4: 'Gergeti Trinity', // @todo-translate
      imeretiName: 'Imereti', // @todo-translate
      imeretiDesc: 'Central region known for caves, canyons, and cultural treasures', // @todo-translate
      imeretiH1: 'Kutaisi city', // @todo-translate
      imeretiH2: 'Prometheus Cave', // @todo-translate
      imeretiH3: 'Gelati Monastery', // @todo-translate
      imeretiH4: 'Okatse Canyon', // @todo-translate
    },
    tips: {
      title: 'Essential Travel Information', // @todo-translate
      bestTimeTitle: 'Best Time to Visit', // @todo-translate
      bestTimeDesc: 'May-October for hiking, December-March for skiing, year-round for wine tours', // @todo-translate
      currencyTitle: 'Currency', // @todo-translate
      currencyDesc: 'Georgian Lari (GEL). Credit cards widely accepted in cities', // @todo-translate
      languageTitle: 'Language', // @todo-translate
      languageDesc: 'Georgian (official), Russian and English widely spoken in tourist areas', // @todo-translate
      visaTitle: 'Visa Requirements', // @todo-translate
      visaDesc: 'Visa-free for 95+ countries. Check requirements for your nationality', // @todo-translate
    },
    cta: {
      title: 'Ready to Experience Georgia?', // @todo-translate
      subtitle: 'Discover the magic of Georgia by staying in authentic cottages that connect you with local culture and stunning landscapes', // @todo-translate
      button: 'Find Your Georgian Cottage', // @todo-translate
    },
  },
  terms: {
    seo: {
      title: 'Terms & Conditions — RentCottage.Ge', // @todo-translate
    },
    heroAlt: 'Georgian mountain cottage', // @todo-translate
    contents: 'Contents', // @todo-translate
    s1Title: 'Introduction', // @todo-translate
    s1P1: 'Welcome to rentcottage.ge.', // @todo-translate
    s1P2: 'RentCottage.ge belongs to Lux Export LLC "ID 425368434".', // @todo-translate
    s1P3: 'These Terms & Conditions govern your access to and use of the platform, including booking accommodations and listing properties.', // @todo-translate
    s1P4: 'By using this website, you agree to these Terms.', // @todo-translate
    s2Title: 'Platform Description', // @todo-translate
    s2P1: 'rentcottage.ge is an online marketplace that connects:', // @todo-translate
    s2GuestsTerm: 'Guests', // @todo-translate
    s2GuestsDef: '(users who book cottages)', // @todo-translate
    s2HostsTerm: 'Hosts', // @todo-translate
    s2HostsDef: '(property owners who list cottages)', // @todo-translate
    s2P2: 'We act solely as an intermediary and do not own or operate the listed properties.', // @todo-translate
    s3Title: 'User Accounts', // @todo-translate
    s3Intro: 'Users must:', // @todo-translate
    s3Li1: 'provide accurate and complete information', // @todo-translate
    s3Li2: 'use a valid email address and phone number', // @todo-translate
    s3Li3: 'maintain the confidentiality of their account credentials', // @todo-translate
    s3P2: 'We reserve the right to suspend or terminate accounts that provide false information or violate these Terms.', // @todo-translate
    s4Title: 'Booking Process', // @todo-translate
    s4Li1: 'Guests can submit booking requests through the platform', // @todo-translate
    s4Li2: 'Bookings may require host approval or be automatically confirmed', // @todo-translate
    s4Li3: 'A booking is confirmed only after:', // @todo-translate
    s4Li3a: 'host approval, or', // @todo-translate
    s4Li3b: 'successful payment (if applicable)', // @todo-translate
    s4P1: 'Users must ensure that all booking details are accurate.', // @todo-translate
    s5Title: 'Payments', // @todo-translate
    s5P1: 'The platform may support:', // @todo-translate
    s5PayAtPropertyTerm: 'Pay at Property', // @todo-translate
    s5PayAtPropertyDef: '(payment made directly to the host)', // @todo-translate
    s5OnlineTerm: 'Online Payments', // @todo-translate
    s5OnlineDef: '(processed via third-party providers)', // @todo-translate
    s5ImportantLabel: 'Important:', // @todo-translate
    s5ImportantLi1: 'rentcottage.ge does not store card details', // @todo-translate
    s5ImportantLi2: 'Payments are processed securely via external providers (e.g. Bank of Georgia)', // @todo-translate
    s5P2: 'The platform may hold and transfer payments according to its internal payment processing and settlement rules.', // @todo-translate
    s6Title: 'Cancellation Policy', // @todo-translate
    s6P1: 'Cancellation terms depend on the selected policy:', // @todo-translate
    s6FlexibleTitle: 'Flexible', // @todo-translate
    s6FlexibleDesc: 'Full refund if cancelled at least 2 days before check-in', // @todo-translate
    s6ModerateTitle: 'Moderate', // @todo-translate
    s6ModerateDesc: 'Partial refund depending on cancellation timing', // @todo-translate
    s6StrictTitle: 'Strict', // @todo-translate
    s6StrictDesc: 'Limited or no refund depending on timing', // @todo-translate
    s6NoteLabel: 'Note:', // @todo-translate
    s6NoteLi1: 'Some policies apply only to online payments', // @todo-translate
    s6NoteLi2: 'Final refund handling may depend on host policy and payment method', // @todo-translate
    s7Title: 'Host Responsibilities', // @todo-translate
    s7MustIntro: 'Hosts must:', // @todo-translate
    s7MustLi1: 'provide accurate descriptions and photos', // @todo-translate
    s7MustLi2: 'keep availability updated', // @todo-translate
    s7MustLi3: 'honor confirmed bookings', // @todo-translate
    s7MustLi4: 'maintain acceptable property standards', // @todo-translate
    s7NotAllowedIntro: 'Hosts are not allowed to:', // @todo-translate
    s7NotLi1: 'include personal contact details in listings', // @todo-translate
    s7NotLi2: 'attempt to bypass the platform for bookings', // @todo-translate
    s7P1: 'Hosts agree to comply with the platform\'s commission structure and payment terms as defined in separate agreements.', // @todo-translate
    s7P2: 'We may hide or remove listings that violate these rules.', // @todo-translate
    s8Title: 'Guest Responsibilities', // @todo-translate
    s8Intro: 'Guests must:', // @todo-translate
    s8Li1: 'respect host rules and property conditions', // @todo-translate
    s8Li2: 'avoid causing damage', // @todo-translate
    s8Li3: 'provide accurate booking information', // @todo-translate
    s9Title: 'Prohibited Activities', // @todo-translate
    s9Intro: 'Users must NOT:', // @todo-translate
    s9Li1: 'share contact details (phone, email, social media) to bypass the platform', // @todo-translate
    s9Li2: 'engage in fraudulent or illegal activities', // @todo-translate
    s9Li3: 'manipulate bookings or reviews', // @todo-translate
    s9Li4: 'upload harmful, misleading, or inappropriate content', // @todo-translate
    s9P1: 'Violation may result in account suspension or removal.', // @todo-translate
    s10Title: 'Reviews', // @todo-translate
    s10P1: 'Guests may leave reviews after completed stays.', // @todo-translate
    s10MustIntro: 'Reviews must:', // @todo-translate
    s10MustLi1: 'be honest and respectful', // @todo-translate
    s10RemoveIntro: 'We reserve the right to remove:', // @todo-translate
    s10RemoveLi1: 'fake content', // @todo-translate
    s10RemoveLi2: 'abusive content', // @todo-translate
    s10RemoveLi3: 'misleading content', // @todo-translate
    s11Title: 'Platform Fees', // @todo-translate
    s11P1: 'Platform service fees (if applicable) are included in the displayed price.', // @todo-translate
    s11P2: 'Hosts may be subject to commission agreements as defined separately.', // @todo-translate
    s12Title: 'Limitation of Liability', // @todo-translate
    s12Intro: 'rentcottage.ge:', // @todo-translate
    s12Li1: 'is not responsible for actions of hosts or guests', // @todo-translate
    s12Li2: 'is not liable for damages, losses, or disputes between users', // @todo-translate
    s13Title: 'Availability of Service', // @todo-translate
    s13Intro: 'We aim to keep the platform available and functional, but:', // @todo-translate
    s13Li1: 'we do not guarantee uninterrupted access', // @todo-translate
    s13Li2: 'features may be modified or updated at any time', // @todo-translate
    s14Title: 'Data & Privacy', // @todo-translate
    s14P1: 'Use of the platform is subject to our', // @todo-translate
    s15Title: 'Changes to Terms', // @todo-translate
    s15P1: 'We reserve the right to update these Terms at any time.', // @todo-translate
    s15P2: 'Continued use of the platform constitutes acceptance of the updated Terms.', // @todo-translate
    s16Title: 'Contact', // @todo-translate
    s16P1: 'For questions or support:', // @todo-translate
    questionsTitle: 'Questions about these Terms?', // @todo-translate
    questionsDesc: 'If you have any questions or concerns about these Terms & Conditions, don\'t hesitate to reach out — we\'re happy to help.', // @todo-translate
  },
  privacy: {
    title: 'Privacy Policy', // @todo-translate
    seo: {
      title: 'Privacy Policy — RentCottage.Ge', // @todo-translate
    },
    heroAlt: 'Georgian mountain valley', // @todo-translate
    s1Title: '1. Information We Collect', // @todo-translate
    s1PersonalTitle: 'Personal Information', // @todo-translate
    s1PersonalIntro: 'When you use RentCottage.Ge, we may collect the following personal information:', // @todo-translate
    s1PersonalLi1: 'Name, email address, and phone number', // @todo-translate
    s1PersonalLi2: 'Profile information and photos', // @todo-translate
    s1PersonalLi3: 'Payment information (processed securely through third-party providers)', // @todo-translate
    s1PersonalLi4: 'Government-issued ID for verification purposes', // @todo-translate
    s1PersonalLi5: 'Communication preferences', // @todo-translate
    s1UsageTitle: 'Usage Information', // @todo-translate
    s1UsageIntro: 'We automatically collect information about how you use our platform:', // @todo-translate
    s1UsageLi1: 'Device information (IP address, browser type, operating system)', // @todo-translate
    s1UsageLi2: 'Usage patterns and preferences', // @todo-translate
    s1UsageLi3: 'Location data (with your permission)', // @todo-translate
    s1UsageLi4: 'Cookies and similar tracking technologies', // @todo-translate
    s2Title: '2. How We Use Your Information', // @todo-translate
    s2Intro: 'We use your information to:', // @todo-translate
    s2Li1: 'Provide and improve our cottage rental services', // @todo-translate
    s2Li2: 'Process bookings and payments', // @todo-translate
    s2Li3: 'Communicate with you about your reservations', // @todo-translate
    s2Li4: 'Verify your identity and prevent fraud', // @todo-translate
    s2Li5: 'Send you marketing communications (with your consent)', // @todo-translate
    s2Li6: 'Comply with legal obligations', // @todo-translate
    s2Li7: 'Resolve disputes and provide customer support', // @todo-translate
    s3Title: '3. Information Sharing', // @todo-translate
    s3Intro: 'We may share your information with:', // @todo-translate
    s3HostsGuestsTitle: 'Hosts and Guests', // @todo-translate
    s3HostsGuestsBody: 'When you make or receive a booking, we share necessary information to facilitate the transaction, including contact details and booking information.', // @todo-translate
    s3ProvidersTitle: 'Service Providers', // @todo-translate
    s3ProvidersIntro: 'We work with trusted third-party service providers who help us operate our platform, including:', // @todo-translate
    s3ProvidersLi1: 'Payment processors', // @todo-translate
    s3ProvidersLi2: 'Identity verification services', // @todo-translate
    s3ProvidersLi3: 'Customer support tools', // @todo-translate
    s3ProvidersLi4: 'Analytics providers', // @todo-translate
    s3LegalTitle: 'Legal Requirements', // @todo-translate
    s3LegalBody: 'We may disclose your information when required by law or to protect our rights and safety.', // @todo-translate
    s4Title: '4. Data Security', // @todo-translate
    s4Intro: 'We implement appropriate security measures to protect your personal information:', // @todo-translate
    s4Li1: 'Encryption of sensitive data in transit and at rest', // @todo-translate
    s4Li2: 'Regular security assessments and updates', // @todo-translate
    s4Li3: 'Limited access to personal information on a need-to-know basis', // @todo-translate
    s4Li4: 'Secure payment processing through certified providers', // @todo-translate
    s4Outro: 'However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.', // @todo-translate
    s5Title: '5. Your Rights and Choices', // @todo-translate
    s5Intro: 'You have the following rights regarding your personal information:', // @todo-translate
    s5AccessTitle: 'Access and Correction', // @todo-translate
    s5AccessBody: 'You can access and update your personal information through your account settings.', // @todo-translate
    s5PortabilityTitle: 'Data Portability', // @todo-translate
    s5PortabilityBody: 'You can request a copy of your personal data in a structured, machine-readable format.', // @todo-translate
    s5DeletionTitle: 'Deletion', // @todo-translate
    s5DeletionBody: 'You can request deletion of your personal information, subject to certain legal and operational requirements.', // @todo-translate
    s5MarketingTitle: 'Marketing Communications', // @todo-translate
    s5MarketingBody: 'You can opt out of marketing communications at any time by following the unsubscribe instructions in our emails.', // @todo-translate
    s6Title: '6. Cookies and Tracking', // @todo-translate
    s6Intro: 'We use cookies and similar technologies to:', // @todo-translate
    s6Li1: 'Remember your preferences and settings', // @todo-translate
    s6Li2: 'Analyze website traffic and usage patterns', // @todo-translate
    s6Li3: 'Provide personalized content and advertisements', // @todo-translate
    s6Li4: 'Improve our services and user experience', // @todo-translate
    s6Outro: 'You can control cookie settings through your browser preferences, but disabling cookies may affect website functionality.', // @todo-translate
    s7Title: '7. International Data Transfers', // @todo-translate
    s7Body: 'Our information may be transferred to and processed in countries other than Georgia. We ensure appropriate safeguards are in place to protect your data during international transfers.', // @todo-translate
    s8Title: '8. Data Retention', // @todo-translate
    s8Intro: 'We retain your personal information for as long as necessary to:', // @todo-translate
    s8Li1: 'Provide our services to you', // @todo-translate
    s8Li3: 'Resolve disputes and enforce agreements', // @todo-translate
    s8Li4: 'Improve our services', // @todo-translate
    s8Outro: 'When we no longer need your information, we will securely delete or anonymize it.', // @todo-translate
    s9Title: '9. Children\'s Privacy', // @todo-translate
    s9Body: 'Our services are not intended for children under 18 years of age. We do not knowingly collect personal information from children under 18. If we become aware that we have collected personal information from a child under 18, we will take steps to delete such information.', // @todo-translate
    s10Title: '10. Changes to This Policy', // @todo-translate
    s10Intro: 'We may update this Privacy Policy from time to time. We will notify you of any material changes by:', // @todo-translate
    s10Li1: 'Posting the updated policy on our website', // @todo-translate
    s10Li2: 'Sending you an email notification', // @todo-translate
    s10Li3: 'Displaying a prominent notice on our platform', // @todo-translate
    s10Outro: 'Your continued use of our services after any changes indicates your acceptance of the updated policy.', // @todo-translate
    s11Title: '11. Contact Us', // @todo-translate
    s11Intro: 'If you have any questions about this Privacy Policy or our data practices, please contact us:', // @todo-translate
    matterTitle: 'Your Privacy Matters', // @todo-translate
    matterBody: 'We are committed to protecting your privacy and being transparent about how we use your information. If you have any concerns or questions, please don\'t hesitate to contact us.', // @todo-translate
  },
  sitemap: {
    seo: {
      title: 'Site Map — RentCottage.Ge', // @todo-translate
    },
    heroAlt: 'Georgian mountain landscape', // @todo-translate
    heroSubtitle: 'Navigate through all pages and sections of RentCottage.Ge', // @todo-translate
    catMain: 'Main Pages', // @todo-translate
    catAccount: 'User Account', // @todo-translate
    catHost: 'Host Information', // @todo-translate
    catAbout: 'About & Information', // @todo-translate
    catLegal: 'Legal & Support', // @todo-translate
    homeDesc: 'Discover Georgian cottages and experiences', // @todo-translate
    searchTitle: 'Search Results', // @todo-translate
    searchDesc: 'Browse and filter available cottages', // @todo-translate
    propertyTitle: 'Property Details', // @todo-translate
    propertyDesc: 'View detailed cottage information and book', // @todo-translate
    profileTitle: 'Profile', // @todo-translate
    profileDesc: 'Manage your account and bookings', // @todo-translate
    becomeHostDesc: 'Start hosting your property', // @todo-translate
    hostResourcesDesc: 'Guides and tools for hosts', // @todo-translate
    howItWorksDesc: 'Learn how our platform works', // @todo-translate
    aboutGeorgiaDesc: 'Discover Georgian culture and destinations', // @todo-translate
    privacyDesc: 'Our privacy and data protection policy', // @todo-translate
    termsDesc: 'Terms and conditions for using the platform', // @todo-translate
    quickNavTitle: 'Quick Navigation', // @todo-translate
    quickNavSubtitle: 'Jump directly to the most popular sections of our website', // @todo-translate
    becomeHostShort: 'Become Host', // @todo-translate
    helpTitle: 'Need Help Finding Something?', // @todo-translate
    helpBody: 'If you can\'t find what you\'re looking for, our support team is here to help during business hours.', // @todo-translate
  },
};

export default fr;
