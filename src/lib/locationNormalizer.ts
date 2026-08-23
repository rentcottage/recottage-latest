/**
 * Bilingual location normalizer — Georgian ↔ English
 *
 * Strategy:
 * 1. A comprehensive EN_TO_KA dictionary covers every city/village in georgianCities
 * 2. A reverse KA_TO_EN map is auto-built from EN_TO_KA
 * 3. REGION_ALIASES maps every region to all its English + Georgian name variants
 * 4. getSearchTokens() expands any query into all equivalent forms in both scripts
 * 5. locationMatches() uses those tokens for robust bilingual city matching
 * 6. regionMatches() uses REGION_ALIASES for robust bilingual region matching
 * 7. filterCitiesBilingual() powers autocomplete suggestions bilingually
 */

/**
 * All name variants (English + Georgian) for each Georgian region.
 * Used by regionMatches() so filtering by any variant finds all properties
 * whose location string contains any other variant of the same region.
 */
export const REGION_ALIASES: Record<string, string[]> = {
  adjara: [
    'adjara', 'adzharia', 'achara',
    'აჭარა',
  ],
  guria: [
    'guria',
    'გურია',
  ],
  imereti: [
    'imereti', 'imeretia',
    'იმერეთი',
  ],
  kakheti: [
    'kakheti', 'kakhetia',
    'კახეთი',
  ],
  'kvemo kartli': [
    'kvemo kartli', 'lower kartli',
    'ქვემო ქართლი',
  ],
  'shida kartli': [
    'shida kartli', 'inner kartli',
    'შიდა ქართლი',
  ],
  'mtskheta-mtianeti': [
    'mtskheta-mtianeti', 'mtskheta mtianeti',
    'მცხეთა-მთიანეთი', 'მცხეთა მთიანეთი',
  ],
  'samtskhe-javakheti': [
    'samtskhe-javakheti', 'samtskhe javakheti',
    'სამცხე-ჯავახეთი', 'სამცხე ჯავახეთი',
  ],
  'samegrelo-zemo svaneti': [
    'samegrelo-zemo svaneti', 'samegrelo zemo svaneti',
    'samegrelo', 'zemo svaneti', 'upper svaneti',
    'სამეგრელო-ზემო სვანეთი', 'სამეგრელო ზემო სვანეთი',
    'სამეგრელო', 'ზემო სვანეთი',
  ],
  'racha-lechkhumi': [
    'racha-lechkhumi', 'racha lechkhumi', 'racha',
    'რაჭა-ლეჩხუმი', 'რაჭა ლეჩხუმი', 'რაჭა',
  ],
  tbilisi: [
    'tbilisi', 'tiflis',
    'თბილისი',
  ],
  svaneti: [
    'svaneti', 'svans', 'zemo svaneti', 'upper svaneti',
    'სვანეთი', 'ზემო სვანეთი',
  ],
  tusheti: [
    'tusheti',
    'თუშეთი',
  ],
  khevsureti: [
    'khevsureti',
    'ხევსურეთი',
  ],
  pshavi: [
    'pshavi',
    'ფშავი',
  ],
  abkhazia: [
    'abkhazia', 'abkhazeti',
    'აფხაზეთი',
  ],
};

/** Map of canonical English name (lowercase) → Georgian script equivalents */
export const EN_TO_KA: Record<string, string[]> = {
  // ── REGIONS ──────────────────────────────────────────────────────────────
  tbilisi: ['თბილისი'],
  adjara: ['აჭარა'],
  guria: ['გურია'],
  imereti: ['იმერეთი'],
  kakheti: ['კახეთი'],
  'kvemo kartli': ['ქვემო ქართლი'],
  'shida kartli': ['შიდა ქართლი'],
  'mtskheta-mtianeti': ['მცხეთა-მთიანეთი'],
  'samtskhe-javakheti': ['სამცხე-ჯავახეთი'],
  'samegrelo-zemo svaneti': ['სამეგრელო-ზემო სვანეთი'],
  'racha-lechkhumi': ['რაჭა-ლეჩხუმი'],
  svaneti: ['სვანეთი'],
  'zemo svaneti': ['ზემო სვანეთი'],
  'kvemo svaneti': ['ქვემო სვანეთი'],
  abkhazia: ['აფხაზეთი'],
  racha: ['რაჭა'],
  lechkhumi: ['ლეჩხუმი'],
  samegrelo: ['სამეგრელო'],
  samtskhe: ['სამცხე'],
  javakheti: ['ჯავახეთი'],
  kartli: ['ქართლი'],
  mtianeti: ['მთიანეთი'],

  // ── TBILISI DISTRICTS ─────────────────────────────────────────────────────
  'didi dighomi': ['დიდი დიღომი'],
  gldani: ['გლდანი'],
  isani: ['ისანი'],
  krtsanisi: ['კრწანისი'],
  mtatsminda: ['მთაწმინდა'],
  nadzaladevi: ['ნაძალადევი'],
  saburtalo: ['საბურთალო'],
  samgori: ['სამგორი'],
  vake: ['ვაკე'],
  didube: ['დიდუბე'],
  chugureti: ['ჩუღურეთი'],
  avlabari: ['ავლაბარი'],
  ortachala: ['ორთაჭალა'],
  marjanishvili: ['მარჯანიშვილი'],
  vera: ['ვერა'],
  digomi: ['დიღომი'],
  lisi: ['ლისი'],
  tsavkisi: ['წავკისი'],

  // ── ADJARA ───────────────────────────────────────────────────────────────
  batumi: ['ბათუმი'],
  kobuleti: ['ქობულეთი', 'კობულეთი'], // ქობულეთი is the correct spelling; კ… kept for legacy data
  chakvi: ['ჩაქვი'],
  sarpi: ['სარფი'],
  gonio: ['გონიო'],
  kvariati: ['კვარიათი'],
  makhinjauri: ['მახინჯაური'],
  makhunjauri: ['მახინჯაური'],
  tsikhisdziri: ['ციხისძირი'],
  ureki: ['ურეკი'],
  shuakhevi: ['შუახევი'],
  khulo: ['ხულო'],
  keda: ['ქედა'],
  qeda: ['ქედა'],
  mtirala: ['მტირალა'],
  kintrishi: ['კინტრიში'],
  didachara: ['დიდაჭარა'],
  kapandari: ['კაფანდარი'],
  khikhadziri: ['ხიხაძირი'],
  beshumi: ['ბეშუმი'],
  goderdzi: ['გოდერძი'],
  'goderdzi pass': ['გოდერძის უღელტეხილი'],
  damia: ['დამია'],
  'zeda shuakhevi': ['ზედა შუახევი'],
  chokhatauri: ['ჩოხატაური'],
  natanebi: ['ნატანები'],
  tago: ['თაგო'],
  dandalo: ['დანდალო'],
  zendidi: ['ზენდიდი'],
  khelvachauri: ['ხელვაჩაური'],
  khikhani: ['ხიხანი'],
  maltakva: ['მალთაყვა'],
  'kobuleti beach': ['კობულეთის სანაპირო'],
  'green cape': ['მწვანე კონცხი'],
  'batumi botanical garden area': ['ბათუმის ბოტანიკური ბაღი'],
  'shuakhevi pass': ['შუახევის უღელტეხილი'],

  // ── GURIA ─────────────────────────────────────────────────────────────────
  ozurgeti: ['ოზურგეთი'],
  lanchkhuti: ['ლანჩხუთი'],
  shemokmedi: ['შემოქმედი'],
  bakhvi: ['ბახვი'],
  nasakirali: ['ნასაკირალი'],
  shroma: ['შრომა'],
  likhauri: ['ლიხაური'],
  supsa: ['სუფსა'],
  askana: ['ასკანა'],
  achandara: ['აჩანდარა'],
  nigoiti: ['ნიგოითი'],
  bakhiskhevi: ['ბახისხევი'],
  laituri: ['ლაითური'],
  makvaneti: ['მაქვანეთი'],
  jvari: ['ჯვარი'],
  gomismta: ['გომისმთა'],
  naruja: ['ნარუჯა'],
  dioknisi: ['დიოკნისი'],
  gomi: ['გომი'],
  zoti: ['ზოტი'],
  'guria region': ['გურიის რეგიონი'],

  // ── IMERETI ───────────────────────────────────────────────────────────────
  kutaisi: ['ქუთაისი'],
  zestaponi: ['ზესტაფონი'],
  chiatura: ['ჭიათურა'],
  tkibuli: ['ტყიბული'],
  samtredia: ['სამტრედია'],
  sachkhere: ['საჩხერე'],
  baghdati: ['ბაღდათი'],
  vani: ['ვანი'],
  khoni: ['ხონი'],
  terjola: ['თერჯოლა'],
  'zeda gordi': ['ზედა გორდი'],
  shorapani: ['შორაფანი'],
  sviri: ['სვირი'],
  chumateleti: ['ჩუმათელეთი'],
  rogami: ['როგამი'],
  rioni: ['რიონი'],
  rikoti: ['რიკოთი'],
  vartsikhe: ['ვარციხე'],
  salkhino: ['სალხინო'],
  sori: ['სორი'],
  paliastomi: ['პალიასტომი'],
  argveta: ['არგვეთა'],
  gordi: ['გორდი'],
  geguti: ['გეგუთი'],
  'kveda gordi': ['ქვედა გორდი'],
  uravi: ['ურავი'],
  sakara: ['საქარა'],
  dimi: ['დიმი'],
  tvishi: ['ტვიში'],
  lashkheti: ['ლაშხეთი'],
  kakhati: ['კახათი'],
  tskaltubo: ['წყალტუბო'],
  'meore sviri': ['მეორე სვირი'],
  poti: ['ფოთი'],
  imerula: ['იმერულა'],
  kvirila: ['კვირილა'],
  sataplia: ['სათაფლია'],
  'prometheus cave area': ['პრომეთეს მღვიმე'],
  katskhi: ['კაცხი'],
  'okatse canyon': ['ოკაცე კანიონი'],

  // ── KAKHETI ───────────────────────────────────────────────────────────────
  telavi: ['თელავი'],
  signagi: ['სიღნაღი'],
  sighnaghi: ['სიღნაღი'],
  kvareli: ['ყვარელი'],
  gurjaani: ['გურჯაანი'],
  sagarejo: ['საგარეჯო'],
  lagodekhi: ['ლაგოდეხი'],
  dedoplistskaro: ['დედოფლისწყარო'],
  akhmeta: ['ახმეტა'],
  tsnori: ['წნორი'],
  bakurtsikhe: ['ბაკურციხე'],
  ikalto: ['იყალთო'],
  alaverdi: ['ალავერდი'],
  shilda: ['შილდა'],
  nekresi: ['ნეკრესი'],
  velistsikhe: ['ველისციხე'],
  tsinandali: ['წინანდალი'],
  vardisubani: ['ვარდისუბანი'],
  akhasheni: ['ახაშენი'],
  kondoli: ['კონდოლი'],
  mukuzani: ['მუკუზანი'],
  napareuli: ['ნაფარეული'],
  ujarma: ['უჯარმა'],
  manavi: ['მანავი'],
  bodbe: ['ბოდბე'],
  patardzeuli: ['პატარძეული'],
  vaziani: ['ვაზიანი'],
  badiauri: ['ბადიაური'],
  kardenakhi: ['კარდენახი'],
  matani: ['მატანი'],
  pshaveli: ['ფშაველა'],
  alvani: ['ალვანი'],
  kiziki: ['კიზიყი'],
  tusheti: ['თუშეთი'],
  omalo: ['ომალო'],
  shromisi: ['შრომისი'],
  chabaani: ['ჩაბაანი'],
  'zemo khodasheni': ['ზემო ხოდაშენი'],
  'kvemo khodasheni': ['ქვემო ხოდაშენი'],
  eniseli: ['ენისელი'],
  steleti: ['სტელეთი'],
  ziaouri: ['ზიაური'],
  kisiskhevi: ['კისისხევი'],
  khashmi: ['ხაშმი'],
  artana: ['არტანა'],
  'kvemo alvani': ['ქვემო ალვანი'],
  'zemo alvani': ['ზემო ალვანი'],
  chailuri: ['ჩაილური'],
  saniore: ['სანიორე'],
  'davit gareja': ['დავით გარეჯა'],
  'alazani valley': ['ალაზნის ველი'],
  'lagodekhi national park': ['ლაგოდეხის ეროვნული პარკი'],
  vashlovani: ['ვაშლოვანი'],
  'alaverdi village': ['ალავერდი სოფელი'],

  // ── KVEMO KARTLI ──────────────────────────────────────────────────────────
  rustavi: ['რუსთავი'],
  marneuli: ['მარნეული'],
  gardabani: ['გარდაბანი'],
  dmanisi: ['დმანისი'],
  bolnisi: ['ბოლნისი'],
  tetritskaro: ['თეთრიწყარო'],
  tsalka: ['წალკა'],
  manglisi: ['მანგლისი'],
  trialeti: ['თრიალეთი'],
  kumisi: ['კუმისი'],
  algeti: ['ალგეთი'],
  kldeisi: ['კლდეისი'],
  koda: ['კოდა'],
  zhinvali: ['ჟინვალი'],
  nichbisi: ['ნიჩბისი'],
  bediani: ['ბედიანი'],
  sadakhlo: ['სადახლო'],
  yerevi: ['იერევი'],
  'akhali saniore': ['ახალი სანიორე'],
  sioni: ['სიონი'],
  tamarisi: ['თამარისი'],
  tabakhmela: ['თაბახმელა'],
  kabali: ['ყაბალი'],
  kizilkilisa: ['ყიზილქილისა'],
  birtvisi: ['ბირთვისი'],
  'kvemo bolnisi': ['ქვემო ბოლნისი'],
  'zemo bolnisi': ['ზემო ბოლნისი'],
  shaumiani: ['შაუმიანი'],
  kumurdo: ['კუმურდო'],
  kojori: ['კოჯორი'],
  betania: ['ბეთანია'],
  kiketi: ['კიკეთი'],

  // ── MTSKHETA-MTIANETI ─────────────────────────────────────────────────────
  mtskheta: ['მცხეთა'],
  gudauri: ['გუდაური'],
  kazbegi: ['ყაზბეგი', 'კაზბეგი'],
  stepantsminda: ['სტეფანწმინდა'],
  dusheti: ['დუშეთი'],
  tianeti: ['თიანეთი'],
  pasanauri: ['ფასანაური'],
  ananuri: ['ანანური'],
  kobi: ['კობი'],
  mleta: ['მლეთა'],
  achkhoti: ['აჩხოთი'],
  sno: ['სნო'],
  barisakho: ['ბარისახო'],
  roshka: ['როშკა'],
  juta: ['ჯუთა'],
  truso: ['თრუსო'],
  gveleti: ['გველეთი'],
  gergeti: ['გერგეთი'],
  arsha: ['არშა'],
  khada: ['ხადა'],
  natakhtari: ['ნატახტარი'],
  saguramo: ['საგურამო'],
  mukhrani: ['მუხრანი'],
  dzegvi: ['ძეგვი'],
  'zhinvali village': ['ჟინვალის სოფელი'],
  akhalgori: ['ახალგორი'],
  kvesheti: ['კვეშეთი'],
  gudamakari: ['გუდამაყარი'],
  pshavi: ['ფშავი'],
  khevsureti: ['ხევსურეთი'],
  shatili: ['შატილი'],
  mutso: ['მუწო'],
  zedazeni: ['ზედაზენი'],
  phoka: ['ფოქა'],
  'kazbegi national park': ['ყაზბეგის ეროვნული პარკი'],
  'gergeti trinity church area': ['გერგეთის სამება'],
  'ananuri fortress': ['ანანურის ციხე'],
  'gudamakari village': ['გუდამაყრის სოფელი'],

  // ── RACHA-LECHKHUMI ───────────────────────────────────────────────────────
  ambrolauri: ['ამბროლაური'],
  oni: ['ონი'],
  tsageri: ['წაგერი'],
  lentekhi: ['ლენტეხი'],
  shovi: ['შოვი'],
  ghebi: ['ღები'],
  utsera: ['უწერა'],
  glola: ['გლოლა'],
  chiora: ['ჭიორა'],
  bari: ['ბარი'],
  alpana: ['ალფანა'],
  chkhari: ['ჩხარი'],
  nikortsminda: ['ნიკორწმინდა'],
  khvamli: ['ხვამლი'],
  orpiri: ['ორფირი'],
  'kvemo racha': ['ქვემო რაჭა'],
  'zemo racha': ['ზემო რაჭა'],
  'zeda glola': ['ზედა გლოლა'],
  'kveda glola': ['ქვედა გლოლა'],

  // ── SAMEGRELO-ZEMO SVANETI ────────────────────────────────────────────────
  zugdidi: ['ზუგდიდი'],
  senaki: ['სენაკი'],
  mestia: ['მესტია'],
  ushguli: ['უშგული'],
  martvili: ['მარტვილი'],
  khobi: ['ხობი'],
  tsalenjikha: ['წალენჯიხა'],
  chkhorotsku: ['ჩხოროწყუ'],
  abasha: ['აბაშა'],
  khobisstavi: ['ხობისთავი'],
  lakhami: ['ლახამი'],
  anaklia: ['ანაკლია'],
  ganmukhuri: ['განმუხური'],
  ingiri: ['ინგირი'],
  darcheli: ['დარჩელი'],
  kortskheli: ['კორცხელი'],
  muris: ['მურის'],
  orsantia: ['ორსანთია'],
  khobishkhevi: ['ხობისხევი'],
  tsaishi: ['წაიში'],
  chaladidi: ['ჭალადიდი'],
  shamgona: ['შამგონა'],
  bandza: ['ბანძა'],
  nosiri: ['ნოსირი'],
  'khobi village': ['ხობის სოფელი'],
  leketi: ['ლეკეთი'],
  tskhemvani: ['ცხემვანი'],
  nakhunao: ['ნახუნაო'],
  latali: ['ლატალი'],
  mazeri: ['მაზერი'],
  becho: ['ბეჩო'],
  mulakhi: ['მულახი'],
  ipari: ['იფარი'],
  lakhiri: ['ლახირი'],
  etseri: ['ეწერი'],
  kala: ['კალა'],
  nakra: ['ნაყრა'],
  ughvani: ['უღვანი'],
  'kvemo etseri': ['ქვემო ეწერი'],
  'zemo etseri': ['ზემო ეწერი'],
  ushkhvani: ['უშხვანი'],
  'kolkheti national park': ['კოლხეთის ეროვნული პარკი'],
  'martvili canyon': ['მარტვილის კანიონი'],
  skuri: ['სკური'],
  ilori: ['ილორი'],
  'ochamchire district': ['ოჩამჩირის რაიონი'],
  'ureki beach': ['ურეკის სანაპირო'],
  'paliastomi lake': ['პალიასტომის ტბა'],

  // ── SAMTSKHE-JAVAKHETI ────────────────────────────────────────────────────
  akhaltsikhe: ['ახალციხე'],
  borjomi: ['ბორჯომი'],
  bakuriani: ['ბაკურიანი'],
  akhalkalaki: ['ახალქალაქი'],
  ninotsminda: ['ნინოწმინდა'],
  aspindza: ['ასპინძა'],
  adigeni: ['ადიგენი'],
  vardzia: ['ვარძია'],
  rabati: ['რაბათი'],
  likani: ['ლიკანი'],
  tsaghveri: ['წაღვერი'],
  tba: ['ტბა'],
  'patara borjomi': ['პატარა ბორჯომი'],
  timotesubani: ['თიმოთეს უბანი'],
  saphara: ['საფარა'],
  chule: ['ჩულე'],
  kvabiskhevi: ['კვაბისხევი'],
  potskhovi: ['ფოცხოვი'],
  kartsakhi: ['ყარწახი'],
  paravani: ['ფარავანი'],
  klde: ['კლდე'],
  bokkakhchi: ['ბოქქახჩი'],
  zarzma: ['ზარზმა'],
  tatari: ['თათარი'],
  abastumani: ['აბასთუმანი'],
  nakhiduri: ['ნახიდური'],
  gomarduli: ['გომარდული'],
  vakhani: ['ვახანი'],
  saro: ['სარო'],
  toba: ['ტობა'],
  parakvavi: ['ფარაქვავი'],
  tabatskuri: ['თაბაწყური'],
  khanchali: ['ხანჩალი'],

  // ── SHIDA KARTLI ──────────────────────────────────────────────────────────
  gori: ['გორი'],
  kaspi: ['კასპი'],
  khashuri: ['ხაშური'],
  kareli: ['ქარელი'],
  java: ['ჯავა'],
  surami: ['სურამი'],
  agara: ['აგარა'],
  tskhinvali: ['ცხინვალი'],
  tsqneti: ['წყნეთი'],
  uplistsikhe: ['უფლისციხე'],
  akhaldaba: ['ახალდაბა'],
  tkviavi: ['თქვიავი'],
  ruisi: ['რუისი'],
  'kvemo kvakhchiri': ['ქვემო კვახჭირი'],
  'zemo kvakhchiri': ['ზემო კვახჭირი'],
  skra: ['სკრა'],
  igoeti: ['იგოეთი'],
  sveri: ['სვერი'],
  boriti: ['ბორითი'],
  eredvi: ['ერედვი'],
  karaleti: ['ყარალეთი'],
  shindisi: ['შინდისი'],
  tadzrisi: ['თაძრისი'],
  vanati: ['ვანათი'],
  berbuki: ['ბერბუკი'],
  'meore ateni': ['მეორე ათენი'],
  'pireli ateni': ['პირველი ათენი'],
  ateni: ['ათენი'],
  kemerti: ['კემერთი'],
  ditsi: ['დიწი'],
  khidistavi: ['ხიდისთავი'],
  ergneti: ['ერგნეთი'],
  tamarasheni: ['თამარაშენი'],
  avneveli: ['ავნეველი'],
  dvani: ['დვანი'],
  disevi: ['დისევი'],

  // ── ABKHAZIA ──────────────────────────────────────────────────────────────
  sokhumi: ['სოხუმი'],
  sukhumi: ['სოხუმი'],
  gagra: ['გაგრა'],
  gudauta: ['გუდაუთა'],
  ochamchire: ['ოჩამჩირე'],
  tkuarchal: ['ტყვარჩელი'],
  gali: ['გალი'],
  pitsunda: ['პიცუნდა'],
  psou: ['ფსოუ'],
  gantiadi: ['განთიადი'],

  // ── COMMON SPELLING VARIANTS ──────────────────────────────────────────────
  'akhali shuakhevi': ['ახალი შუახევი'],
  'shuakhevi village': ['შუახევის სოფელი'],
  'akhalsopeli': ['ახალსოფელი'],
  'tskhinvali district': ['ცხინვალის რაიონი'],

  // ── VILLAGES APPEARING IN LIVE LISTINGS ──────────────────────────────────
  chkhutuneti: ['ჩხუტუნეთი'],
  chxutuneti: ['ჩხუტუნეთი'],
  vaio: ['ვაიო'],
  bakhmaro: ['ბახმარო'],
  buknari: ['ბუკნარი'],
  sabue: ['საბუე'],
  shalauri: ['შალაური'],
  pankisi: ['პანკისი'],
  birkiani: ['ბირკიანი'],
  bazaleti: ['ბაზალეთი'],
  tskhvarichamia: ['ცხვარიჭამია'],
  shkmeri: ['შქმერი'],
  ghari: ['ღარი'],
  dziraguli: ['ძირაგეული'],
  'zemo kvishiani': ['ზემო ქვიშიანი'],
};

/** Reverse map: Georgian (lowercase) → canonical English key */
const KA_TO_EN: Record<string, string> = {};
for (const [en, kaList] of Object.entries(EN_TO_KA)) {
  for (const ka of kaList) {
    KA_TO_EN[ka.toLowerCase()] = en;
  }
}

/**
 * Returns all search tokens for a given query string.
 * Expands any query into all equivalent forms in both scripts.
 */
export function getSearchTokens(query: string): string[] {
  const q = query.toLowerCase().trim();
  const tokens = new Set<string>([q]);

  // Try EN → KA: check if query matches or contains any English key
  for (const [en, kaList] of Object.entries(EN_TO_KA)) {
    if (q === en || q.includes(en) || en.includes(q)) {
      tokens.add(en);
      kaList.forEach(ka => tokens.add(ka.toLowerCase()));
    }
  }

  // Try KA → EN: check if query matches or contains any Georgian value
  for (const [ka, en] of Object.entries(KA_TO_EN)) {
    if (q === ka || q.includes(ka) || ka.includes(q)) {
      tokens.add(ka);
      tokens.add(en);
      const kaVariants = EN_TO_KA[en] || [];
      kaVariants.forEach(v => tokens.add(v.toLowerCase()));
    }
  }

  return Array.from(tokens).filter(Boolean);
}

/**
 * Returns true if a property location string matches the search query,
 * considering both Georgian and English equivalents.
 */
export function locationMatches(propertyLocation: string, searchQuery: string): boolean {
  if (!searchQuery.trim()) return true;
  if (!propertyLocation) return false;

  const propLower = propertyLocation.toLowerCase();

  // Expand the search query into all bilingual tokens
  const tokens = getSearchTokens(searchQuery);

  // Also expand just the city part (before first comma) separately
  const cityPart = searchQuery.split(',')[0].trim();
  const cityTokens = cityPart !== searchQuery ? getSearchTokens(cityPart) : [];

  const allTokens = [...new Set([...tokens, ...cityTokens])].filter(t => t.length > 0);

  for (const token of allTokens) {
    if (propLower.includes(token)) return true;

    // Also check the property's city part (before comma) against the token
    const propCity = propLower.split(',')[0].trim();
    if (propCity.includes(token) || token.includes(propCity)) return true;
  }

  return false;
}

/**
 * CITY_TO_REGION — maps every city/village name (lowercase English) to its
 * canonical region key (matching keys in REGION_ALIASES).
 *
 * This is the core lookup that makes region filtering work even when the host
 * only saved the city name (e.g. "Telavi") without the region name ("Kakheti").
 *
 * Built from georgianCities data — covers all 300+ cities/villages.
 */
export const CITY_TO_REGION: Record<string, string> = {
  // ── TBILISI ──────────────────────────────────────────────────────────────
  tbilisi: 'tbilisi',
  'didi dighomi': 'tbilisi',
  gldani: 'tbilisi',
  isani: 'tbilisi',
  krtsanisi: 'tbilisi',
  mtatsminda: 'tbilisi',
  nadzaladevi: 'tbilisi',
  saburtalo: 'tbilisi',
  samgori: 'tbilisi',
  vake: 'tbilisi',
  didube: 'tbilisi',
  chugureti: 'tbilisi',
  avlabari: 'tbilisi',
  ortachala: 'tbilisi',
  marjanishvili: 'tbilisi',
  vera: 'tbilisi',
  digomi: 'tbilisi',
  lisi: 'tbilisi',
  tsavkisi: 'tbilisi',

  // ── ADJARA ───────────────────────────────────────────────────────────────
  batumi: 'adjara',
  kobuleti: 'adjara',
  chakvi: 'adjara',
  sarpi: 'adjara',
  gonio: 'adjara',
  kvariati: 'adjara',
  makhinjauri: 'adjara',
  makhunjauri: 'adjara',
  tsikhisdziri: 'adjara',
  ureki: 'adjara',
  shuakhevi: 'adjara',
  khulo: 'adjara',
  keda: 'adjara',
  qeda: 'adjara',
  mtirala: 'adjara',
  kintrishi: 'adjara',
  didachara: 'adjara',
  kapandari: 'adjara',
  khikhadziri: 'adjara',
  beshumi: 'adjara',
  goderdzi: 'adjara',
  'goderdzi pass': 'adjara',
  damia: 'adjara',
  'zeda shuakhevi': 'adjara',
  chokhatauri: 'adjara',
  natanebi: 'adjara',
  tago: 'adjara',
  dandalo: 'adjara',
  zendidi: 'adjara',
  khelvachauri: 'adjara',
  khikhani: 'adjara',
  maltakva: 'adjara',
  'kobuleti beach': 'adjara',
  'green cape': 'adjara',
  'batumi botanical garden area': 'adjara',
  'shuakhevi pass': 'adjara',

  // ── GURIA ─────────────────────────────────────────────────────────────────
  ozurgeti: 'guria',
  lanchkhuti: 'guria',
  shemokmedi: 'guria',
  bakhvi: 'guria',
  nasakirali: 'guria',
  shroma: 'guria',
  likhauri: 'guria',
  supsa: 'guria',
  askana: 'guria',
  achandara: 'guria',
  nigoiti: 'guria',
  bakhiskhevi: 'guria',
  laituri: 'guria',
  makvaneti: 'guria',
  gomismta: 'guria',
  naruja: 'guria',
  dioknisi: 'guria',
  gomi: 'guria',
  zoti: 'guria',
  'guria region': 'guria',

  // ── IMERETI ───────────────────────────────────────────────────────────────
  kutaisi: 'imereti',
  zestaponi: 'imereti',
  chiatura: 'imereti',
  tkibuli: 'imereti',
  samtredia: 'imereti',
  sachkhere: 'imereti',
  baghdati: 'imereti',
  vani: 'imereti',
  khoni: 'imereti',
  terjola: 'imereti',
  'zeda gordi': 'imereti',
  shorapani: 'imereti',
  sviri: 'imereti',
  chumateleti: 'imereti',
  rogami: 'imereti',
  rioni: 'imereti',
  rikoti: 'imereti',
  vartsikhe: 'imereti',
  salkhino: 'imereti',
  sori: 'imereti',
  paliastomi: 'imereti',
  argveta: 'imereti',
  gordi: 'imereti',
  geguti: 'imereti',
  'kveda gordi': 'imereti',
  uravi: 'imereti',
  sakara: 'imereti',
  dimi: 'imereti',
  tvishi: 'imereti',
  lashkheti: 'imereti',
  kakhati: 'imereti',
  tskaltubo: 'imereti',
  'meore sviri': 'imereti',
  poti: 'imereti',
  imerula: 'imereti',
  kvirila: 'imereti',
  sataplia: 'imereti',
  'prometheus cave area': 'imereti',
  katskhi: 'imereti',
  'okatse canyon': 'imereti',

  // ── KAKHETI ───────────────────────────────────────────────────────────────
  telavi: 'kakheti',
  signagi: 'kakheti',
  sighnaghi: 'kakheti',
  kvareli: 'kakheti',
  gurjaani: 'kakheti',
  sagarejo: 'kakheti',
  lagodekhi: 'kakheti',
  dedoplistskaro: 'kakheti',
  akhmeta: 'kakheti',
  tsnori: 'kakheti',
  bakurtsikhe: 'kakheti',
  ikalto: 'kakheti',
  alaverdi: 'kakheti',
  shilda: 'kakheti',
  nekresi: 'kakheti',
  velistsikhe: 'kakheti',
  tsinandali: 'kakheti',
  vardisubani: 'kakheti',
  akhasheni: 'kakheti',
  kondoli: 'kakheti',
  mukuzani: 'kakheti',
  napareuli: 'kakheti',
  ujarma: 'kakheti',
  manavi: 'kakheti',
  bodbe: 'kakheti',
  patardzeuli: 'kakheti',
  vaziani: 'kakheti',
  badiauri: 'kakheti',
  kardenakhi: 'kakheti',
  matani: 'kakheti',
  pshaveli: 'kakheti',
  alvani: 'kakheti',
  kiziki: 'kakheti',
  tusheti: 'kakheti',
  omalo: 'kakheti',
  shromisi: 'kakheti',
  chabaani: 'kakheti',
  'zemo khodasheni': 'kakheti',
  'kvemo khodasheni': 'kakheti',
  eniseli: 'kakheti',
  steleti: 'kakheti',
  ziaouri: 'kakheti',
  kisiskhevi: 'kakheti',
  khashmi: 'kakheti',
  artana: 'kakheti',
  'kvemo alvani': 'kakheti',
  'zemo alvani': 'kakheti',
  chailuri: 'kakheti',
  saniore: 'kakheti',
  'davit gareja': 'kakheti',
  'alazani valley': 'kakheti',
  'lagodekhi national park': 'kakheti',
  vashlovani: 'kakheti',
  'alaverdi village': 'kakheti',

  // ── KVEMO KARTLI ──────────────────────────────────────────────────────────
  rustavi: 'kvemo kartli',
  marneuli: 'kvemo kartli',
  gardabani: 'kvemo kartli',
  dmanisi: 'kvemo kartli',
  bolnisi: 'kvemo kartli',
  tetritskaro: 'kvemo kartli',
  tsalka: 'kvemo kartli',
  manglisi: 'kvemo kartli',
  trialeti: 'kvemo kartli',
  kumisi: 'kvemo kartli',
  algeti: 'kvemo kartli',
  kldeisi: 'kvemo kartli',
  koda: 'kvemo kartli',
  zhinvali: 'kvemo kartli',
  nichbisi: 'kvemo kartli',
  bediani: 'kvemo kartli',
  sadakhlo: 'kvemo kartli',
  yerevi: 'kvemo kartli',
  'akhali saniore': 'kvemo kartli',
  sioni: 'kvemo kartli',
  tamarisi: 'kvemo kartli',
  tabakhmela: 'kvemo kartli',
  kabali: 'kvemo kartli',
  kizilkilisa: 'kvemo kartli',
  birtvisi: 'kvemo kartli',
  'kvemo bolnisi': 'kvemo kartli',
  'zemo bolnisi': 'kvemo kartli',
  shaumiani: 'kvemo kartli',
  kumurdo: 'kvemo kartli',
  kojori: 'kvemo kartli',
  betania: 'kvemo kartli',
  kiketi: 'kvemo kartli',

  // ── MTSKHETA-MTIANETI ─────────────────────────────────────────────────────
  mtskheta: 'mtskheta-mtianeti',
  gudauri: 'mtskheta-mtianeti',
  kazbegi: 'mtskheta-mtianeti',
  stepantsminda: 'mtskheta-mtianeti',
  dusheti: 'mtskheta-mtianeti',
  tianeti: 'mtskheta-mtianeti',
  pasanauri: 'mtskheta-mtianeti',
  ananuri: 'mtskheta-mtianeti',
  kobi: 'mtskheta-mtianeti',
  mleta: 'mtskheta-mtianeti',
  achkhoti: 'mtskheta-mtianeti',
  sno: 'mtskheta-mtianeti',
  barisakho: 'mtskheta-mtianeti',
  roshka: 'mtskheta-mtianeti',
  juta: 'mtskheta-mtianeti',
  truso: 'mtskheta-mtianeti',
  gveleti: 'mtskheta-mtianeti',
  gergeti: 'mtskheta-mtianeti',
  arsha: 'mtskheta-mtianeti',
  khada: 'mtskheta-mtianeti',
  natakhtari: 'mtskheta-mtianeti',
  saguramo: 'mtskheta-mtianeti',
  mukhrani: 'mtskheta-mtianeti',
  dzegvi: 'mtskheta-mtianeti',
  akhalgori: 'mtskheta-mtianeti',
  kvesheti: 'mtskheta-mtianeti',
  gudamakari: 'mtskheta-mtianeti',
  pshavi: 'mtskheta-mtianeti',
  khevsureti: 'mtskheta-mtianeti',
  shatili: 'mtskheta-mtianeti',
  mutso: 'mtskheta-mtianeti',
  zedazeni: 'mtskheta-mtianeti',
  phoka: 'mtskheta-mtianeti',
  'kazbegi national park': 'mtskheta-mtianeti',
  'gergeti trinity church area': 'mtskheta-mtianeti',
  'ananuri fortress': 'mtskheta-mtianeti',
  'gudamakari village': 'mtskheta-mtianeti',

  // ── RACHA-LECHKHUMI ───────────────────────────────────────────────────────
  ambrolauri: 'racha-lechkhumi',
  oni: 'racha-lechkhumi',
  tsageri: 'racha-lechkhumi',
  lentekhi: 'racha-lechkhumi',
  shovi: 'racha-lechkhumi',
  ghebi: 'racha-lechkhumi',
  utsera: 'racha-lechkhumi',
  glola: 'racha-lechkhumi',
  chiora: 'racha-lechkhumi',
  bari: 'racha-lechkhumi',
  alpana: 'racha-lechkhumi',
  chkhari: 'racha-lechkhumi',
  nikortsminda: 'racha-lechkhumi',
  khvamli: 'racha-lechkhumi',
  orpiri: 'racha-lechkhumi',
  'kvemo racha': 'racha-lechkhumi',
  'zemo racha': 'racha-lechkhumi',
  'zeda glola': 'racha-lechkhumi',
  'kveda glola': 'racha-lechkhumi',

  // ── SAMEGRELO-ZEMO SVANETI ────────────────────────────────────────────────
  // Samegrelo (lowland) cities
  zugdidi: 'samegrelo-zemo svaneti',
  senaki: 'samegrelo-zemo svaneti',
  martvili: 'samegrelo-zemo svaneti',
  khobi: 'samegrelo-zemo svaneti',
  tsalenjikha: 'samegrelo-zemo svaneti',
  chkhorotsku: 'samegrelo-zemo svaneti',
  abasha: 'samegrelo-zemo svaneti',
  khobisstavi: 'samegrelo-zemo svaneti',
  lakhami: 'samegrelo-zemo svaneti',
  anaklia: 'samegrelo-zemo svaneti',
  ganmukhuri: 'samegrelo-zemo svaneti',
  ingiri: 'samegrelo-zemo svaneti',
  darcheli: 'samegrelo-zemo svaneti',
  kortskheli: 'samegrelo-zemo svaneti',
  muris: 'samegrelo-zemo svaneti',
  orsantia: 'samegrelo-zemo svaneti',
  khobishkhevi: 'samegrelo-zemo svaneti',
  tsaishi: 'samegrelo-zemo svaneti',
  chaladidi: 'samegrelo-zemo svaneti',
  shamgona: 'samegrelo-zemo svaneti',
  bandza: 'samegrelo-zemo svaneti',
  nosiri: 'samegrelo-zemo svaneti',
  'khobi village': 'samegrelo-zemo svaneti',
  leketi: 'samegrelo-zemo svaneti',
  tskhemvani: 'samegrelo-zemo svaneti',
  nakhunao: 'samegrelo-zemo svaneti',
  'kolkheti national park': 'samegrelo-zemo svaneti',
  'martvili canyon': 'samegrelo-zemo svaneti',
  skuri: 'samegrelo-zemo svaneti',
  ilori: 'samegrelo-zemo svaneti',
  'ochamchire district': 'samegrelo-zemo svaneti',
  'ureki beach': 'samegrelo-zemo svaneti',
  'paliastomi lake': 'samegrelo-zemo svaneti',
  // Svaneti (highland) cities — also mapped to 'svaneti' for the dedicated filter
  mestia: 'svaneti',
  ushguli: 'svaneti',
  latali: 'svaneti',
  mazeri: 'svaneti',
  becho: 'svaneti',
  mulakhi: 'svaneti',
  ipari: 'svaneti',
  lakhiri: 'svaneti',
  etseri: 'svaneti',
  kala: 'svaneti',
  nakra: 'svaneti',
  ughvani: 'svaneti',
  'kvemo etseri': 'svaneti',
  'zemo etseri': 'svaneti',
  ushkhvani: 'svaneti',

  // ── SAMTSKHE-JAVAKHETI ────────────────────────────────────────────────────
  akhaltsikhe: 'samtskhe-javakheti',
  borjomi: 'samtskhe-javakheti',
  bakuriani: 'samtskhe-javakheti',
  akhalkalaki: 'samtskhe-javakheti',
  ninotsminda: 'samtskhe-javakheti',
  aspindza: 'samtskhe-javakheti',
  adigeni: 'samtskhe-javakheti',
  vardzia: 'samtskhe-javakheti',
  rabati: 'samtskhe-javakheti',
  likani: 'samtskhe-javakheti',
  tsaghveri: 'samtskhe-javakheti',
  tba: 'samtskhe-javakheti',
  'patara borjomi': 'samtskhe-javakheti',
  timotesubani: 'samtskhe-javakheti',
  saphara: 'samtskhe-javakheti',
  chule: 'samtskhe-javakheti',
  kvabiskhevi: 'samtskhe-javakheti',
  potskhovi: 'samtskhe-javakheti',
  kartsakhi: 'samtskhe-javakheti',
  paravani: 'samtskhe-javakheti',
  klde: 'samtskhe-javakheti',
  bokkakhchi: 'samtskhe-javakheti',
  zarzma: 'samtskhe-javakheti',
  tatari: 'samtskhe-javakheti',
  abastumani: 'samtskhe-javakheti',
  nakhiduri: 'samtskhe-javakheti',
  gomarduli: 'samtskhe-javakheti',
  vakhani: 'samtskhe-javakheti',
  saro: 'samtskhe-javakheti',
  toba: 'samtskhe-javakheti',
  parakvavi: 'samtskhe-javakheti',
  tabatskuri: 'samtskhe-javakheti',
  khanchali: 'samtskhe-javakheti',

  // ── SHIDA KARTLI ──────────────────────────────────────────────────────────
  gori: 'shida kartli',
  kaspi: 'shida kartli',
  khashuri: 'shida kartli',
  kareli: 'shida kartli',
  java: 'shida kartli',
  surami: 'shida kartli',
  agara: 'shida kartli',
  tskhinvali: 'shida kartli',
  tsqneti: 'shida kartli',
  uplistsikhe: 'shida kartli',
  akhaldaba: 'shida kartli',
  tkviavi: 'shida kartli',
  ruisi: 'shida kartli',
  'kvemo kvakhchiri': 'shida kartli',
  'zemo kvakhchiri': 'shida kartli',
  skra: 'shida kartli',
  igoeti: 'shida kartli',
  sveri: 'shida kartli',
  boriti: 'shida kartli',
  eredvi: 'shida kartli',
  karaleti: 'shida kartli',
  shindisi: 'shida kartli',
  tadzrisi: 'shida kartli',
  vanati: 'shida kartli',
  berbuki: 'shida kartli',
  'meore ateni': 'shida kartli',
  'pireli ateni': 'shida kartli',
  ateni: 'shida kartli',
  kemerti: 'shida kartli',
  ditsi: 'shida kartli',
  khidistavi: 'shida kartli',
  ergneti: 'shida kartli',
  tamarasheni: 'shida kartli',
  avneveli: 'shida kartli',
  dvani: 'shida kartli',
  disevi: 'shida kartli',

  // ── ABKHAZIA ──────────────────────────────────────────────────────────────
  sokhumi: 'abkhazia',
  sukhumi: 'abkhazia',
  gagra: 'abkhazia',
  gudauta: 'abkhazia',
  ochamchire: 'abkhazia',
  tkuarchal: 'abkhazia',
  gali: 'abkhazia',
  pitsunda: 'abkhazia',
  psou: 'abkhazia',
  gantiadi: 'abkhazia',

  // ── VILLAGES APPEARING IN LIVE LISTINGS ──────────────────────────────────
  chkhutuneti: 'adjara',
  chxutuneti: 'adjara',
  vaio: 'adjara',
  bakhmaro: 'guria',
  buknari: 'guria',
  sabue: 'kakheti',
  shalauri: 'kakheti',
  pankisi: 'kakheti',
  birkiani: 'kakheti',
  bazaleti: 'mtskheta-mtianeti',
  tskhvarichamia: 'mtskheta-mtianeti',
  shkmeri: 'racha-lechkhumi',
  ghari: 'racha-lechkhumi',
  dziraguli: 'racha-lechkhumi',
  'zemo kvishiani': 'kvemo kartli',
};

/**
 * Also build a Georgian-script → region key map from EN_TO_KA + CITY_TO_REGION.
 * This lets us look up Georgian city names (e.g. "თელავი") → region key ("kakheti").
 */
const KA_CITY_TO_REGION: Record<string, string> = {};
for (const [enCity, regionKey] of Object.entries(CITY_TO_REGION)) {
  const kaVariants = EN_TO_KA[enCity];
  if (kaVariants) {
    for (const ka of kaVariants) {
      KA_CITY_TO_REGION[ka.toLowerCase()] = regionKey;
    }
  }
}

/**
 * Normalizes a location/region string by collapsing spaces around dashes
 * and trimming extra whitespace. This handles cases like "სამცხე- ჯავახეთი"
 * (space after dash) which should match "სამცხე-ჯავახეთი".
 */
function normalizeSpacing(s: string): string {
  return s
    .replace(/\s*-\s*/g, '-') // collapse spaces around dashes: "a - b" → "a-b"
    .replace(/\s+/g, ' ')     // collapse multiple spaces
    .trim();
}

/**
 * Returns true if `haystack` contains `needle` as a whole word / token,
 * not just as a substring. This prevents "ჯავა" (Java city) from matching
 * inside "ჯავახეთი" (Javakheti region).
 *
 * A "word boundary" here means the needle is surrounded by non-alphanumeric
 * characters (spaces, commas, dashes, start/end of string).
 */
function containsWholeWord(haystack: string, needle: string): boolean {
  if (!needle || !haystack) return false;
  // Escape special regex characters in the needle
  const escaped = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  // Match needle surrounded by word separators or string boundaries
  const re = new RegExp(`(?:^|[\\s,;.\\-/])${escaped}(?:$|[\\s,;.\\-/])`, 'i');
  return re.test(haystack);
}

/**
 * Georgian writes "<city> district / municipality" by putting the city in the
 * genitive: "ონი" -> "ონის რაიონი", "ამბროლაური" -> "ამბროლაურის მუნიციპალიტეტი".
 * Hosts type it that way, so drop the administrative word and the trailing
 * genitive "ს" to recover the bare city name the dictionaries are keyed on.
 * Also drops the "სოფელი / სოფ." ("village") prefix for the same reason.
 */
function stripGeorgianAdminSuffix(part: string): string {
  const stripped = part
    .replace(/\s*(რაიონი|მუნიციპალიტეტი|მხარე)\s*$/u, '')
    .replace(/^\s*(სოფელი|სოფ\.|სოფ|დაბა|ქალაქი|ქ\.)\s+/u, '')
    .trim();
  if (stripped === part) return part;
  // Genitive "ს" — only drop it when a plausible stem is left behind.
  return stripped.length > 3 && stripped.endsWith('ს') ? stripped.slice(0, -1) : stripped;
}

/**
 * Given a property location string (e.g. "Telavi, Kakheti" or "თელავი" or "Telavi"),
 * returns the canonical region key (e.g. "kakheti") if it can be determined.
 * Returns null if no region can be inferred.
 */
function inferRegionFromLocation(propertyLocation: string): string | null {
  const propLower = normalizeSpacing(propertyLocation.toLowerCase().trim());

  // Split by comma — try each part as a city or region name
  const parts = propLower
    .split(',')
    .map(p => normalizeSpacing(p.trim()))
    .map(stripGeorgianAdminSuffix);

  for (const part of parts) {
    if (!part) continue;

    // 1. Direct city lookup (English)
    if (CITY_TO_REGION[part]) return CITY_TO_REGION[part];

    // 2. Georgian city lookup
    if (KA_CITY_TO_REGION[part]) return KA_CITY_TO_REGION[part];

    // 3. Check if the part itself is a region alias (exact match after normalization)
    for (const [key, aliases] of Object.entries(REGION_ALIASES)) {
      if (aliases.some(a => normalizeSpacing(a.toLowerCase()) === part)) return key;
    }

    // 4. Whole-word partial match — city name appears as a whole word in the part.
    //    Use whole-word matching to prevent "ჯავა" (Java/Shida Kartli) from
    //    matching inside "ჯავახეთი" (Javakheti), etc.
    for (const [city, region] of Object.entries(CITY_TO_REGION)) {
      if (containsWholeWord(part, city) || containsWholeWord(city, part)) return region;
    }
    for (const [kaCity, region] of Object.entries(KA_CITY_TO_REGION)) {
      if (containsWholeWord(part, kaCity) || containsWholeWord(kaCity, part)) return region;
    }
  }

  return null;
}

/**
 * Returns true if a property location string belongs to the given region,
 * matching bilingually (Georgian ↔ English) for both the filter region name
 * and the location string stored in the database.
 *
 * Strategy (in order):
 * 1. Infer the property's region from its city name via CITY_TO_REGION lookup
 * 2. Check if the inferred region matches the filter region (via REGION_ALIASES)
 * 3. Fall back to checking if the location string directly contains any region alias
 *
 * This means "Telavi" → inferred as "kakheti" → matches filter "Kakheti" ✓
 * And "თელავი" → inferred as "kakheti" → matches filter "Kakheti" ✓
 */
export function regionMatches(propertyLocation: string, filterRegion: string): boolean {
  if (!filterRegion.trim() || !propertyLocation) return false;

  const filterLower = normalizeSpacing(filterRegion.toLowerCase().trim());

  // Find the canonical region key for the filter value
  let filterCanonicalKey: string | null = null;
  for (const [key, aliases] of Object.entries(REGION_ALIASES)) {
    if (aliases.some(a => {
      const aLower = normalizeSpacing(a.toLowerCase());
      return aLower === filterLower || filterLower.includes(aLower) || aLower.includes(filterLower);
    })) {
      filterCanonicalKey = key;
      break;
    }
  }

  // If we can't identify the filter region, fall back to text matching
  if (!filterCanonicalKey) {
    return locationMatches(propertyLocation, filterRegion);
  }

  // Strategy 1: Infer the property's region from its city/location name
  const inferredRegion = inferRegionFromLocation(propertyLocation);
  if (inferredRegion) {
    // Direct canonical key match
    if (inferredRegion === filterCanonicalKey) return true;

    // Cross-region containment: "Svaneti" filter should match cities in
    // "samegrelo-zemo svaneti", and vice versa
    const svanetiRelated = ['svaneti', 'samegrelo-zemo svaneti'];
    if (svanetiRelated.includes(filterCanonicalKey) && svanetiRelated.includes(inferredRegion)) {
      return true;
    }

    // Also check if the inferred region is an alias of the filter region
    const filterAliases = REGION_ALIASES[filterCanonicalKey] || [];
    const inferredAliases = REGION_ALIASES[inferredRegion] || [];
    if (filterAliases.some(fa => inferredAliases.some(ia => ia.toLowerCase() === fa.toLowerCase()))) {
      return true;
    }
  }

  // Strategy 2: Check if the location string directly contains any alias of the filter region.
  // Normalize spacing around dashes so "სამცხე- ჯავახეთი" matches "სამცხე-ჯავახეთი".
  const propNormalized = normalizeSpacing(propertyLocation.toLowerCase());
  const allFilterAliases = REGION_ALIASES[filterCanonicalKey] || [];
  for (const alias of allFilterAliases) {
    const aliasNorm = normalizeSpacing(alias.toLowerCase());
    if (propNormalized.includes(aliasNorm)) return true;
  }

  return false;
}

/**
 * Filters autocomplete city suggestions bilingually.
 * Used in SearchBar to show matching cities regardless of input script.
 */
export function filterCitiesBilingual(
  cities: Array<{ name: string; region: string }>,
  query: string
): Array<{ name: string; region: string }> {
  if (!query.trim()) return [];

  const tokens = getSearchTokens(query);
  const q = query.toLowerCase();

  return cities.filter(city => {
    const cityLower = city.name.toLowerCase();
    const regionLower = city.region.toLowerCase();

    // Direct substring match
    if (cityLower.includes(q) || regionLower.includes(q)) return true;

    // Token-based bilingual match
    for (const token of tokens) {
      if (!token) continue;
      if (cityLower.includes(token) || regionLower.includes(token)) return true;
      if (token.includes(cityLower)) return true;
    }

    return false;
  });
}
