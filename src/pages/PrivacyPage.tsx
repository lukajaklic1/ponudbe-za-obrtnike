import { Link } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import AppLogo from '../components/ui/AppLogo'

const sl = {
  title: 'Izjava o zasebnosti',
  updated: 'Posodobljeno: julij 2026',
  intro: `Vaše osebne podatke varujemo v skladu z Uredbo (EU) 2016/679 (GDPR), Zakonom o varstvu osebnih podatkov (ZVOP-2) in drugo veljavno zakonodajo o varstvu podatkov. Ta izjava se nanaša na fizične osebe, ki pri Obrtdesk nastopajo kot poslovni uporabniki — lastnike, direktorje, kalkulatorje, prodajnike in ostale zaposlene v proizvodnih podjetjih, ki uporabljajo platformo za pripravo ponudb in upravljanje stroškovnih kalkulacij.

Obrtdesk v razmerju do vas nastopa v dveh jasno ločenih vlogah. Kot upravljavec obdeluje vaše osebne podatke za namen zagotavljanja in upravljanja storitev — to razmerje ureja ta izjava. Kot obdelovalec pa obdeluje kontaktne in komercialne podatke vaših strank in poslovnih partnerjev, ki jih vnesete v platformo, po vaših navodilih in v vašem imenu — za to razmerje ste vi odgovorni kot upravljavec.`,

  s1title: '1. Podatki o upravljavcu',
  s1: `Upravljavec osebnih podatkov je TCE, d.o.o. Za vsa vprašanja v zvezi z obdelavo vaših osebnih podatkov nas kontaktirajte na info@tce.si. Na zahteve odgovorimo v roku 30 dni.`,

  s2title: '2. Katere podatke obdelujemo',
  s2cats: [
    {
      title: 'Podatki o uporabniškem računu',
      text: 'Ime in priimek, e-poštni naslov, geslo (hranjeno izključno v zgoščeni obliki), naziv podjetja, naslov, ID za DDV ter bančni podatki za izstavitev računov.',
    },
    {
      title: 'Podatki o strankah (obdelovalska vloga)',
      text: 'Naziv stranke, kontaktna oseba, e-poštni naslov, telefonska številka, naslov in drugi komercialni podatki, ki jih vnesete ob ustvarjanju strank v platformi. Za te podatke nastopate vi kot upravljavec — odgovorni ste za zakonitost njihove obdelave in ustrezno obvestitev strank.',
    },
    {
      title: 'Kalkulacije in stroškovni modeli',
      text: 'Vse stroškovne kalkulacije, ki jih ustvarite v platformi: postavke stroškov, količine, kosi, odpadek, serijska velikost, časi obdelave ter izračunane prodajne cene. Ti podatki so vaša izključna last in se obdelujejo izključno za zagotavljanje storitve.',
    },
    {
      title: 'Podatki o strojih in delovnih mestih',
      text: 'Tehnični in stroškovni parametri vaših strojev in delovnih mest: urna postavka, stroški energije, vode, zraka, vzdrževanja, amortizacije, orodij ter razpoložljivi fondi ur. Vključno z modelom, letom nabave in vrednostjo stroja.',
    },
    {
      title: 'Urne postavke dela',
      text: 'Kategorije delavnih ur z bruto plačo, socialnimi prispevki, dodatki in regresom — iz katerih platforma izračuna efektivno urno postavko za kalkulacije.',
    },
    {
      title: 'Podatki o materialih',
      text: 'Naziv, enota, cena na enoto in dobaviteljski podatki za materiale, ki jih vnašate v kalkulacije.',
    },
    {
      title: 'Režijski stroški',
      text: 'Letni stroški po stroškovnih mestih (upravljanje, trženje, razvoj, administracija ipd.), iz katerih platforma izračuna režijsko stopnjo za vsako kalkulacijo.',
    },
    {
      title: 'Ponudbe in priponke',
      text: 'Ustvarjene ponudbe z vsemi postavkami, cenami, pogoji, kontaktnimi podatki in statusom (osnutek, izdano, poslano, pridobljeno, izgubljeno). Priložene datoteke: tehnične risbe, specifikacije, modeli (PDF, DWG, SLDPRT, PNG in drugi formati).',
    },
    {
      title: 'Tehnični podatki o uporabi',
      text: 'Čas dostopa, IP naslov (za varnostne namene, psevdonimiziran po 30 dneh), operacijski sistem in brskalnik. Revizijska sled sprememb znotraj platforme.',
    },
  ],

  s3title: '3. Zakaj obdelujemo vaše podatke',
  s3items: [
    {
      title: 'Upravljanje računa in zagotavljanje storitev',
      text: 'Upravljanje dostopov, zagotavljanje delovanja platforme in vseh njenih funkcionalnosti (kalkulacije, ponudbe, stranke, priponke, analitika).',
      basis: 'Izpolnitev pogodbe (čl. 6(1)(b) GDPR)',
      retention: 'Celotno obdobje trajanja pogodbe; izbris v 30 dneh po prenehanju.',
    },
    {
      title: 'Obračunavanje, izdajanje računov in davčne obveznosti',
      text: 'Obdelava podatkov o plačilih, izdanih računih in transakcijah za namene obračunavanja naročnine ter izpolnjevanja davčnih in računovodskih obveznosti.',
      basis: 'Izpolnitev pogodbe + zakonska obveznost (čl. 6(1)(b) in (c) GDPR)',
      retention: '10 let v skladu z ZDavP-2.',
    },
    {
      title: 'Podpora strankam',
      text: 'Komunikacijske podatke iz stikov s podporo hranimo za zagotavljanje kontinuirane podpore in reševanja tehničnih težav.',
      basis: 'Zakoniti interes (čl. 6(1)(f) GDPR)',
      retention: '3 leta po zaključku posamezne zadeve.',
    },
    {
      title: 'Varnost platforme in preprečevanje zlorab',
      text: 'Tehnične podatke o dostopu obdelujemo za zaznavanje nepooblaščenih dostopov, preprečevanje zlorab in zagotavljanje varnega delovanja platforme.',
      basis: 'Zakoniti interes (čl. 6(1)(f) GDPR)',
      retention: 'IP naslovi psevdonimiziranimi po 30 dneh; varnostni zapisi izbrisani po 12 mesecih.',
    },
    {
      title: 'Analitika in razvoj storitev',
      text: 'Agregirane in anonimizirane podatke o uporabi obdelujemo za razvoj novih funkcionalnosti in izboljšanje uporabniške izkušnje.',
      basis: 'Zakoniti interes (čl. 6(1)(f) GDPR)',
      retention: 'Anonimizirani podatki se hranijo trajno; osebni podatki za analitične namene do 24 mesecev.',
    },
    {
      title: 'Obveščanje o storitvah',
      text: 'Obstoječe stranke občasno obveščamo o posodobitvah platforme in novih funkcionalnostih. Pravico do ugovora po čl. 21 GDPR upoštevamo takoj in brezpogojno.',
      basis: 'Zakoniti interes (čl. 6(1)(f) GDPR)',
      retention: 'Do odjave.',
    },
    {
      title: 'Uveljavljanje pravnih zahtevkov',
      text: 'V primeru pravnih sporov ali regulatornih postopkov hranimo relevantne podatke za namene uveljavljanja ali obrambe pravnih zahtevkov.',
      basis: 'Zakoniti interes (čl. 6(1)(f) GDPR)',
      retention: 'Do zaključka postopka in 5 let po njem.',
    },
  ],

  s4title: '4. Kdo obdeluje vaše podatke',
  s4: `Vaši podatki so dostopni le omejenemu krogu oseb pri Obrtdesk — izključno tistim, ki podatke potrebujejo za opravljanje svojih nalog. Vsi so zavezani k zaupnosti.

Za določene storitve uporabljamo zunanje obdelovalce, s katerimi imamo sklenjene pogodbe o obdelavi podatkov po čl. 28 GDPR:`,
  s4processors: [
    ['Supabase Inc.', 'Gostovanje podatkov in avtentikacija', 'EU (Frankfurt, Nemčija)'],
    ['Vercel Inc.', 'Gostovanje aplikacije', 'EU / globalna CDN'],
  ],
  s4end: `Vaše podatke razkrijemo državnim organom le, kadar je to zahtevano na podlagi zakona. V primeru pravnih sporov jih lahko razkrijemo odvetnikom in sodiščem v obsegu, ki je nujen za zaščito pravnih interesov.`,

  s5title: '5. Prenos podatkov v tretje države',
  s5: `Obrtdesk hrani in obdeluje podatke primarno v Evropski uniji (Supabase Frankfurt, Vercel EU). V kolikor bi pri prihodnji nadgradnji infrastrukture prišlo do prenosa osebnih podatkov izven EGP, bo Obrtdesk to zagotovil izključno z ustreznimi zaščitnimi mehanizmi (Standardne pogodbene klavzule Evropske komisije po Izvedbeni odločbi 2021/914 ali odločba o ustreznosti).

Imate pravico zahtevati informacije o državah, v katere se vaši podatki prenašajo. Zahtevo naslovite na info@tce.si.`,

  s6title: '6. Varnost podatkov',
  s6: 'Vaše podatke varujemo s tehničnimi in organizacijskimi ukrepi, ki vključujejo:',
  s6items: [
    'Šifriranje podatkov med prenosom (TLS 1.2+) in v stanju mirovanja (AES-256)',
    'Nadzor dostopa na podlagi načela najmanjšega potrebnega dostopa (RBAC)',
    'Večfaktorska avtentikacija za dostop do infrastrukture',
    'Ločena razvojna in produkcijska okolja brez prenosa produkcijskih podatkov v testna okolja',
    'Redne varnostne kopije in preizkusi obnove',
    'Centralizirane revizijske dnevnike in alarmiranje ob sumljivih dejanjih',
  ],
  s6end: 'V primeru varnostnega incidenta, ki bi verjetno povzročil visoko tveganje za vaše pravice in svoboščine, vas bomo nemudoma obvestili v skladu s čl. 34 GDPR.',

  s7title: '7. Vaše pravice',
  s7intro: 'Na vse zahteve odgovorimo v roku 30 dni; pri kompleksnih zahtevah si pridržujemo pravico do podaljšanja za največ 2 meseca, o čemer vas predhodno obvestimo.',
  s7items: [
    ['Pravica do dostopa (čl. 15)', 'Zahtevate kopijo osebnih podatkov, ki jih obdelujemo v zvezi z vami, in informacije o naravi, namenu ter obsegu obdelave.'],
    ['Pravica do popravka (čl. 16)', 'Zahtevate popravek netočnih ali dopolnitev nepopolnih osebnih podatkov.'],
    ['Pravica do izbrisa (čl. 17)', 'Zahtevate izbris svojih osebnih podatkov, kadar ni več podlage za njihovo obdelavo. Pravica je omejena z zakonskimi obveznostmi hrambe (npr. davčna dokumentacija).'],
    ['Pravica do omejitve obdelave (čl. 18)', 'Zahtevate začasno omejitev obdelave vaših podatkov, dokler ne razrešimo morebitnih nesoglasij.'],
    ['Pravica do ugovora (čl. 21)', 'Ugovarjate obdelavi na podlagi zakonitega interesa. Ugovor za namene direktnega marketinga je absoluten in brezpogojen — upoštevamo ga takoj.'],
    ['Pravica do prenosljivosti (čl. 20)', 'Zahtevate vaše osebne podatke v strukturirani, strojno berljivi obliki ali njihov neposredni prenos k drugemu upravljavcu.'],
    ['Pravica do preklica privolitve (čl. 7)', 'Kadar koli in brez posledic prekličete privolitev za katero koli obdelavo, ki na njej temelji. Preklic ne vpliva na zakonitost obdelave pred preklicem.'],
  ],
  s7end: 'Zahteve naslovite na info@tce.si. Imate tudi pravico do pritožbe pri Informacijskemu pooblaščencu RS, Dunajska cesta 22, 1000 Ljubljana, gp.ip@ip-rs.si, ip-rs.si.',

  s8title: '8. Piškotki',
  s8: 'Obrtdesk uporablja izključno tehnično nujne piškotke za upravljanje seje in avtentikacijo. Ne nastavljamo analitičnih, sledilnih ali oglaševalskih piškotkov, zato privolitev za piškotke ni potrebna.',

  s9title: '9. Spremembe te izjave',
  s9: 'To izjavo redno pregledujemo in posodabljamo. O bistvenih spremembah vas obvestimo vsaj 30 dni pred njihovo uveljavitvijo prek e-pošte ali obvestila v aplikaciji. Arhiv prejšnjih verzij je dostopen na zahtevo pri info@tce.si.',

  s10title: '10. Kontakt',
  s10: 'Za vsa vprašanja v zvezi z zasebnostjo nas kontaktirajte na',
  back: '← Nazaj na domačo stran',
}

const en = {
  title: 'Privacy Policy',
  updated: 'Last updated: July 2026',
  intro: `We protect your personal data in accordance with Regulation (EU) 2016/679 (GDPR), the Personal Data Protection Act (ZVOP-2) and other applicable data protection legislation. This policy applies to natural persons acting as business users of Obrtdesk — owners, directors, estimators, sales staff and other employees of manufacturing companies using the platform to prepare quotations and manage cost calculations.

Obrtdesk acts in two clearly distinct roles. As a controller, it processes your personal data for the purpose of providing and managing the services — this relationship is governed by this policy. As a processor, it processes contact and commercial data of your customers and business partners that you enter into the platform, on your instructions and on your behalf — you are responsible for that relationship as the data controller.`,

  s1title: '1. Data Controller',
  s1: `The data controller is TCE, d.o.o. For all questions regarding the processing of your personal data, contact us at info@tce.si. We respond to requests within 30 days.`,

  s2title: '2. What Data We Collect',
  s2cats: [
    {
      title: 'Account data',
      text: 'First name, last name, email address, password (stored exclusively in hashed form), company name, address, VAT ID and bank details for invoicing.',
    },
    {
      title: 'Customer data (processor role)',
      text: 'Customer name, contact person, email address, phone number, address and other commercial data you enter when creating customers in the platform. For this data you act as the controller — you are responsible for the lawfulness of its processing and for properly informing your customers.',
    },
    {
      title: 'Calculations and cost models',
      text: 'All cost calculations you create in the platform: cost line items, quantities, pieces, scrap, batch size, machining times and calculated selling prices. This data is your exclusive property and is processed solely to provide the service.',
    },
    {
      title: 'Machine and workstation data',
      text: 'Technical and cost parameters of your machines and workstations: hourly rate, energy costs, water, compressed air, maintenance, depreciation, tooling costs and available operating hours. Including machine model, year of purchase and value.',
    },
    {
      title: 'Labour rates',
      text: 'Labour categories with gross salary, social contributions, allowances and holiday pay — from which the platform calculates the effective hourly rate for use in calculations.',
    },
    {
      title: 'Material data',
      text: 'Name, unit, price per unit and supplier information for materials used in calculations.',
    },
    {
      title: 'Overhead costs',
      text: 'Annual costs by cost centre (management, marketing, R&D, administration, etc.) from which the platform calculates the overhead rate applied to each calculation.',
    },
    {
      title: 'Quotations and attachments',
      text: 'Created quotations with all line items, prices, terms, contact data and status (draft, issued, sent, won, lost). Attached files: technical drawings, specifications, models (PDF, DWG, SLDPRT, PNG and other formats).',
    },
    {
      title: 'Technical usage data',
      text: 'Access timestamps, IP address (for security purposes, pseudonymised after 30 days), operating system and browser. Audit trail of changes within the platform.',
    },
  ],

  s3title: '3. Why We Process Your Data',
  s3items: [
    {
      title: 'Account management and service delivery',
      text: 'Managing access, ensuring platform operation and all its features (calculations, quotations, customers, attachments, analytics).',
      basis: 'Contract (Art. 6(1)(b) GDPR)',
      retention: 'Full duration of the agreement; deleted within 30 days of termination.',
    },
    {
      title: 'Billing, invoicing and tax obligations',
      text: 'Processing payment, invoice and transaction data for subscription billing and fulfilment of tax and accounting obligations.',
      basis: 'Contract + legal obligation (Art. 6(1)(b) and (c) GDPR)',
      retention: '10 years under applicable tax law.',
    },
    {
      title: 'Customer support',
      text: 'Communication data from support interactions is retained for providing continuous support and resolving technical issues.',
      basis: 'Legitimate interest (Art. 6(1)(f) GDPR)',
      retention: '3 years after closure of each case.',
    },
    {
      title: 'Platform security and abuse prevention',
      text: 'Technical access data is processed to detect unauthorized access, prevent abuse and ensure secure platform operation.',
      basis: 'Legitimate interest (Art. 6(1)(f) GDPR)',
      retention: 'IP addresses pseudonymised after 30 days; security logs deleted after 12 months.',
    },
    {
      title: 'Analytics and service improvement',
      text: 'Aggregated and anonymised usage data is processed for developing new features and improving user experience.',
      basis: 'Legitimate interest (Art. 6(1)(f) GDPR)',
      retention: 'Anonymised data retained indefinitely; personal data for analytics up to 24 months.',
    },
    {
      title: 'Service communications',
      text: 'We occasionally inform existing customers about platform updates and new features. Your right to object under Art. 21 GDPR is honoured immediately and unconditionally.',
      basis: 'Legitimate interest (Art. 6(1)(f) GDPR)',
      retention: 'Until unsubscribe.',
    },
    {
      title: 'Establishing legal claims',
      text: 'In the event of legal disputes or regulatory proceedings, we retain relevant data for the purpose of establishing or defending legal claims.',
      basis: 'Legitimate interest (Art. 6(1)(f) GDPR)',
      retention: 'Until conclusion of proceedings and 5 years thereafter.',
    },
  ],

  s4title: '4. Who Processes Your Data',
  s4: `Your data is accessible only to a limited circle of persons at Obrtdesk — exclusively those who need the data to perform their duties. All are bound by confidentiality.

For certain services we use external processors with whom we have data processing agreements under Art. 28 GDPR:`,
  s4processors: [
    ['Supabase Inc.', 'Data storage and authentication', 'EU (Frankfurt, Germany)'],
    ['Vercel Inc.', 'Application hosting', 'EU / global CDN'],
  ],
  s4end: `We disclose your data to public authorities only when required by law. In legal disputes, we may disclose it to lawyers and courts to the extent necessary to protect legal interests.`,

  s5title: '5. International Data Transfers',
  s5: `Obrtdesk stores and processes data primarily within the European Union (Supabase Frankfurt, Vercel EU). Should any future infrastructure upgrade involve transfers of personal data outside the EEA, Obrtdesk will ensure this is done exclusively with appropriate safeguards (European Commission Standard Contractual Clauses under Implementing Decision 2021/914 or an adequacy decision).

You have the right to request information about the countries to which your data is transferred. Send your request to info@tce.si.`,

  s6title: '6. Data Security',
  s6: 'We protect your data with technical and organisational measures including:',
  s6items: [
    'Encryption of data in transit (TLS 1.2+) and at rest (AES-256)',
    'Access control based on the principle of least privilege (RBAC)',
    'Multi-factor authentication for infrastructure access',
    'Separate development and production environments, no production data in test environments',
    'Regular backups and restoration tests',
    'Centralised audit logs and alerting on suspicious activity',
  ],
  s6end: 'In the event of a security incident likely to result in a high risk to your rights and freedoms, we will notify you without undue delay in accordance with Art. 34 GDPR.',

  s7title: '7. Your Rights',
  s7intro: 'We respond to all requests within 30 days; for complex requests we reserve the right to extend by up to 2 months, of which we will notify you in advance.',
  s7items: [
    ['Right of access (Art. 15)', 'Request a copy of the personal data we process about you and information about the nature, purpose and scope of processing.'],
    ['Right to rectification (Art. 16)', 'Request correction of inaccurate or completion of incomplete personal data.'],
    ['Right to erasure (Art. 17)', 'Request deletion of your personal data where there is no longer a legal basis for processing. The right is subject to legal retention obligations (e.g. tax records).'],
    ['Right to restriction (Art. 18)', 'Request a temporary restriction on the processing of your data while any substantive disputes are resolved.'],
    ['Right to object (Art. 21)', 'Object to processing based on legitimate interest. Objection to processing for direct marketing purposes is absolute and unconditional — we honour it immediately.'],
    ['Right to portability (Art. 20)', 'Request your personal data in a structured, machine-readable format or their direct transfer to another controller.'],
    ['Right to withdraw consent (Art. 7)', 'Withdraw consent at any time and without consequences for any processing based on it. Withdrawal does not affect the lawfulness of processing before withdrawal.'],
  ],
  s7end: 'Submit requests to info@tce.si. You also have the right to lodge a complaint with the Information Commissioner of the Republic of Slovenia, Dunajska cesta 22, 1000 Ljubljana, gp.ip@ip-rs.si, ip-rs.si.',

  s8title: '8. Cookies',
  s8: 'Obrtdesk uses only technically necessary cookies for session management and authentication. We do not set analytics, tracking or advertising cookies, so cookie consent is not required.',

  s9title: '9. Changes to This Policy',
  s9: 'We regularly review and update this policy. We will notify you of significant changes at least 30 days before they take effect via email or an in-app notice. An archive of previous versions is available on request at info@tce.si.',

  s10title: '10. Contact',
  s10: 'For all privacy-related questions, contact us at',
  back: '← Back to home',
}

export default function PrivacyPage() {
  const { lang, setLang } = useLanguage()
  const t = lang === 'sl' ? sl : en
  const isSl = lang === 'sl'

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans">
      <nav className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-[1440px] mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/"><AppLogo size="sm" mono /></Link>
          <div className="flex items-center gap-2">
            <div className="flex gap-0.5 mr-1">
              {(['en', 'sl'] as const).map(lng => (
                <button key={lng} onClick={() => setLang(lng)}
                  className={`px-2 py-1 rounded text-xs font-medium transition-colors ${lang === lng ? 'bg-gray-100 text-gray-900' : 'text-gray-400 hover:text-gray-700'}`}>
                  {lng.toUpperCase()}
                </button>
              ))}
            </div>
            <Link to="/login"
              className="hidden md:block text-sm text-gray-600 hover:text-gray-900 font-medium transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50 border border-gray-200">
              {isSl ? 'Prijava' : 'Sign in'}
            </Link>
            <Link to="/register"
              className="hidden sm:block bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap">
              {isSl ? 'Začnite brezplačno' : 'Get started free'}
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-bold text-gray-900 mb-2">{t.title}</h1>
        <p className="text-gray-400 text-sm mb-10">{t.updated}</p>

        <div className="space-y-10 text-gray-600 leading-relaxed">

          {/* Intro */}
          <div className="space-y-3">
            {t.intro.split('\n\n').map((p, i) => <p key={i}>{p}</p>)}
          </div>

          {/* 1 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.s1title}</h2>
            {t.s1.split('\n\n').map((p, i) => <p key={i} className={i > 0 ? 'mt-3' : ''}>{p}</p>)}
          </section>

          {/* 2 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.s2title}</h2>
            <div className="space-y-4">
              {t.s2cats.map((c, i) => (
                <div key={i} className="pl-4 border-l-2 border-gray-200">
                  <p className="font-medium text-gray-800 mb-1">{c.title}</p>
                  <p className="text-sm">{c.text}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 3 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-4">{t.s3title}</h2>
            <div className="space-y-6">
              {t.s3items.map((item, i) => (
                <div key={i}>
                  <p className="font-medium text-gray-800 mb-1">{item.title}</p>
                  <p>{item.text}</p>
                  <p className="mt-1 text-sm text-gray-400">{isSl ? 'Pravna podlaga' : 'Legal basis'}: {item.basis}. {isSl ? 'Hramba' : 'Retention'}: {item.retention}</p>
                </div>
              ))}
            </div>
          </section>

          {/* 4 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.s4title}</h2>
            {t.s4.split('\n\n').map((p, i) => <p key={i} className={i > 0 ? 'mt-3' : ''}>{p}</p>)}
            <ul className="list-disc pl-6 space-y-1 mt-3">
              {t.s4processors.map(([p, purp, loc], i) => (
                <li key={i}><strong>{p}</strong> — {purp} ({loc})</li>
              ))}
            </ul>
            <p className="mt-3">{t.s4end}</p>
          </section>

          {/* 5 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.s5title}</h2>
            {t.s5.split('\n\n').map((p, i) => <p key={i} className={i > 0 ? 'mt-3' : ''}>{p}</p>)}
          </section>

          {/* 6 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.s6title}</h2>
            <p className="mb-3">{t.s6}</p>
            <ul className="list-disc pl-6 space-y-1">
              {t.s6items.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
            <p className="mt-4">{t.s6end}</p>
          </section>

          {/* 7 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.s7title}</h2>
            <p className="mb-4">{t.s7intro}</p>
            <div className="space-y-3">
              {t.s7items.map(([right, desc], i) => (
                <div key={i} className="flex gap-2">
                  <span className="font-medium text-gray-800 shrink-0">{right} —</span>
                  <span>{desc}</span>
                </div>
              ))}
            </div>
            <p className="mt-4">{t.s7end.split('ip-rs.si.')[0]}<a href="https://www.ip-rs.si" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">ip-rs.si</a>.</p>
          </section>

          {/* 8 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.s8title}</h2>
            <p>{t.s8}</p>
          </section>

          {/* 9 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.s9title}</h2>
            <p>{t.s9}</p>
          </section>

          {/* 10 */}
          <section>
            <h2 className="text-xl font-semibold text-gray-900 mb-3">{t.s10title}</h2>
            <p>{t.s10} <a href="mailto:info@tce.si" className="text-blue-600 hover:underline">info@tce.si</a>.</p>
          </section>

        </div>

        <div className="mt-12 pt-8 border-t border-gray-200">
          <Link to="/" className="text-sm text-blue-600 hover:underline">{t.back}</Link>
        </div>
      </div>
    </div>
  )
}
