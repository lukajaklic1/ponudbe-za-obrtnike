import { Link } from 'react-router-dom'
import { useLanguage } from '../hooks/useLanguage'
import AppLogo from '../components/ui/AppLogo'

function H1({ children }: { children: React.ReactNode }) {
  return <h1 className="text-xl font-bold mt-10 mb-3 text-gray-900 dark:text-white border-b border-gray-200 dark:border-gray-700 pb-2">{children}</h1>
}
function H2({ children }: { children: React.ReactNode }) {
  return <h2 className="text-base font-semibold mt-7 mb-2 text-gray-800 dark:text-gray-100">{children}</h2>
}
function P({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed mb-3">{children}</p>
}
function Ul({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside mb-3 space-y-1">
      {items.map((item, i) => (
        <li key={i} className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">{item}</li>
      ))}
    </ul>
  )
}
function Table({ headers, rows }: { headers: string[]; rows: string[][] }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="min-w-full text-sm border border-gray-200 dark:border-gray-700 rounded">
        <thead className="bg-gray-50 dark:bg-gray-800">
          <tr>{headers.map((h, i) => <th key={i} className="px-3 py-2 text-left font-medium text-gray-700 dark:text-gray-200 border-b border-gray-200 dark:border-gray-700">{h}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-gray-100 dark:border-gray-800">
              {row.map((cell, j) => <td key={j} className="px-3 py-2 text-gray-700 dark:text-gray-300 align-top">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

export default function TermsPage() {
  const { lang, setLang } = useLanguage()
  const sl = lang === 'sl'

  return (
    <div className="min-h-screen bg-white text-gray-900 font-sans antialiased">
      {/* Nav — same as landing page */}
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
              {sl ? 'Prijava' : 'Sign in'}
            </Link>
            <Link to="/register"
              className="hidden sm:block bg-gray-900 text-white text-sm font-semibold px-4 py-2 rounded-lg hover:bg-gray-700 transition-colors whitespace-nowrap">
              {sl ? 'Začnite brezplačno' : 'Get started free'}
            </Link>
          </div>
        </div>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-10">
        {/* Header */}
        <H1>{sl ? 'SPLOŠNI POGOJI UPORABE STORITVE TOOLINGDESK' : 'TOOLINGDESK TERMS OF SERVICE'}</H1>
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 mb-6 text-sm text-gray-600 dark:text-gray-400 space-y-1">
          <div><strong>{sl ? 'Različica:' : 'Version:'}</strong> Beta</div>
          <div><strong>{sl ? 'Datum začetka veljavnosti:' : 'Effective date:'}</strong> {sl ? '8. avgust 2026' : '8 August 2026'}</div>
          <div><strong>{sl ? 'Ponudnik:' : 'Provider:'}</strong> Bimetric</div>
          <div><strong>{sl ? 'Kontakt:' : 'Contact:'}</strong> info@bimetric.si</div>
          <div><strong>{sl ? 'Storitev:' : 'Service:'}</strong> Obrtdesk</div>
        </div>

        {/* I */}
        <H1>{sl ? 'I. SPLOŠNE DOLOČBE' : 'I. GENERAL PROVISIONS'}</H1>

        <H2>{sl ? '1. člen – Predmet in obseg pogojev' : 'Article 1 – Scope and subject matter'}</H2>
        <P>{sl ? '(1) Ti splošni pogoji uporabe (v nadaljevanju: »Pogoji«) urejajo dostop do in uporabo spletne programske rešitve Obrtdesk, vključno z njenimi spletnimi aplikacijami, uporabniškimi vmesniki, funkcionalnostmi, izračuni, dokumentacijo, izvozi, integracijami, programskimi vmesniki ter drugimi povezanimi storitvami, ki jih Ponudnik omogoči uporabnikom (skupaj: »Storitev« ali »Obrtdesk«).' : '(1) These Terms of Service ("Terms") govern access to and use of the Obrtdesk web-based software solution, including its web applications, user interfaces, features, calculations, documentation, exports, integrations, APIs and other related services made available by the Provider (together, the "Service" or "Obrtdesk").'}</P>
        <P>{sl ? '(2) Pogoji predstavljajo pogodbeno razmerje med Ponudnikom in poslovnim subjektom oziroma drugo osebo, ki Storitev uporablja v okviru svoje poslovne, poklicne ali pridobitne dejavnosti (v nadaljevanju: »Naročnik«). Posamezna fizična oseba, ki uporablja Storitev v imenu Naročnika, je »Uporabnik«.' : '(2) These Terms form a contractual relationship between the Provider and a business entity or other person using the Service in the course of a business, professional or commercial activity ("Customer"). An individual using the Service on behalf of a Customer is a "User".'}</P>
        <P>{sl ? '(3) Z registracijo računa, potrditvijo teh Pogojev ali uporabo Storitev Naročnik in Uporabnik potrjujeta, da sta Pogoje prebrala, jih razumeta in se z njimi strinjata.' : '(3) By registering an account, accepting these Terms or using the Service, the Customer and User confirm that they have read, understood and accepted these Terms.'}</P>
        <P>{sl ? '(4) Če Uporabnik uporablja Storitev za pravno osebo, samostojnega podjetnika ali drug poslovni subjekt, izjavlja, da ima ustrezno pooblastilo, da ta subjekt zaveže k tem Pogojem.' : '(4) If a User uses the Service on behalf of a legal entity, sole trader or other business, the User represents that they are authorised to bind that entity to these Terms.'}</P>
        <P>{sl ? '(5) Morebitni individualni pisni dogovor med Ponudnikom in Naročnikom ima prednost pred temi Pogoji v delu, v katerem izrecno določa drugače.' : '(5) Any individually negotiated written agreement between the Provider and the Customer prevails over these Terms to the extent it expressly provides otherwise.'}</P>
        <P>{sl ? '(6) Storitev je namenjena izključno uporabi med poslovnimi subjekti oziroma za poslovne, poklicne, proizvodne, inženirske, kalkulacijske ali komercialne namene (»B2B«). Fizična oseba se lahko tehnično registrira ali uporablja Storitev, vendar z uporabo izjavlja, da jo uporablja v okviru poslovne ali poklicne dejavnosti in ne kot potrošnik za zasebne ali gospodinjske namene.' : '(6) The Service is intended exclusively for business-to-business ("B2B") use in connection with a business, professional, manufacturing, engineering, estimating or commercial activity. A natural person may technically register or use the Service, but by doing so represents that the Service is being used for business or professional purposes and not as a consumer for private or household purposes.'}</P>

        <H2>{sl ? '2. člen – Opredelitev pojmov' : 'Article 2 – Definitions'}</H2>
        <P>{sl ? '(1) »Ponudnik« pomeni Bimetric, kontakt info@bimetric.si.' : '(1) "Provider" means Bimetric, contact info@bimetric.si.'}</P>
        <P>{sl ? '(2) »Naročnik« pomeni poslovni subjekt ali drugega poslovnega uporabnika, za katerega se ustvari ali uporablja račun Obrtdesk.' : '(2) "Customer" means a business entity or other business user for whom a Obrtdesk account is created or used.'}</P>
        <P>{sl ? '(3) »Uporabnik« pomeni fizično osebo, ki jo Naročnik pooblasti za uporabo Storitev.' : '(3) "User" means an individual authorised by the Customer to use the Service.'}</P>
        <P>{sl ? '(4) »Račun« pomeni uporabniški oziroma organizacijski račun Obrtdesk.' : '(4) "Account" means a user or organisation account in Obrtdesk.'}</P>
        <P>{sl ? '(5) »Uporabniški podatki« pomenijo vse podatke, vsebine, dokumente, datoteke, zapise in informacije, ki jih Naročnik ali Uporabnik vnese, naloži, ustvari, shrani, uvozi ali drugače obdela prek Storitev.' : '(5) "Customer Data" means all data, content, documents, files, records and information entered, uploaded, created, stored, imported or otherwise processed through the Service by or on behalf of the Customer.'}</P>
        <P>{sl ? '(6) »Proizvodni podatki« pomenijo zlasti podatke o izdelkih, materialih, dimenzijah, količinah, strojih, operacijah, časih, urnih postavkah, stroških dela, orodjih, režijskih stroških, cenah, kupcih, dobaviteljih, maržah, pribitkih in tehnoloških postopkih.' : '(6) "Manufacturing Data" includes product, material, dimension, quantity, machine, operation, cycle-time, labour-rate, tooling-cost, overhead, price, customer, supplier, margin, markup and process data.'}</P>
        <P>{sl ? '(7) »Tehnična dokumentacija« pomeni CAD, STEP, DXF, PDF, risbe, modele, specifikacije, kosovnice, fotografije in druge tehnične datoteke.' : '(7) "Technical Documentation" means CAD, STEP, DXF, PDF, drawings, models, specifications, bills of materials, photographs and other technical files.'}</P>
        <P>{sl ? '(8) »Predkalkulacija« pomeni izračun ali oceno stroškov, časa, cen, pribitkov, marž oziroma drugih ekonomskih ali proizvodnih parametrov.' : '(8) "Cost Estimate" means a calculation or estimate of costs, times, prices, markups, margins or other economic or manufacturing parameters.'}</P>
        <P>{sl ? '(9) »Ponudba« pomeni dokument ali drug rezultat, ki ga Uporabnik pripravi s pomočjo Storitev za lastne poslovne namene ali za posredovanje tretji osebi.' : '(9) "Quote" means a document or other output prepared with the Service for the Customer\'s business purposes or for delivery to a third party.'}</P>
        <P>{sl ? '(10) »Rezultat« pomeni vsak izračun, prikaz, poročilo, predlog, oceno ali drug izhod, ustvarjen v Storitev.' : '(10) "Output" means any calculation, display, report, proposal, estimate or other output created by the Service.'}</P>
        <P>{sl ? '(11) »Beta Storitev« pomeni funkcionalnost ali celotno Storitev, ki je še v testiranju, razvoju ali zgodnji uporabi ter za katero Ponudnik ne zagotavlja enake stopnje stabilnosti, razpoložljivosti ali podpore kot pri morebitni kasnejši komercialni različici.' : '(11) "Beta Service" means a feature or the Service as a whole that is still under testing, development or early use and for which the Provider does not guarantee the same level of stability, availability or support as a later commercial release.'}</P>
        <P>{sl ? '(12) »Podobdelovalec« pomeni tretjo osebo, ki za Ponudnika obdeluje osebne podatke, kadar Ponudnik nastopa kot obdelovalec po GDPR.' : '(12) "Subprocessor" means a third party processing personal data for the Provider where the Provider acts as a processor under the GDPR.'}</P>

        {/* II */}
        <H1>{sl ? 'II. PRAVICA UPORABE IN UPORABNIŠKI RAČUNI' : 'II. RIGHT TO USE AND USER ACCOUNTS'}</H1>

        <H2>{sl ? '3. člen – Pravica uporabe' : 'Article 3 – Right to use'}</H2>
        <P>{sl ? '(1) Ob upoštevanju teh Pogojev Ponudnik Naročniku za čas veljavnega dostopa podeljuje omejeno, preklicno, neizključno, neprenosljivo in nepodlicenčno pravico do uporabe Storitev za interne poslovne namene.' : '(1) Subject to these Terms, the Provider grants the Customer a limited, revocable, non-exclusive, non-transferable and non-sublicensable right to use the Service for internal business purposes during the period in which access is valid.'}</P>
        <P>{sl ? '(2) Ta pravica ne pomeni prenosa lastništva programske opreme, izvorne kode, arhitekture, podatkovnega modela, grafičnega vmesnika, metod, algoritmov, blagovnih znamk ali drugih pravic intelektualne lastnine Ponudnika.' : '(2) This right does not transfer ownership of the software, source code, architecture, data model, user interface, methods, algorithms, trademarks or other intellectual property rights of the Provider.'}</P>
        <P>{sl ? '(3) Naročnik Storitev ne sme preprodajati, oddajati v najem, zagotavljati kot lastno SaaS storitev, uporabljati kot storitveni biro ali dati na voljo za razvoj neposredno konkurenčnega produkta brez predhodnega pisnega soglasja Ponudnika.' : '(3) The Customer may not resell, rent, provide as its own SaaS service, operate as a service bureau or use the Service to develop a directly competing product without the Provider\'s prior written consent.'}</P>
        <P>{sl ? '(4) Naročnik lahko rezultate, ponudbe, poročila in druge dokumente, ki jih ustvari s Storitev, uporablja za svoje poslovanje ter jih posreduje svojim kupcem, dobaviteljem, svetovalcem in poslovnim partnerjem.' : '(4) The Customer may use and share quotes, reports and other outputs created with the Service for its normal business operations.'}</P>

        <H2>{sl ? '4. člen – Registracija in varnost računa' : 'Article 4 – Registration and account security'}</H2>
        <P>{sl ? '(1) Za uporabo Storitev je lahko potrebna registracija. Naročnik zagotavlja, da so podatki, vneseni ob registraciji, točni, popolni in ažurni.' : '(1) Registration may be required. The Customer must ensure that registration information is accurate, complete and current.'}</P>
        <P>{sl ? '(2) Naročnik je odgovoren za določanje oseb, ki lahko dostopajo do njegovega Računa, za dodeljevanje ustreznih pravic ter za pravočasno ukinitev dostopa.' : '(2) The Customer is responsible for determining who may access its Account, assigning appropriate permissions and promptly removing access when no longer required.'}</P>
        <P>{sl ? '(3) Uporabniki morajo varovati prijavne podatke in jih ne smejo neupravičeno posredovati tretjim osebam.' : '(3) Users must keep credentials confidential and must not improperly disclose them to third parties.'}</P>
        <P>{sl ? '(4) Naročnik mora Ponudnika brez nepotrebnega odlašanja obvestiti o sumu nepooblaščenega dostopa, kraji poverilnic ali drugi zlorabi Računa.' : '(4) The Customer must notify the Provider without undue delay of suspected unauthorised access, stolen credentials or other misuse.'}</P>
        <P>{sl ? '(5) Naročnik je odgovoren za dejanja svojih pooblaščenih Uporabnikov.' : '(5) The Customer is responsible for the actions of its authorised Users.'}</P>

        <H2>{sl ? '5. člen – Prepovedana uporaba' : 'Article 5 – Prohibited use'}</H2>
        <P>{sl ? '(1) Storitev se sme uporabljati le zakonito in v skladu z njenim namenom.' : '(1) The Service may be used only lawfully and for its intended purpose.'}</P>
        <P>{sl ? '(2) Brez predhodnega pisnega dovoljenja Ponudnika ni dovoljeno:' : '(2) Without the Provider\'s prior written permission, the Customer must not:'}</P>
        <Ul items={sl ? [
          'izvajati povratnega inženirstva, dekompilacije ali razstavljanja, razen kjer tega po prisilnem pravu ni dovoljeno omejiti;',
          'obiti varnostnih ali tehničnih omejitev;',
          'izvajati scraping, avtomatizirano masovno pridobivanje podatkov ali nesorazmerno obremenjevanje Storitev;',
          'izvajati nepooblaščeno varnostno testiranje, napade ali razširjati zlonamerno kodo;',
          'nalagati nezakonite vsebine ali vsebine, za katere Naročnik nima ustreznih pravic;',
          'uporabljati Storitev za goljufijo, kršitev sankcij, izvoznih omejitev ali drugih predpisov;',
          'lažno predstavljati identiteto druge osebe ali organizacije.',
        ] : [
          'reverse engineer, decompile or disassemble the Service except where such restriction is unenforceable under mandatory law;',
          'bypass security or technical restrictions;',
          'perform scraping, automated bulk extraction or disproportionate load generation;',
          'conduct unauthorised security testing, attacks or distribute malicious code;',
          'upload unlawful content or content for which the Customer lacks sufficient rights;',
          'use the Service for fraud, sanctions violations, export-control violations or other unlawful activity;',
          'impersonate another person or organisation.',
        ]} />
        <P>{sl ? '(3) Ponudnik lahko ob utemeljenem sumu kršitve začasno omeji dostop, če je to razumno potrebno za zaščito Storitev, podatkov, drugih uporabnikov ali tretjih oseb.' : '(3) The Provider may temporarily restrict access where there is a reasonable suspicion of a breach and restriction is reasonably necessary to protect the Service, data, other users or third parties.'}</P>

        {/* III */}
        <H1>{sl ? 'III. INTELEKTUALNA LASTNINA, PODATKI IN ZAUPNOST' : 'III. INTELLECTUAL PROPERTY, DATA AND CONFIDENTIALITY'}</H1>

        <H2>{sl ? '6. člen – Intelektualna lastnina' : 'Article 6 – Intellectual property'}</H2>
        <P>{sl ? '(1) Obrtdesk, njegova programska koda, arhitektura, podatkovni modeli, uporabniški vmesnik, grafični elementi, dokumentacija, metodologije, funkcionalnosti in drugi elementi, ki niso Uporabniški podatki, so last Ponudnika oziroma njegovih licencodajalcev.' : '(1) Obrtdesk, its software code, architecture, data models, user interface, graphical elements, documentation, methodologies and features, excluding Customer Data, are owned by the Provider or its licensors.'}</P>
        <P>{sl ? '(2) Nobena določba teh Pogojev na Naročnika ne prenaša lastninske ali druge pravice intelektualne lastnine, razen omejene pravice uporabe, izrecno določene v teh Pogojih.' : '(2) Nothing in these Terms transfers intellectual property rights to the Customer except for the limited right of use expressly granted.'}</P>
        <P>{sl ? '(3) Naročnik ne sme odstraniti oznak avtorskih pravic, blagovnih znamk ali drugih obvestil o lastništvu.' : '(3) The Customer must not remove copyright, trademark or proprietary notices.'}</P>
        <P>{sl ? '(4) Ponudnik lahko povratne informacije, predloge in ideje Uporabnikov uporabi za razvoj in izboljšanje Storitev, če pri tem ne razkrije zaupnih informacij Naročnika.' : '(4) The Provider may use feedback, suggestions and ideas for development and improvement, provided it does not disclose the Customer\'s Confidential Information.'}</P>
        <P>{sl ? '(5) Ponudnik naziva, blagovne znamke ali logotipa Naročnika ne bo objavil kot reference ali promocijskega gradiva brez ločenega predhodnega soglasja Naročnika.' : '(5) The Provider will not publish the Customer\'s name, trademark or logo as a customer reference or promotional material without the Customer\'s separate prior consent.'}</P>

        <H2>{sl ? '7. člen – Lastništvo Uporabniških podatkov' : 'Article 7 – Ownership of Customer Data'}</H2>
        <P>{sl ? '(1) Vse pravice na Uporabniških podatkih ostanejo Naročniku oziroma njihovim zakonitim imetnikom.' : '(1) All rights in Customer Data remain with the Customer or their lawful owners.'}</P>
        <P>{sl ? '(2) Ponudnik ne pridobi lastništva nad ceniki, kupci, dobavitelji, predkalkulacijami, ponudbami, proizvodnimi parametri, tehnično dokumentacijo ali drugimi poslovnimi podatki Naročnika.' : '(2) The Provider does not acquire ownership of customer lists, supplier lists, quotes, cost estimates, manufacturing parameters, technical documentation or other business data.'}</P>
        <P>{sl ? '(3) Naročnik Ponudniku podeljuje zgolj omejeno pravico obdelave Uporabniških podatkov, ki je potrebna za gostovanje, prikazovanje, prenos, varnostno obdelavo, podporo in zagotavljanje funkcionalnosti Storitev.' : '(3) The Customer grants the Provider only the limited processing rights necessary to host, display, transmit, secure, support and provide the functionality of the Service.'}</P>
        <P>{sl ? '(4) Naročnik zagotavlja, da ima za podatke, ki jih vnese v Storitev, potrebne pravice in pravne podlage.' : '(4) The Customer represents that it has the rights and lawful bases required for data it submits.'}</P>
        <P>{sl ? '(5) Obrtdesk sam ne uporablja Uporabniških podatkov za treniranje modelov umetne inteligence in Uporabniških podatkov namensko ne pošilja ponudnikom AI zaradi treniranja modelov.' : '(5) Obrtdesk itself does not use Customer Data to train artificial-intelligence models and does not intentionally send Customer Data to AI providers for model training.'}</P>
        <P>{sl ? '(6) Ponudnik ne uporablja Supabase AI orodij ali Vercel AI produktov za vsebino Uporabniških podatkov kot del običajnega delovanja Obrtdesk. Supabase v svojih trenutnih Pogojih izrecno določa, da Customer Data, AI Input ali AI Output ne uporablja in tretjim ne dovoli uporabljati za treniranje, fine-tuning ali izboljšavo AI/ML modelov brez predhodnega pisnega soglasja stranke.' : '(6) The Provider does not use Supabase AI tools or Vercel AI products on Customer Data as part of Obrtdesk\'s ordinary operation. Supabase\'s current Terms expressly state that it will not use, or permit third parties to use, Customer Data, AI Input or AI Output to train, fine-tune or otherwise improve AI or machine-learning models without the customer\'s prior written consent.'}</P>
        <P>{sl ? '(7) Vercelova lastna Politika zasebnosti za določene Hobby/Pro kontekste dopušča uporabo nekaterih kategorij informacij za razvoj in treniranje AI, ob upoštevanju nastavitev oziroma možnosti opt-out, medtem ko se za podatke, ki jih Vercel obdeluje kot pogodbeni obdelovalec, uporablja njegov DPA. Obrtdesk ne namerava uporabniških tehničnih datotek ali kalkulacij posredovati Vercelovim AI produktom. Ker Ponudnik ne nadzoruje prihodnjih sprememb pravnih pogojev Vercel ali Supabase, se uporabljajo njihove vsakokrat veljavne politike in DPA v obsegu, v katerem so relevantni.' : '(7) Vercel\'s own Privacy Notice states that in certain Hobby/Pro contexts some categories of information may be used for AI product development and training subject to account preferences and opt-out controls, while data Vercel processes as a contractual processor is governed by its DPA. Obrtdesk does not intend to submit end-user technical files or estimates to Vercel AI products. Because the Provider does not control future changes to Vercel or Supabase legal terms, their then-current policies and DPAs apply where relevant.'}</P>

        <H2>{sl ? '8. člen – Zaupnost in poslovne skrivnosti' : 'Article 8 – Confidentiality and trade secrets'}</H2>
        <P>{sl ? '(1) Vsaka pogodbenica mora varovati zaupne informacije druge pogodbenice, s katerimi se seznani v povezavi z uporabo ali zagotavljanjem Storitev.' : '(1) Each party must protect the other party\'s Confidential Information obtained in connection with the Service.'}</P>
        <P>{sl ? '(2) Za zaupne informacije Naročnika se štejejo zlasti Proizvodni podatki, Tehnična dokumentacija, podatki o kupcih in dobaviteljih, cene, stroški, marže, urne postavke, proizvodni časi, komercialni pogoji, ponudbe, kalkulacije, tehnološki postopki in poslovni načrti.' : '(2) Customer Confidential Information includes in particular Manufacturing Data, Technical Documentation, customer and supplier information, prices, costs, margins, hourly rates, production times, commercial terms, quotes, calculations, manufacturing processes and business plans.'}</P>
        <P>{sl ? '(3) Prejemnik sme zaupne informacije uporabiti samo za izvajanje razmerja po teh Pogojih in jih razkriti le osebam, ki jih potrebujejo za ta namen in so zavezane k ustrezni zaupnosti.' : '(3) Confidential Information may be used only to perform the relationship under these Terms and disclosed only to persons who need it for that purpose and are subject to appropriate confidentiality obligations.'}</P>
        <P>{sl ? '(4) Obveznost zaupnosti ne velja za informacije, ki so zakonito javno znane, so bile prejemniku zakonito znane že pred razkritjem, so bile neodvisno razvite ali zakonito pridobljene od tretje osebe brez obveznosti zaupnosti.' : '(4) Confidentiality obligations do not apply to information lawfully public, lawfully known before disclosure, independently developed or lawfully received from a third party without confidentiality restriction.'}</P>
        <P>{sl ? '(5) Če razkritje zahteva zakon, sodišče ali pristojni organ, se informacije smejo razkriti v zahtevanem obsegu.' : '(5) Disclosure required by law, court order or competent authority is permitted to the required extent.'}</P>
        <P>{sl ? '(6) Ponudnik v okviru standardne ali brezplačne beta uporabe ni dolžan podpisati ločenega NDA, individualne pogodbe o zaupnosti ali naročnikovega obrazca. Naročnik lahko po lastni presoji naloži tehnično dokumentacijo, za katero ima ustrezna dovoljenja, pri čemer se za zaupnost uporabljajo ta določila. Če Naročnik za posamezne podatke potrebuje posebno pogodbeno raven zaupnosti ali individualen NDA, takih podatkov ne sme naložiti, dokler s Ponudnikom ni sklenjen ločen pisni dogovor.' : '(6) As part of the standard or free beta offering, the Provider is not required to sign a separate NDA, bespoke confidentiality agreement or Customer form. The Customer may upload technical documentation for which it has sufficient rights, subject to the confidentiality provisions in these Terms. If the Customer requires a specific contractual confidentiality standard or individual NDA for particular information, it must not upload that information unless a separate written agreement has first been entered into with the Provider.'}</P>

        {/* IV */}
        <H1>{sl ? 'IV. PREDKALKULACIJE, PONUDBE IN ODGOVORNOST UPORABNIKA' : 'IV. COST ESTIMATES, QUOTES AND CUSTOMER RESPONSIBILITY'}</H1>

        <H2>{sl ? '9. člen – Narava izračunov in rezultatov' : 'Article 9 – Nature of calculations and outputs'}</H2>
        <P>{sl ? '(1) Obrtdesk je programsko orodje za pomoč pri pripravi predkalkulacij, ocen stroškov in ponudb v proizvodnem okolju.' : '(1) Obrtdesk is a software tool assisting with cost estimates, cost calculations and quotation preparation in manufacturing environments.'}</P>
        <P>{sl ? '(2) Rezultati so odvisni od vhodnih podatkov, nastavitev, formul, predpostavk, konfiguracije in načina uporabe Storitev.' : '(2) Outputs depend on inputs, settings, formulas, assumptions, configuration and the manner in which the Service is used.'}</P>
        <P>{sl ? '(3) Ponudnik ne jamči, da posamezna Predkalkulacija ali Ponudba predstavlja dejanski končni strošek izdelave, dejanski proizvodni čas, tržno ceno, optimalno ceno ali ekonomsko donosnost posameznega posla.' : '(3) The Provider does not warrant that a Cost Estimate or Quote represents the actual final manufacturing cost, actual production time, market price, optimal price or profitability of a particular job.'}</P>
        <P>{sl ? '(4) Rezultati ne predstavljajo strokovnega, računovodskega, davčnega, pravnega, inženirskega ali drugega reguliranega svetovanja.' : '(4) Outputs do not constitute legal, tax, accounting, engineering or other regulated professional advice.'}</P>
        <P>{sl ? '(5) Avtomatski izračun ne nadomešča strokovne presoje tehnologa, kalkulanta, komercialista, vodje proizvodnje ali druge ustrezno usposobljene osebe.' : '(5) Automated calculations do not replace the professional judgment of a technologist, estimator, sales professional, production manager or other appropriately qualified person.'}</P>

        <H2>{sl ? '10. člen – Preverjanje pred uporabo' : 'Article 10 – Verification before use'}</H2>
        <P>{sl ? '(1) Naročnik je odgovoren za pravilnost in popolnost vnesenih podatkov, vključno s cenami materialov, strojnimi postavkami, stroški dela, časi operacij, stroški orodij, režijskimi stroški, maržami, popusti, davčnimi nastavitvami in drugimi vhodnimi podatki.' : '(1) The Customer is responsible for the accuracy and completeness of inputs, including material prices, machine rates, labour costs, operation times, tooling costs, overhead, margins, discounts, tax settings and other data.'}</P>
        <P>{sl ? '(2) Naročnik mora pred pošiljanjem Ponudbe tretji osebi preveriti vse bistvene izračune in komercialne podatke.' : '(2) Before sending a Quote to a third party, the Customer must verify all material calculations and commercial information.'}</P>
        <P>{sl ? '(3) Naročnik sam odloča, ali bo Rezultat uporabil kot podlago za poslovno odločitev, ponudbo, naročilo, nabavo ali proizvodnjo.' : '(3) The Customer decides whether and how to rely on an Output for business decisions, purchasing, production or contractual offers.'}</P>
        <P>{sl ? '(4) Ponudnik ne odgovarja za posledice, ki izvirajo iz nepreverjenih, napačnih, zastarelih ali nepopolnih vhodnih podatkov.' : '(4) The Provider is not responsible for consequences resulting from unverified, incorrect, outdated or incomplete input data.'}</P>
        <P>{sl ? '(5) Naročnik je odgovoren za končno vsebino in pravno zavezujočnost ponudb, ki jih pošlje svojim kupcem.' : '(5) The Customer is solely responsible for the final content and legal effect of quotes sent to its customers.'}</P>

        {/* V */}
        <H1>{sl ? 'V. BETA RAZLIČICA, RAZVOJ IN PODPORA' : 'V. BETA SERVICE, DEVELOPMENT AND SUPPORT'}</H1>

        <H2>{sl ? '11. člen – Beta različica' : 'Article 11 – Beta status'}</H2>
        <P>{sl ? '(1) Obrtdesk je v trenutni fazi brezplačna beta različica. Ponudnik namerava tudi po koncu beta obdobja ohraniti vsaj en brezplačen paket, vendar lahko njegov obseg, omejitve, kvote in vključene funkcionalnosti kadarkoli spremeni v skladu s temi Pogoji.' : '(1) Obrtdesk is currently provided as a free beta version. The Provider currently intends to retain at least one free plan after the beta period, but may change its scope, limits, quotas and included features in accordance with these Terms.'}</P>
        <P>{sl ? '(2) Beta različica je lahko nepopolna, vsebuje napake, nedokončane funkcionalnosti ali začasno drugačno uporabniško izkušnjo od kasnejše komercialne različice.' : '(2) The Beta Service may be incomplete, contain bugs, unfinished features or an experience different from a future commercial version.'}</P>
        <P>{sl ? '(3) Funkcionalnosti se lahko brez predhodnega obvestila dodajo, spremenijo, omejijo ali odstranijo.' : '(3) Features may be added, changed, restricted or removed.'}</P>
        <P>{sl ? '(4) Ponudnik ne jamči neprekinjenega delovanja Beta Storitev, določenega odzivnega časa, SLA ali minimalnega odstotka razpoložljivosti.' : '(4) No specific uptime, response time, SLA or minimum availability percentage is guaranteed during beta.'}</P>
        <P>{sl ? '(5) Uporaba beta različice je prostovoljna in Naročnik razume povečano tveganje napak, sprememb ali začasne nedostopnosti.' : '(5) Use of the Beta Service is voluntary and the Customer understands the increased risk of defects, changes or temporary unavailability.'}</P>

        <H2>{sl ? '12. člen – Podpora' : 'Article 12 – Support'}</H2>
        <P>{sl ? '(1) Ponudnik si bo prizadeval nuditi osnovno podporo prek objavljenih kontaktnih kanalov, zlasti prek info@bimetric.si.' : '(1) The Provider will use reasonable efforts to provide basic support through published contact channels, including info@bimetric.si.'}</P>
        <P>{sl ? '(2) V beta obdobju ni zagotovljen določen odzivni čas ali čas odprave napake.' : '(2) No guaranteed response or resolution time applies during beta.'}</P>
        <P>{sl ? '(3) Ponudnik lahko zahteve razvršča po prioriteti glede na vpliv na delovanje Storitev, varnost in število prizadetih uporabnikov.' : '(3) The Provider may prioritise requests based on impact, security and the number of affected users.'}</P>
        <P>{sl ? '(4) Predlog funkcionalnosti, prijava napake ali zahtevek za podporo ne ustvarja obveznosti, da bo Ponudnik zahtevano funkcionalnost razvil ali napako odpravil v določenem roku.' : '(4) A feature request, bug report or support request does not create an obligation to implement or resolve it within a particular timeframe.'}</P>

        <H2>{sl ? '13. člen – Napake in vzdrževanje' : 'Article 13 – Defects and maintenance'}</H2>
        <P>{sl ? '(1) Ponudnik lahko izvaja redno ali izredno vzdrževanje, nadgradnje in varnostne posege.' : '(1) The Provider may perform regular or emergency maintenance, upgrades and security work.'}</P>
        <P>{sl ? '(2) Kadar je razumno mogoče, lahko Ponudnik o načrtovanih večjih prekinitvah obvesti Uporabnike vnaprej.' : '(2) Where reasonably possible, material planned interruptions may be notified in advance.'}</P>
        <P>{sl ? '(3) Kritične napake, ki preprečujejo običajno uporabo Storitev ali pomenijo varnostno tveganje, imajo praviloma prednost, vendar tudi zanje v beta obdobju ni zagotovljen pogodbeni rok odprave.' : '(3) Critical defects affecting ordinary use or security will generally receive priority, but no contractual remediation time applies during beta.'}</P>

        <H2>{sl ? '14. člen – Spremembe Storitev' : 'Article 14 – Changes to the Service'}</H2>
        <P>{sl ? '(1) Ponudnik lahko razvija, spreminja, nadomešča ali ukinja posamezne funkcionalnosti.' : '(1) The Provider may develop, modify, replace or discontinue features.'}</P>
        <P>{sl ? '(2) Ponudnik si bo pri bistvenih spremembah, ki znatno vplivajo na običajno uporabo Storitev, prizadeval zagotoviti razumno predhodno obvestilo, kadar je to izvedljivo.' : '(2) Where a material change substantially affects ordinary use, the Provider will use reasonable efforts to give advance notice where practicable.'}</P>
        <P>{sl ? '(3) Naročnik ni upravičen do ohranitve posamezne beta funkcionalnosti v nespremenjeni obliki.' : '(3) The Customer is not entitled to continued availability of any beta feature in unchanged form.'}</P>

        {/* VI */}
        <H1>{sl ? 'VI. RAZPOLOŽLJIVOST, INFRASTRUKTURA IN VARNOST' : 'VI. AVAILABILITY, INFRASTRUCTURE AND SECURITY'}</H1>

        <H2>{sl ? '15. člen – Razpoložljivost' : 'Article 15 – Availability'}</H2>
        <P>{sl ? '(1) Ponudnik si prizadeva zagotavljati razumno razpoložljivost Storitev, vendar ne zagotavlja neprekinjenega ali brezhibnega delovanja.' : '(1) The Provider seeks to maintain reasonable availability but does not guarantee uninterrupted or error-free operation.'}</P>
        <P>{sl ? '(2) Storitev je lahko začasno nedostopna zaradi vzdrževanja, napak, kibernetskih incidentov, težav ponudnikov infrastrukture, internetnih povezav, višje sile ali drugih okoliščin.' : '(2) The Service may be unavailable due to maintenance, defects, cybersecurity incidents, infrastructure-provider failures, internet issues, force majeure or other circumstances.'}</P>
        <P>{sl ? '(3) V brezplačni beta fazi se ne uporablja pogodbeni SLA, razen če je z Naročnikom pisno dogovorjeno drugače.' : '(3) No contractual SLA applies during the free beta unless agreed in writing.'}</P>

        <H2>{sl ? '16. člen – Tehnična infrastruktura, hramba datotek in lokacija obdelave' : 'Article 16 – Technical infrastructure, file storage and processing location'}</H2>
        <P>{sl ? '(1) Obrtdesk uporablja zunanje ponudnike infrastrukture in programske platforme.' : '(1) Obrtdesk relies on external infrastructure and software-platform providers.'}</P>
        <P>{sl ? '(2) Za gostovanje, izvajanje in dostavo spletne aplikacije Ponudnik uporablja Vercel, ki ga zagotavlja Vercel Inc., družba ustanovljena po pravu zvezne države Delaware, ZDA, 440 N Barranca Ave #4133, Covina, CA 91723, Združene države Amerike.' : '(2) Web application hosting, execution and delivery are provided through Vercel, provided by Vercel Inc., a Delaware corporation, 440 N Barranca Ave #4133, Covina, CA 91723, United States.'}</P>
        <P>{sl ? '(3) Za PostgreSQL podatkovno bazo, avtentikacijo, shranjevanje datotek in povezane backend storitve Ponudnik uporablja Supabase, ki ga zagotavlja SUPABASE PTE. LTD., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, Singapore.' : '(3) PostgreSQL database, authentication, file storage and related backend services are provided through Supabase, provided by SUPABASE PTE. LTD., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, Singapore.'}</P>
        <P>{sl ? '(4) Uporabniki lahko v Obrtdesk nalagajo CAD, STEP, DXF, PDF in druge podprte tehnične ali poslovne datoteke. Če Uporabnik datoteke ne izbriše in Račun ostane aktiven, je namen Storitev, da se take datoteke hranijo kot del Uporabniških podatkov, dokler so potrebne za uporabo Storitev. To ne pomeni jamstva trajne ali neskončne hrambe in ne nadomešča Naročnikove lastne arhivske kopije.' : '(4) Users may upload CAD, STEP, DXF, PDF and other supported technical or business files. If a User does not delete a file and the Account remains active, the Service is intended to retain such files as Customer Data for as long as they are needed for use of the Service. This is not a guarantee of permanent or indefinite retention and does not replace the Customer\'s own archival copy.'}</P>
        <P>{sl ? '(5) Supabase vsak projekt namesti v eno primarno regijo. Supabase trenutno omogoča splošno evropsko regijo Central EU (Frankfurt) in več specifičnih evropskih AWS regij, med drugim Ireland, London, Paris, Frankfurt, Zurich in Stockholm. Natančna primarna regija konkretnega Obrtdesk Supabase projekta je tehnična nastavitev projekta in je ni mogoče zanesljivo ugotoviti samo iz javnih pogojev Supabase; zato Obrtdesk ne daje izjave, da se vsi podatki hranijo izključno v Sloveniji ali izključno v EGP, dokler ta nastavitev ni posebej potrjena.' : '(5) Supabase deploys each project to one primary region. Supabase currently offers a general Central EU (Frankfurt) region and several specific European AWS regions, including Ireland, London, Paris, Frankfurt, Zurich and Stockholm. The exact primary region of the specific Obrtdesk Supabase project is a project-level technical setting and cannot reliably be determined from Supabase\'s public legal terms alone; Obrtdesk therefore does not represent that all data is stored exclusively in Slovenia or exclusively in the EEA unless and until that configuration is separately verified.'}</P>
        <P>{sl ? '(6) Ne glede na primarno regijo projekta Supabase v svoji politiki zasebnosti navaja, da lahko osebne podatke hrani na strežnikih v ZDA ali drugih državah, kjer imajo Supabase, njegove povezane osebe, agenti ali izvajalci infrastrukturo. Supabase za prenose, kjer je to potrebno, vključuje standardne pogodbene klavzule Evropske komisije v svoj DPA.' : '(6) Irrespective of the project\'s primary region, Supabase states in its Privacy Notice that it may store personal information on servers in the United States or other countries where Supabase, its affiliates, agents or contractors maintain facilities. Its DPA incorporates European Commission Standard Contractual Clauses where required for covered transfers.'}</P>
        <P>{sl ? '(7) Vercel v svojem DPA navaja, da so njegove primarne lokacije obdelave v ZDA in da lahko podatke obdeluje tudi drugje po svetu, kjer Vercel ali njegovi podobdelovalci izvajajo obdelavo, ob uporabi ustreznih pravnih mehanizmov za mednarodne prenose.' : '(7) Vercel states in its DPA that its primary processing facilities are in the United States and that it may process data elsewhere in the world where Vercel or its subprocessors operate, subject to applicable international-transfer safeguards.'}</P>
        <P>{sl ? '(8) Vercel in Supabase lahko uporabljata lastne podobdelovalce in infrastrukturo tretjih oseb. Njuni seznami podobdelovalcev, regije in pravni dokumenti se lahko spremenijo.' : '(8) Vercel and Supabase may use their own subprocessors and third-party infrastructure. Their subprocessor lists, regions and legal documentation may change over time.'}</P>
        <P>{sl ? '(9) Ponudnik lahko v prihodnje zamenja ali doda infrastrukturnega ponudnika, če je sprememba skladna z veljavno zakonodajo in je zagotovljena ustrezna raven varstva osebnih podatkov.' : '(9) The Provider may replace or add infrastructure providers in the future where the change complies with applicable law and maintains appropriate personal-data safeguards.'}</P>

        <H2>{sl ? '17. člen – Varnost informacij' : 'Article 17 – Information security'}</H2>
        <P>{sl ? '(1) Ponudnik izvaja razumne tehnične in organizacijske ukrepe glede na naravo Storitev, razpoložljive tehnologije, stroške izvajanja in tveganja.' : '(1) The Provider implements reasonable technical and organisational measures taking into account the nature of the Service, available technology, implementation costs and risks.'}</P>
        <P>{sl ? '(2) Ukrepi lahko vključujejo nadzor dostopa, ločevanje uporabnikov in organizacij, šifriran transport podatkov, upravljanje poverilnic, beleženje dogodkov, posodobitve, omejitve dostopa in uporabo varnostnih funkcij infrastrukturnih ponudnikov.' : '(2) Measures may include access controls, tenant separation, encryption in transit, credential management, logging, updates, least-privilege controls and security features supplied by infrastructure providers.'}</P>
        <P>{sl ? '(3) Noben informacijski sistem ni popolnoma varen. Ponudnik ne jamči absolutne varnosti pred vsemi napadi, napakami ali nepooblaščenimi posegi.' : '(3) No information system is completely secure. The Provider does not warrant absolute protection against all attacks, defects or unauthorised activity.'}</P>
        <P>{sl ? '(4) Naročnik mora sam izvajati ustrezne varnostne ukrepe na svojih napravah, računih, omrežjih in pri upravljanju dostopov.' : '(4) The Customer must apply appropriate security controls to its own devices, accounts, networks and user access.'}</P>

        <H2>{sl ? '18. člen – Varnostne kopije in obnova' : 'Article 18 – Backups and recovery'}</H2>
        <P>{sl ? '(1) Ponudnik trenutno uporablja Supabase Free načrt. Po javno objavljenih trenutnih podatkih Supabase samodejne varnostne kopije podatkovne baze na Free načrtu niso vključene. Ponudnik zato ne zagotavlja obnovitve podatkov iz backupa, point-in-time recovery ali določenega obdobja hrambe varnostnih kopij.' : '(1) The Provider currently uses the Supabase Free plan. According to Supabase\'s current published plan information, automatic database backups are not included in the Free plan. The Provider therefore does not guarantee backup restoration, point-in-time recovery or any defined backup-retention period.'}</P>
        <P>{sl ? '(2) Supabase priporoča uporabnikom brezplačnega načrta, da sami redno izvažajo podatke in vzdržujejo zunanje varnostne kopije. Obrtdesk trenutno ne zagotavlja avtomatiziranega celovitega izvoza vseh podatkov, zato je Naročnik odgovoren, da poslovno kritične podatke in izvorno tehnično dokumentacijo po potrebi hrani tudi v lastnih sistemih.' : '(2) Supabase recommends that Free-tier users regularly export their own data and maintain off-site backups. Obrtdesk does not currently provide a complete automated self-service export of all data, so the Customer remains responsible for retaining business-critical data and original technical documentation in its own systems where appropriate.'}</P>
        <P>{sl ? '(3) Če Ponudnik v prihodnje preide na plačljiv načrt z avtomatskimi backupi ali uvede lasten backup režim, se lahko ta člen ustrezno posodobi.' : '(3) If the Provider later upgrades to a paid plan with automatic backups or implements an independent backup regime, this Article may be updated accordingly.'}</P>
        <P>{sl ? '(4) Dejstvo, da se datoteka ali podatek hrani v primarnem sistemu Supabase Storage oziroma podatkovni bazi, ne pomeni, da obstaja ločena varnostna kopija.' : '(4) The fact that a file or record is stored in primary Supabase Storage or the database does not mean that a separate backup exists.'}</P>

        <H2>{sl ? '19. člen – Tretje storitve in odvisnosti' : 'Article 19 – Third-party dependencies'}</H2>
        <P>{sl ? '(1) Delovanje Obrtdesk je lahko odvisno od Vercel, Supabase, ponudnikov DNS, e-pošte, internetnih omrežij in drugih tretjih storitev.' : '(1) Obrtdesk may depend on Vercel, Supabase, DNS providers, email providers, internet networks and other third-party services.'}</P>
        <P>{sl ? '(2) Ponudnik ne nadzoruje vseh dejanj, napak, izpadov ali sprememb takih tretjih ponudnikov.' : '(2) The Provider does not control all acts, defects, outages or changes of those third parties.'}</P>
        <P>{sl ? '(3) Kadar izpad ali napaka tretje storitve bistveno vpliva na Obrtdesk, si bo Ponudnik prizadeval stanje odpraviti ali najti razumno alternativno rešitev, če je to tehnično in ekonomsko izvedljivo.' : '(3) Where a third-party outage materially affects Obrtdesk, the Provider will use reasonable efforts to restore functionality or find a reasonable alternative where technically and economically practicable.'}</P>

        {/* VII */}
        <H1>{sl ? 'VII. CENE IN PRIHODNJA KOMERCIALNA UPORABA' : 'VII. PRICING AND FUTURE COMMERCIAL USE'}</H1>

        <H2>{sl ? '20. člen – Brezplačna beta uporaba' : 'Article 20 – Free beta use'}</H2>
        <P>{sl ? '(1) Obrtdesk je v času objave teh Pogojev na voljo brezplačno kot beta različica, razen če je posameznemu Naročniku pisno sporočeno drugače.' : '(1) At the date of these Terms, Obrtdesk is available free of charge as a beta unless otherwise expressly communicated to a particular Customer.'}</P>
        <P>{sl ? '(2) Ponudnik trenutno namerava tudi po beta obdobju ohraniti brezplačen paket. To ne pomeni pravice do nespremenjenega ali neomejenega brezplačnega paketa za nedoločen čas. Ponudnik lahko spremeni obseg, omejitve, kvote, kapacitete ali funkcionalnosti brezplačnega paketa.' : '(2) The Provider currently intends to retain a free plan after beta. This does not create a right to an unchanged or unlimited free plan indefinitely. The Provider may change the scope, limits, quotas, capacity or functionality of the free plan.'}</P>
        <P>{sl ? '(3) Ponudnik lahko v prihodnje uvede dodatne plačljive pakete, omejitve uporabe, kvote, dodatne funkcionalnosti ali druge komercialne modele.' : '(3) The Provider may later introduce additional paid plans, quotas, usage limits, premium functionality or other commercial models.'}</P>

        <H2>{sl ? '21. člen – Uvedba plačljivih paketov' : 'Article 21 – Introduction of paid plans'}</H2>
        <P>{sl ? '(1) Če Ponudnik uvede plačljive pakete, brez izrecnega sprejema plačljivega paketa Naročniku ne bo avtomatično zaračunan nov naročniški strošek samo zato, ker je prej uporabljal brezplačno beta različico.' : '(1) A Customer will not automatically be charged a new subscription merely because it previously used the free beta. Paid use requires a separate acceptance or ordering step.'}</P>
        <P>{sl ? '(2) Plačljivi pogoji, cene, obračunsko obdobje, davki, način odpovedi in drugi bistveni komercialni pogoji bodo Naročniku predstavljeni pred sklenitvijo plačljivega razmerja.' : '(2) Pricing, billing cycles, taxes, cancellation rules and other material commercial terms will be presented before a paid relationship is entered into.'}</P>
        <P>{sl ? '(3) Ponudnik lahko ob prehodu na plačljivo različico omeji ali ukine določene brezplačne funkcionalnosti, ob razumnem predhodnem obvestilu, kjer je to izvedljivo.' : '(3) The Provider may restrict or discontinue free functionality when transitioning to paid plans, with reasonable notice where practicable.'}</P>

        {/* VIII */}
        <H1>{sl ? 'VIII. OMEJITEV, PRENEHANJE IN IZBRIS RAČUNA' : 'VIII. SUSPENSION, TERMINATION AND ACCOUNT DELETION'}</H1>

        <H2>{sl ? '22. člen – Začasna omejitev dostopa' : 'Article 22 – Temporary suspension'}</H2>
        <P>{sl ? '(1) Ponudnik lahko začasno omeji ali suspendira dostop, če je to razumno potrebno zaradi:' : '(1) The Provider may temporarily restrict or suspend access where reasonably necessary because of:'}</P>
        <Ul items={sl ? [
          'varnostnega incidenta ali grožnje;',
          'suma zlorabe ali nezakonite uporabe;',
          'kršitve teh Pogojev;',
          'potrebe po zaščiti drugih uporabnikov ali infrastrukture;',
          'zahteve pristojnega organa;',
          'prenehanja ali omejitve ključne tretje storitve.',
        ] : [
          'a security incident or threat;',
          'suspected misuse or unlawful activity;',
          'a breach of these Terms;',
          'the need to protect other users or infrastructure;',
          'a requirement of a competent authority;',
          'suspension or termination of a critical third-party service.',
        ]} />
        <P>{sl ? '(2) Kadar okoliščine dopuščajo, bo Ponudnik Naročnika obvestil o razlogu omejitve in možnostih ponovne vzpostavitve dostopa.' : '(2) Where circumstances permit, the Provider will inform the Customer of the reason and possible steps for restoring access.'}</P>

        <H2>{sl ? '23. člen – Odpoved s strani Naročnika' : 'Article 23 – Termination by Customer'}</H2>
        <P>{sl ? '(1) Naročnik lahko preneha uporabljati Storitev kadarkoli.' : '(1) The Customer may stop using the Service at any time.'}</P>
        <P>{sl ? '(2) Če Storitev omogoča funkcijo izbrisa računa, lahko Naročnik zahteva izbris prek te funkcije; sicer lahko zahtevo pošlje na info@bimetric.si.' : '(2) Where an account-deletion feature exists, it may be used; otherwise a request may be sent to info@bimetric.si.'}</P>
        <P>{sl ? '(3) Po potrjeni zahtevi za zaprtje Računa bo Ponudnik podatke iz aktivnih sistemov izbrisal oziroma anonimiziral brez nepotrebnega odlašanja in praviloma najpozneje v 30 dneh, razen kadar daljšo hrambo zahteva zakon, reševanje varnostnega incidenta, uveljavljanje ali obramba pravnih zahtevkov ali kadar podatki začasno ostanejo v tehničnih sistemih tretjih ponudnikov v skladu z njihovimi veljavnimi režimi izbrisa.' : '(3) Following a confirmed account-closure request, the Provider will delete or anonymise data from active systems without undue delay and generally no later than 30 days, except where longer retention is required by law, necessary to address a security incident, required for the establishment, exercise or defence of legal claims, or where data temporarily remains in third-party technical systems in accordance with the relevant provider\'s deletion processes.'}</P>
        <P>{sl ? '(4) Obrtdesk trenutno ne zagotavlja celovitega self-service izvoza vseh podatkov. Pred zaprtjem Računa lahko Naročnik kontaktira info@bimetric.si glede razpoložljivih možnosti izvoza.' : '(4) Obrtdesk does not currently provide a complete self-service export of all data. Before Account closure, the Customer may contact info@bimetric.si regarding available export options.'}</P>

        <H2>{sl ? '24. člen – Prenehanje s strani Ponudnika' : 'Article 24 – Termination by Provider'}</H2>
        <P>{sl ? '(1) Ponudnik lahko brezplačno beta Storitev ali posamezno funkcionalnost ukine.' : '(1) The Provider may discontinue the free Beta Service or individual features.'}</P>
        <P>{sl ? '(2) Če je razumno mogoče in ne gre za nujne varnostne ali pravne razloge, si bo Ponudnik prizadeval zagotoviti razumno predhodno obvestilo.' : '(2) Where reasonably possible and not prevented by urgent security or legal circumstances, reasonable advance notice will be given.'}</P>
        <P>{sl ? '(3) Ponudnik lahko takoj prekine dostop ob hujši kršitvi Pogojev, varnostnem tveganju, nezakoniti uporabi ali ravnanju, ki bistveno ogroža Storitev ali tretje osebe.' : '(3) Access may be terminated immediately for material breach, security threats, unlawful use or conduct materially endangering the Service or third parties.'}</P>

        <H2>{sl ? '25. člen – Posledice prenehanja' : 'Article 25 – Effects of termination'}</H2>
        <P>{sl ? '(1) Po prenehanju lahko Naročnik izgubi dostop do Računa in Uporabniških podatkov.' : '(1) After termination, the Customer may lose access to the Account and Customer Data.'}</P>
        <P>{sl ? '(2) Ponudnik bo podatke izbrisal ali anonimiziral skladno s svojo politiko hrambe, tehničnimi možnostmi, pogodbenimi obveznostmi, navodili Naročnika in veljavno zakonodajo.' : '(2) Data will be deleted or anonymised in accordance with retention policies, technical capability, Customer instructions, contractual obligations and applicable law.'}</P>
        <P>{sl ? '(3) Podatki se lahko omejen čas ohranijo v varnostnih kopijah ali tehničnih dnevnikih, če jih ni mogoče takoj selektivno izbrisati, vendar se v tem času ne smejo uporabljati za nove namene.' : '(3) Certain technical data or copies may temporarily exist within subprocessor infrastructure, logs, caches or service-delivery systems. Such copies are not a contractually guaranteed Obrtdesk backup and are not provided as a recovery service.'}</P>

        {/* IX */}
        <H1>{sl ? 'IX. JAMSTVA IN OMEJITEV ODGOVORNOSTI' : 'IX. WARRANTIES AND LIMITATION OF LIABILITY'}</H1>

        <H2>{sl ? '26. člen – Storitev »kot je« in sprejem tveganja' : 'Article 26 – Service "as is" and acceptance of risk'}</H2>
        <P>{sl ? '(1) Naročnik in vsak Uporabnik z registracijo, sprejemom teh Pogojev oziroma uporabo Obrtdesk izrecno potrjujeta in se strinjata, da je programska oprema po svoji naravi lahko predmet napak, pomanjkljivosti, nepravilnega delovanja, prekinitev in nepričakovanih rezultatov ter da nobene programske opreme ni mogoče razumno zagotavljati kot popolnoma brezhibne v vseh okoliščinah.' : '(1) By registering, accepting these Terms or using Obrtdesk, the Customer and each User expressly acknowledge and agree that software by its nature may contain defects, deficiencies, malfunctions, interruptions and unexpected results and that no software can reasonably be guaranteed to be completely error-free in all circumstances.'}</P>
        <P>{sl ? '(2) V največjem obsegu, ki ga dovoljuje veljavno pravo, je Storitev, zlasti brezplačna in beta različica, zagotovljena »kot je« in »kot je na voljo«, brez jamstva, da bo vedno brez napak, neprekinjena, popolnoma varna, združljiva z vsemi sistemi ali primerna za vsak posamezen namen Naročnika.' : '(2) To the fullest extent permitted by applicable law, the Service, particularly the free and beta version, is provided "as is" and "as available", without any warranty that it will always be error-free, uninterrupted, completely secure, compatible with every system or suitable for every particular Customer purpose.'}</P>
        <P>{sl ? '(3) Naročnik izrecno sprejema, da lahko Obrtdesk vsebuje programske napake, napake v formulah ali logiki, nepravilne izračune, nepravilne prikaze, napake pri uvozu ali izvozu, nepravilno obdelavo podatkov, težave pri generiranju dokumentov ali druge pomanjkljivosti.' : '(3) The Customer expressly accepts that Obrtdesk may contain software bugs, errors in formulas or logic, incorrect calculations, incorrect displays, import or export errors, incorrect data processing, document-generation errors or other defects.'}</P>
        <P>{sl ? '(4) Ponudnik ne daje jamstva, da so Predkalkulacije, Ponudbe, izračuni ali drugi Rezultati popolni, točni ali primerni za neposredno uporabo brez preverjanja.' : '(4) The Provider does not warrant that Cost Estimates, Quotes, calculations or other Outputs are complete, accurate or suitable for direct use without verification.'}</P>
        <P>{sl ? '(5) Naročnik se strinja, da obstoj napake v Storitev sam po sebi ne pomeni, da Ponudnik prevzema odgovornost za poslovne posledice uporabe napačnega Rezultata.' : '(5) The Customer agrees that the existence of an error in the Service does not by itself mean that the Provider assumes liability for business consequences resulting from use of an incorrect Output.'}</P>

        <H2>{sl ? '27. člen – Obvezno preverjanje predkalkulacij in ponudb' : 'Article 27 – Mandatory verification of estimates and quotes'}</H2>
        <P>{sl ? '(1) Naročnik in Uporabnik sta izključno odgovorna za preverjanje pravilnosti vseh podatkov, izračunov in Rezultatov pred njihovo poslovno uporabo ali posredovanjem tretji osebi.' : '(1) The Customer and User are solely responsible for verifying the correctness of all data, calculations and Outputs before business use or disclosure to a third party.'}</P>
        <P>{sl ? '(2) Preverjanje iz prejšnjega odstavka vključuje zlasti količine, dimenzije, materiale, nabavne in prodajne cene, cene materiala, strojne urne postavke, strojne in proizvodne čase, pripravljalne čase, stroške dela, stroške orodij, zunanje storitve, režijske stroške, pribitke, popuste, marže, davke, valute, roke, komercialne pogoje in končno ponudbeno ceno.' : '(2) Such verification includes quantities, dimensions, materials, purchase and sales prices, material prices, machine rates, machine and production times, setup times, labour costs, tooling costs, outsourced services, overhead, markups, discounts, margins, taxes, currencies, deadlines, commercial terms and final quoted price.'}</P>
        <P>{sl ? '(3) Naročnik se izrecno strinja, da Obrtdesk predstavlja pripomoček za predkalkulacijo in pripravo ponudb ter ne nadomešča strokovne kontrole tehnologa, kalkulanta, komercialista, proizvodnega strokovnjaka ali druge ustrezno usposobljene osebe.' : '(3) The Customer expressly acknowledges and agrees that Obrtdesk is an assistance tool for cost estimation and quote preparation and does not replace professional review by a technologist, estimator, sales professional, manufacturing professional or other appropriately qualified person.'}</P>
        <P>{sl ? '(4) Preden Naročnik oziroma Uporabnik Ponudbo pošlje kupcu, sprejme naročilo, naroči material, začne proizvodnjo ali na podlagi Rezultata sprejme drugo poslovno odločitev, mora sam preveriti pravilnost relevantnih podatkov in Rezultata.' : '(4) Before sending a Quote to a customer, accepting an order, purchasing material, starting production or making another business decision based on an Output, the Customer or User must independently verify the relevant data and Output.'}</P>
        <P>{sl ? '(5) Naročnik je odgovoren za končno vsebino, ceno in pogoje vsake Ponudbe, ki jo posreduje tretji osebi, ne glede na to, ali je bila Ponudba v celoti ali delno ustvarjena s Obrtdesk.' : '(5) The Customer is responsible for the final content, price and terms of every Quote delivered to a third party, whether generated wholly or partly using Obrtdesk.'}</P>

        <H2>{sl ? '28. člen – Napake uporabnika in napake programske opreme' : 'Article 28 – User errors and software errors'}</H2>
        <P>{sl ? '(1) V največjem obsegu, ki ga dovoljuje veljavno pravo, Ponudnik ne odgovarja za škodo, izgubo, stroške ali druge posledice, ki nastanejo zaradi:' : '(1) To the fullest extent permitted by applicable law, the Provider is not liable for loss, damage, costs or other consequences arising from:'}</P>
        <Ul items={sl ? [
          'napačnih, nepopolnih, zastarelih ali nepravilno vnesenih podatkov Naročnika ali Uporabnika;',
          'napačne konfiguracije, nastavitev, formul, cenikov, stroškovnih mest, strojev ali drugih parametrov;',
          'napačne ali neustrezne uporabe Storitev;',
          'neizvedenega ali nezadostnega preverjanja Rezultatov;',
          'programske napake, napake v izračunu, napake v programski logiki ali nepravilnega delovanja Storitev;',
          'napake pri prikazu, uvozu, izvozu, shranjevanju ali generiranju dokumentov;',
          'nepravilne Predkalkulacije ali napačne končne ponudbene cene;',
          'napačne ocene materiala, količine, strojnega časa, proizvodnega časa, časa dela, orodij, zunanjih storitev, režije, pribitka, popusta ali marže;',
          'odločitve Naročnika ali tretje osebe, sprejete na podlagi Rezultata;',
          'ponudbe, naročila ali pogodbe, ki jo je Naročnik sklenil ali posredoval na podlagi Rezultata.',
        ] : [
          'incorrect, incomplete, outdated or improperly entered Customer or User data;',
          'incorrect configuration, settings, formulas, price lists, cost centres, machines or other parameters;',
          'incorrect or inappropriate use of the Service;',
          'failure to verify or insufficient verification of Outputs;',
          'a software bug, calculation error, logic error or malfunction of the Service;',
          'display, import, export, storage or document-generation errors;',
          'an incorrect Cost Estimate or final quoted price;',
          'an incorrect estimate of material, quantity, machine time, production time, labour, tooling, outsourced services, overhead, markup, discount or margin;',
          'a decision made by the Customer or a third party based on an Output;',
          'a quote, order or contract entered into or submitted by the Customer based on an Output.',
        ]} />
        <P>{sl ? '(2) Naročnik izrecno potrjuje in se strinja, da je sam odgovoren za končno strokovno in komercialno kontrolo Rezultatov, tudi kadar je napaka v Rezultatu posledica programske napake Obrtdesk.' : '(2) The Customer expressly acknowledges and agrees that it remains responsible for final professional and commercial review of Outputs even where an incorrect Output results from a Obrtdesk software error.'}</P>
        <P>{sl ? '(3) Če Naročnik zazna očitno ali domnevno napako, Rezultata ne sme uporabiti za zavezujočo poslovno odločitev, dokler ga ne preveri oziroma napake ne odpravi ali ustrezno upošteva.' : '(3) If the Customer identifies an apparent or suspected error, the Output must not be used for a binding business decision until independently verified and the error has been corrected or appropriately accounted for.'}</P>
        <P>{sl ? '(4) Ta člen ne izključuje odgovornosti v obsegu, v katerem je po prisilnem pravu ni dovoljeno izključiti.' : '(4) This Article does not exclude liability to the extent exclusion is prohibited by mandatory law.'}</P>

        <H2>{sl ? '29. člen – Izključene vrste škode' : 'Article 29 – Excluded categories of loss'}</H2>
        <P>{sl ? '(1) V največjem obsegu, ki ga dovoljuje veljavno pravo, Ponudnik v nobenem primeru ne odgovarja za posredno, posledično, posebno, naključno ali kaznovalno škodo oziroma za izgubljeni dobiček, izgubljeni prihodek, izgubljeno maržo, izgubljeno poslovno priložnost, izgubljeno naročilo, izgubo kupca, izgubo ugleda, prekinitev poslovanja, stroške nadomestne proizvodnje, stroške ponovne izdelave, pogodbene kazni Naročnika do njegovih strank ali druge primerljive poslovne posledice.' : '(1) To the fullest extent permitted by applicable law, the Provider shall in no event be liable for indirect, consequential, special, incidental or punitive damages, or for lost profits, lost revenue, lost margin, lost business opportunities, lost orders, loss of customers, reputational loss, business interruption, replacement-production costs, rework costs, contractual penalties owed by the Customer to its own customers or comparable business losses.'}</P>
        <P>{sl ? '(2) Izključitev velja ne glede na pravno podlago zahtevka in tudi, če je bil Ponudnik opozorjen na možnost nastanka take škode, kolikor je takšna izključitev po veljavnem pravu dopustna.' : '(2) This exclusion applies regardless of the legal theory of the claim and even where the Provider has been advised of the possibility of such loss, to the extent permitted by applicable law.'}</P>

        <H2>{sl ? '30. člen – Najvišja skupna odgovornost Ponudnika' : 'Article 30 – Maximum aggregate liability'}</H2>
        <P>{sl ? '(1) Naročnik izrecno potrjuje in se strinja, da v največjem obsegu, ki ga dovoljuje veljavno pravo, skupna kumulativna odgovornost Ponudnika iz ali v zvezi s Storitvijo v nobenem primeru ne presega skupnega zneska, ki ga je konkretni Naročnik dejansko plačal Ponudniku za uporabo Obrtdesk v dvanajstih (12) mesecih neposredno pred dogodkom, iz katerega izvira zahtevek.' : '(1) The Customer expressly acknowledges and agrees that, to the fullest extent permitted by applicable law, the Provider\'s total cumulative liability arising out of or relating to the Service shall in no event exceed the total amount actually paid by that Customer to the Provider for use of Obrtdesk during the twelve (12) months immediately preceding the event giving rise to the claim.'}</P>
        <P>{sl ? '(2) Omejitev iz prejšnjega odstavka velja za vse zahtevke skupaj, ne za vsak zahtevek posebej, in ne glede na to, ali zahtevek temelji na pogodbi, odškodninski odgovornosti, kršitvi zakonske obveznosti ali drugi pravni podlagi, kolikor je takšna omejitev dovoljena.' : '(2) The cap applies to all claims in the aggregate, not separately to each claim, and applies regardless of whether a claim is based in contract, tort, breach of statutory duty or another legal theory, to the extent such limitation is permitted.'}</P>
        <P>{sl ? '(3) Če Naročnik za uporabo Storitev v relevantnem dvanajstmesečnem obdobju ni plačal nobenega zneska, je pogodbeno dogovorjena zgornja meja odgovornosti Ponudnika 0 EUR, vendar samo v obsegu, v katerem je takšna omejitev po veljavnem prisilnem pravu dopustna.' : '(3) Where the Customer paid no amount for the Service during the relevant twelve-month period, the contractually agreed maximum liability of the Provider is EUR 0, but only to the extent such limitation is permitted under applicable mandatory law.'}</P>
        <P>{sl ? '(4) Naročnik potrjuje, da je omejitev odgovornosti bistven element dogovora, zlasti glede na brezplačno oziroma cenovno omejeno naravo Storitev, in da Ponudnik brez teh omejitev Storitev pod enakimi pogoji ne bi zagotavljal.' : '(4) The Customer acknowledges that these limitations are an essential basis of the agreement, particularly given the free or limited-price nature of the Service, and that the Provider would not provide the Service on the same terms without them.'}</P>
        <P>{sl ? '(5) Ne glede na besedilo »v nobenem primeru« nobena določba teh Pogojev ne izključuje ali omejuje odgovornosti, ki je po veljavnem prisilnem pravu ni mogoče vnaprej izključiti ali omejiti. To zlasti vključuje odgovornost za škodo, povzročeno namenoma ali iz hude malomarnosti, kadar tako določa veljavno pravo.' : '(5) Notwithstanding the words "in no event", nothing in these Terms excludes or limits liability that cannot lawfully be excluded or limited in advance under applicable mandatory law. This includes, in particular, liability for intentional misconduct or gross negligence where applicable law so provides.'}</P>

        <H2>{sl ? '31. člen – Višja sila' : 'Article 31 – Force majeure'}</H2>
        <P>{sl ? '(1) Ponudnik ne odgovarja za neizpolnitev, zamudo, izgubo razpoložljivosti ali motnjo, ki je posledica dogodkov zunaj njegovega razumnega nadzora, vključno z naravnimi nesrečami, vojno, terorizmom, stavkami, izpadi elektrike ali interneta, kibernetskimi napadi, epidemijami, ravnanjem državnih organov ter večjimi izpadi Supabase, Vercel ali drugih infrastrukturnih ponudnikov.' : '(1) The Provider is not liable for failure, delay, loss of availability or disruption caused by events beyond its reasonable control, including natural disasters, war, terrorism, strikes, electricity or internet outages, cyberattacks, epidemics, government action and material outages of Supabase, Vercel or other infrastructure providers.'}</P>
        <P>{sl ? '(2) Če okoliščina višje sile traja dalj časa, lahko Ponudnik prizadeto funkcionalnost začasno omeji ali Storitev prekine brez odgovornosti za posledice, ki jih po prisilnem pravu ni dolžan nositi.' : '(2) If a force-majeure event continues for an extended period, the Provider may restrict affected functionality or discontinue the Service without liability for consequences it is not required to bear under mandatory law.'}</P>

        {/* X */}
        <H1>{sl ? 'X. INTEGRACIJE, UVOZI IN IZVOZI' : 'X. INTEGRATIONS, IMPORTS AND EXPORTS'}</H1>

        <H2>{sl ? '32. člen – Integracije tretjih oseb' : 'Article 32 – Third-party integrations'}</H2>
        <P>{sl ? '(1) Storitev lahko vključuje povezave z izdelki ali storitvami tretjih oseb.' : '(1) The Service may connect to third-party products or services.'}</P>
        <P>{sl ? '(2) Za tretje storitve veljajo njihovi lastni pogoji in politike zasebnosti.' : '(2) Third-party services are governed by their own terms and privacy policies.'}</P>
        <P>{sl ? '(3) Ponudnik ne odgovarja za spremembe, ukinitve, napake ali ravnanje tretjih storitev, ki niso pod njegovim nadzorom.' : '(3) The Provider is not responsible for changes, discontinuation, defects or conduct of third-party services outside its control.'}</P>
        <P>{sl ? '(4) Naročnik je odgovoren za pridobitev potrebnih licenc, soglasij in pravnih podlag za uporabo integracij.' : '(4) The Customer is responsible for obtaining licences, consents and lawful bases required to use integrations.'}</P>

        <H2>{sl ? '33. člen – Uvoz in izvoz podatkov' : 'Article 33 – Import and export of data'}</H2>
        <P>{sl ? '(1) Naročnik je odgovoren za zakonitost, popolnost in pravilnost uvoženih podatkov.' : '(1) The Customer is responsible for the legality, completeness and accuracy of imported data.'}</P>
        <P>{sl ? '(2) Ponudnik lahko omogoča izvoz določenih podatkov, vendar ne jamči, da bodo vse notranje strukture ali zgodovinske verzije podatkov vedno na voljo v izvozni obliki.' : '(2) The Provider may allow export of certain data but does not guarantee that every internal data structure or historic version will always be exportable.'}</P>
        <P>{sl ? '(3) Naročnik mora pred prenehanjem uporabe pravočasno izvoziti podatke, ki jih želi ohraniti.' : '(3) The Customer should export data it wishes to retain before terminating use.'}</P>

        {/* XI */}
        <H1>{sl ? 'XI. VARSTVO OSEBNIH PODATKOV' : 'XI. PERSONAL DATA'}</H1>

        <H2>{sl ? '34. člen – Vloge po GDPR' : 'Article 34 – GDPR roles'}</H2>
        <P>{sl ? '(1) Za osebne podatke, ki jih Ponudnik zbira za upravljanje računov, varnost Storitev, komunikacijo z uporabniki, podporo in lastne zakonite poslovne namene, Ponudnik praviloma nastopa kot samostojni upravljavec.' : '(1) For personal data collected by the Provider for account administration, Service security, communications, support and the Provider\'s own legitimate business purposes, the Provider generally acts as controller.'}</P>
        <P>{sl ? '(2) Za osebne podatke, ki jih Naročnik vnese v Obrtdesk v okviru lastnega poslovanja, na primer podatke o svojih kupcih, dobaviteljih, kontaktnih osebah ali zaposlenih, Naročnik praviloma nastopa kot upravljavec, Ponudnik pa kot obdelovalec po navodilih Naročnika.' : '(2) For personal data entered into Obrtdesk by the Customer as part of its own business operations, such as information relating to the Customer\'s customers, suppliers, contacts or employees, the Customer generally acts as controller and the Provider acts as processor on the Customer\'s documented instructions.'}</P>
        <P>{sl ? '(3) Če Naročnik sam nastopa kot obdelovalec za tretjo osebo, Ponudnik lahko glede takih podatkov nastopa kot nadaljnji obdelovalec.' : '(3) If the Customer itself acts as processor for a third party, the Provider may act as subprocessor.'}</P>
        <P>{sl ? '(4) Podrobnejše informacije o obdelavi podatkov, kjer Ponudnik nastopa kot upravljavec, so določene v Politiki zasebnosti Obrtdesk.' : '(4) Processing for which the Provider acts as controller is described further in the Obrtdesk Privacy Policy.'}</P>

        {/* XII */}
        <H1>{sl ? 'XII. DOGOVOR O OBDELAVI OSEBNIH PODATKOV (DPA)' : 'XII. DATA PROCESSING AGREEMENT'}</H1>

        <H2>{sl ? '35. člen – Predmet in trajanje obdelave' : 'Article 35 – Subject matter and duration'}</H2>
        <P>{sl ? '(1) To poglavje predstavlja dogovor o obdelavi osebnih podatkov v smislu 28. člena GDPR, kadar Ponudnik za Naročnika obdeluje osebne podatke kot obdelovalec.' : '(1) This Chapter constitutes a data processing agreement within the meaning of Article 28 GDPR where the Provider processes personal data on behalf of the Customer.'}</P>
        <P>{sl ? '(2) Predmet obdelave je zagotavljanje Storitev Obrtdesk, vključno z gostovanjem podatkov, shranjevanjem, prikazovanjem, prenosom, avtentikacijo, podporo, varnostjo, izdelavo izračunov ter drugimi funkcijami, ki jih Naročnik uporablja.' : '(2) The subject matter is the provision of Obrtdesk, including hosting, storage, display, transmission, authentication, support, security, calculations and related functions selected by the Customer.'}</P>
        <P>{sl ? '(3) Obdelava traja toliko časa, kolikor traja uporaba Storitev oziroma toliko časa, kot je potrebno za izbris ali vrnitev podatkov po prenehanju.' : '(3) Processing continues for the period in which the Service is used and for the period reasonably required to delete or return data following termination.'}</P>

        <H2>{sl ? '36. člen – Kategorije posameznikov in podatkov' : 'Article 36 – Data subjects and categories of data'}</H2>
        <P>{sl ? '(1) Kategorije posameznikov lahko vključujejo:' : '(1) Data subjects may include:'}</P>
        <Ul items={sl ? [
          'zaposlene, sodelavce in Uporabnike Naročnika;',
          'kontaktne osebe pri kupcih in dobaviteljih;',
          'poslovne partnerje, potencialne stranke in druge osebe, katerih podatke Naročnik vnese v Storitev.',
        ] : [
          'employees, contractors and Users of the Customer;',
          'contacts at customers and suppliers;',
          'business partners, prospects and other persons whose details the Customer submits.',
        ]} />
        <P>{sl ? '(2) Vrste podatkov lahko vključujejo:' : '(2) Personal data may include:'}</P>
        <Ul items={sl ? [
          'ime in priimek;',
          'poslovni e-poštni naslov in telefonsko številko;',
          'naziv podjetja, funkcijo in organizacijsko vlogo;',
          'vsebino ponudb, opomb in poslovne komunikacije;',
          'podatke, ki jih Naročnik sam vnese v prosta besedilna polja ali dokumente.',
        ] : [
          'first and last name;',
          'business email address and phone number;',
          'employer, role and organisational position;',
          'content of quotes, notes and business communications;',
          'data submitted by the Customer in free-text fields or documents.',
        ]} />
        <P>{sl ? '(3) Obrtdesk ni namenjen shranjevanju posebnih vrst osebnih podatkov iz 9. člena GDPR, podatkov o kazenskih obsodbah ali drugih posebej občutljivih osebnih podatkov, razen če je to izrecno podprto in ustrezno pogodbeno urejeno.' : '(3) Obrtdesk is not intended for special-category data under Article 9 GDPR, criminal-conviction data or similarly sensitive information unless expressly supported and separately agreed.'}</P>

        <H2>{sl ? '37. člen – Navodila Naročnika' : 'Article 37 – Customer instructions'}</H2>
        <P>{sl ? '(1) Ponudnik obdeluje osebne podatke samo po dokumentiranih navodilih Naročnika, razen če obdelavo zahteva pravo EU ali države članice.' : '(1) The Provider processes personal data only on documented instructions from the Customer unless processing is required by EU or Member State law.'}</P>
        <P>{sl ? '(2) Uporaba Storitev, konfiguracija Računa, nalaganje podatkov in zahteve prek podpornih kanalov se štejejo za dokumentirana navodila v okviru dogovorjenega namena.' : '(2) Use of the Service, Account configuration, data uploads and support requests constitute documented instructions within the agreed scope.'}</P>
        <P>{sl ? '(3) Če Ponudnik meni, da navodilo krši GDPR ali drugo veljavno pravo varstva podatkov, o tem Naročnika obvesti, kadar je to pravno dovoljeno.' : '(3) If the Provider believes an instruction infringes GDPR or other applicable data-protection law, the Provider will inform the Customer where legally permitted.'}</P>

        <H2>{sl ? '38. člen – Zaupnost in dostop osebja' : 'Article 38 – Confidentiality and personnel access'}</H2>
        <P>{sl ? '(1) Osebe, ki pri Ponudniku ali njegovih izvajalcih dostopajo do osebnih podatkov, smejo to storiti le v obsegu, ki je potreben za njihovo delo.' : '(1) Persons accessing personal data for the Provider or its contractors may do so only to the extent necessary for their work.'}</P>
        <P>{sl ? '(2) Te osebe morajo biti zavezane k zaupnosti ali ustrezni zakonski obveznosti varovanja zaupnosti.' : '(2) Such persons must be subject to confidentiality obligations.'}</P>

        <H2>{sl ? '39. člen – Tehnični in organizacijski ukrepi' : 'Article 39 – Technical and organisational measures'}</H2>
        <P>{sl ? '(1) Ponudnik uporablja ukrepe, primerne tveganju, med drugim:' : '(1) Measures appropriate to the risk include:'}</P>
        <Ul items={sl ? [
          'avtentikacijo uporabnikov;',
          'omejevanje dostopa glede na vlogo ali potrebo;',
          'šifriran prenos podatkov prek sodobnih HTTPS/TLS povezav;',
          'uporabo varnostnih mehanizmov Supabase in Vercel;',
          'varovanje skrivnosti in servisnih ključev;',
          'beleženje in spremljanje relevantnih sistemskih dogodkov, kjer je tehnično na voljo;',
          'redno posodabljanje aplikacijske kode in odvisnosti;',
          'načelo najmanjših potrebnih pravic;',
          'varnostno kopiranje v obsegu, ki ga omogočajo uporabljeni infrastrukturni načrti.',
        ] : [
          'user authentication;',
          'role- or need-based access control;',
          'encrypted transmission using modern HTTPS/TLS;',
          'use of Supabase and Vercel security controls;',
          'protection of secrets and service keys;',
          'logging and monitoring where technically available;',
          'regular updating of application code and dependencies;',
          'least-privilege principles;',
          'backups to the extent supported by applicable infrastructure plans.',
        ]} />
        <P>{sl ? '(2) Natančni ukrepi se lahko sčasoma prilagajajo razvoju Storitev in tveganjem, pod pogojem, da se splošna raven varnosti ne zniža nerazumno.' : '(2) Measures may evolve as the Service and risks change, provided the overall level of security is not unreasonably reduced.'}</P>

        <H2>{sl ? '40. člen – Podobdelovalci' : 'Article 40 – Subprocessors'}</H2>
        <P>{sl ? '(1) Naročnik daje Ponudniku splošno dovoljenje za uporabo podobdelovalcev, potrebnih za zagotavljanje Storitev.' : '(1) The Customer grants general authorisation for the Provider to engage subprocessors needed to provide the Service.'}</P>
        <P>{sl ? '(2) Ključna podobdelovalca oziroma infrastrukturna ponudnika sta trenutno:' : '(2) Current key subprocessors / infrastructure providers include:'}</P>
        <Table
          headers={sl ? ['Ponudnik', 'Pravna oseba', 'Funkcija'] : ['Provider', 'Legal entity', 'Function']}
          rows={[
            ['Supabase', 'SUPABASE PTE. LTD., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, Singapore', sl ? 'Podatkovna baza, avtentikacija in povezane backend storitve' : 'Database, authentication and related backend services'],
            ['Vercel', 'Vercel Inc., Delaware corporation, 440 N Barranca Ave #4133, Covina, CA 91723, USA', sl ? 'Gostovanje, izvajanje in dostava spletne aplikacije' : 'Hosting, execution and delivery of the web application'],
          ]}
        />
        <P>{sl ? '(3) Supabase in Vercel lahko uporabljata lastne podobdelovalce, katerih aktualni seznami so objavljeni v njunih pravnih oziroma varnostnih dokumentih.' : '(3) Supabase and Vercel may use their own subprocessors, as listed in their current legal and security documentation.'}</P>
        <P>{sl ? '(4) Ponudnik lahko doda ali zamenja podobdelovalca. Kadar sprememba lahko pomembno vpliva na varstvo osebnih podatkov, si bo Ponudnik prizadeval Naročnika razumno obvestiti pred začetkom nove obdelave.' : '(4) The Provider may add or replace subprocessors. Where a change may materially affect personal-data protection, the Provider will use reasonable efforts to notify the Customer before new processing begins.'}</P>
        <P>{sl ? '(5) Ponudnik bo z vsakim podobdelovalcem uredil razmerje tako, kot to zahteva veljavna zakonodaja in razpoložljivi pogodbeni pogoji posameznega infrastrukturnega ponudnika.' : '(5) The Provider will put in place arrangements with subprocessors as required by applicable law and by the contractual mechanisms made available by the relevant infrastructure provider.'}</P>

        <H2>{sl ? '41. člen – Mednarodni prenosi' : 'Article 41 – International transfers'}</H2>
        <P>{sl ? '(1) Ker sta Supabase in Vercel mednarodna ponudnika infrastrukture in uporabljata oziroma lahko uporabljata infrastrukturo ter podobdelovalce zunaj Evropskega gospodarskega prostora, lahko pri uporabi Obrtdesk pride do mednarodnih prenosov osebnih podatkov.' : '(1) Because Supabase and Vercel are international infrastructure providers and use or may use infrastructure and subprocessors outside the EEA, use of Obrtdesk may involve international transfers of personal data.'}</P>
        <P>{sl ? '(2) Supabase projekt ima eno primarno regijo, vendar javni pogoji sami ne razkrivajo primarne regije konkretnega Obrtdesk projekta. Supabase poleg tega navaja možno obdelavo v ZDA in drugih državah, kjer imajo Supabase ali njegovi izvajalci infrastrukturo.' : '(2) A Supabase project has one primary region, but the public legal terms do not identify the primary region of the specific Obrtdesk project. Supabase additionally states that processing may occur in the United States and other countries where Supabase or its contractors maintain facilities.'}</P>
        <P>{sl ? '(3) Vercel v svojem DPA navaja primarne obdelovalne zmogljivosti v ZDA ter možno obdelavo drugod po svetu, kjer delujejo Vercel ali njegovi podobdelovalci.' : '(3) Vercel states in its DPA that its primary processing facilities are in the United States and that processing may also take place elsewhere in the world where Vercel or its subprocessors operate.'}</P>
        <P>{sl ? '(4) Kadar GDPR zahteva poseben mehanizem za prenos, se uporabljajo ustrezni pravni mehanizmi, kot so sklep o ustreznosti, standardne pogodbene klavzule Evropske komisije ali drug zakonit mehanizem.' : '(4) Where GDPR requires a transfer mechanism, appropriate lawful mechanisms such as adequacy decisions, European Commission Standard Contractual Clauses or another lawful transfer mechanism will apply.'}</P>
        <P>{sl ? '(5) Naročnik razume, da lokacija obdelave ni nujno enaka sedežu posameznega ponudnika in je lahko odvisna od konfiguracije, regije, omrežnih storitev ter podobdelovalcev.' : '(5) The Customer understands that data-processing location is not necessarily the same as a provider\'s registered office and may depend on configuration, region, network services and subprocessors.'}</P>

        <H2>{sl ? '42. člen – Pravice posameznikov' : 'Article 42 – Data-subject requests'}</H2>
        <P>{sl ? '(1) Če Ponudnik prejme zahtevo posameznika glede osebnih podatkov, ki jih obdeluje izključno v imenu Naročnika, bo zahtevo praviloma posredoval Naročniku oziroma ga o njej obvestil.' : '(1) If the Provider receives a request concerning personal data processed solely on behalf of the Customer, the Provider will generally forward the request to or notify the Customer.'}</P>
        <P>{sl ? '(2) Ponudnik bo ob upoštevanju narave obdelave in tehničnih možnosti Naročniku razumno pomagal pri izpolnjevanju obveznosti glede pravic posameznikov.' : '(2) Taking into account the nature of processing and technical capability, the Provider will provide reasonable assistance to the Customer in responding to data-subject rights requests.'}</P>

        <H2>{sl ? '43. člen – Pomoč pri skladnosti' : 'Article 43 – Compliance assistance'}</H2>
        <P>{sl ? '(1) Ponudnik bo ob upoštevanju narave obdelave in informacij, ki so mu na voljo, razumno pomagal Naročniku pri izpolnjevanju obveznosti iz členov 32 do 36 GDPR, kadar se te nanašajo na obdelavo prek Obrtdesk.' : '(1) Taking into account the nature of processing and information available, the Provider will provide reasonable assistance with obligations under Articles 32 to 36 GDPR where they concern processing through Obrtdesk.'}</P>
        <P>{sl ? '(2) Obsežna individualna pomoč, revizijski vprašalniki ali posebne varnostne zahteve, ki presegajo običajno beta Storitev, so lahko predmet ločenega dogovora.' : '(2) Extensive individual assistance, audit questionnaires or bespoke security requirements exceeding the normal Beta Service may require a separate agreement.'}</P>

        <H2>{sl ? '44. člen – Kršitev varnosti osebnih podatkov' : 'Article 44 – Personal-data breaches'}</H2>
        <P>{sl ? '(1) Če Ponudnik ugotovi kršitev varnosti osebnih podatkov, ki jih obdeluje v imenu Naročnika, bo Naročnika obvestil brez nepotrebnega odlašanja po tem, ko je s kršitvijo seznanjen.' : '(1) If the Provider becomes aware of a personal-data breach affecting data processed on behalf of the Customer, the Provider will notify the Customer without undue delay.'}</P>
        <P>{sl ? '(2) Obvestilo bo v razumnem obsegu vsebovalo informacije, ki so Ponudniku takrat na voljo in jih Naročnik potrebuje za izpolnjevanje svojih obveznosti.' : '(2) The notification will include, to the extent reasonably available, information needed by the Customer to comply with its legal obligations.'}</P>
        <P>{sl ? '(3) Ponudnik lahko informacije posreduje postopoma, če ob prvem obvestilu še niso znane vse podrobnosti.' : '(3) Information may be provided in phases where all details are not available at the time of initial notification.'}</P>

        <H2>{sl ? '45. člen – Revizije in dokazovanje skladnosti' : 'Article 45 – Audits and compliance information'}</H2>
        <P>{sl ? '(1) Ponudnik bo Naročniku na razumno zahtevo dal na voljo informacije, ki so potrebne za dokazovanje izpolnjevanja obveznosti obdelovalca po 28. členu GDPR.' : '(1) On reasonable request, the Provider will make available information necessary to demonstrate compliance with Article 28 GDPR.'}</P>
        <P>{sl ? '(2) Revizije morajo biti razumne, sorazmerne, ne smejo ogrožati varnosti drugih uporabnikov in praviloma ne smejo potekati pogosteje kot enkrat letno, razen ob utemeljenem sumu bistvene neskladnosti ali če to zahteva pristojni organ.' : '(2) Audits must be reasonable, proportionate, must not compromise other customers\' security and ordinarily should not occur more than once annually unless there is a substantiated material compliance concern or a competent authority requires otherwise.'}</P>
        <P>{sl ? '(3) Ponudnik lahko za dokazovanje skladnosti uporabi tudi dokumentacijo, poročila in certifikate svojih infrastrukturnih ponudnikov.' : '(3) The Provider may rely on documentation, reports and certifications of its infrastructure providers as part of demonstrating compliance.'}</P>

        <H2>{sl ? '46. člen – Izbris in vrnitev podatkov' : 'Article 46 – Return and deletion'}</H2>
        <P>{sl ? '(1) Po prenehanju obdelave oziroma potrjenem zaprtju Računa bo Ponudnik v skladu z navodilom Naročnika in tehničnimi možnostmi osebne podatke iz aktivnih sistemov izbrisal oziroma anonimiziral brez nepotrebnega odlašanja in praviloma najpozneje v 30 dneh, razen če zakon zahteva nadaljnjo hrambo.' : '(1) Following termination or confirmed Account closure, the Provider will, in accordance with the Customer\'s instructions and technical capability, delete or anonymise personal data from active systems without undue delay and generally within 30 days, unless retention is required by law.'}</P>
        <P>{sl ? '(2) Obrtdesk na trenutnem Supabase Free načrtu nima pogodbeno zagotovljenih avtomatskih varnostnih kopij. Določeni podatki lahko kljub temu začasno ostanejo v tehničnih dnevnikih, predpomnilnikih ali drugih sistemih podobdelovalcev, če selektivni takojšnji izbris tehničnih kopij ni mogoč. Takšni podatki se ne bodo namensko uporabljali za nove namene in bodo predmet običajnih režimov izbrisa posameznih ponudnikov.' : '(2) Obrtdesk\'s current Supabase Free plan does not provide contractually guaranteed automatic database backups. Certain data may nevertheless temporarily remain in technical logs, caches or other subprocessor systems where immediate selective deletion of technical copies is not possible. Such data will not intentionally be used for new purposes and will be subject to the relevant provider\'s ordinary deletion processes.'}</P>
        <P>{sl ? '(3) Vercel v svojem DPA določa, da po prenehanju pogodbenega razmerja izbriše Customer Data v komercialno razumnem času, razen če hrambo zahteva zakon.' : '(3) Vercel\'s DPA states that following termination or expiry it deletes Customer Data within a commercially reasonable timeframe, unless retention is legally required.'}</P>

        {/* XIII */}
        <H1>{sl ? 'XIII. POLITIKA ZASEBNOSTI IN PIŠKOTKI' : 'XIII. PRIVACY AND COOKIES'}</H1>

        <H2>{sl ? '47. člen – Politika zasebnosti' : 'Article 47 – Privacy Policy'}</H2>
        <P>{sl ? '(1) Obdelava osebnih podatkov, pri kateri Ponudnik nastopa kot upravljavec, je podrobneje opisana v ločeni Politiki zasebnosti Obrtdesk.' : '(1) Processing for which the Provider acts as controller is described in the separate Obrtdesk Privacy Policy.'}</P>
        <P>{sl ? '(2) Če obstaja neskladje med temi Pogoji in Politiko zasebnosti glede obdelave, pri kateri Ponudnik nastopa kot upravljavec, se vprašanje razlaga skladno z GDPR in veljavno Politiko zasebnosti.' : '(2) Any inconsistency concerning controller processing must be interpreted in accordance with GDPR and the applicable Privacy Policy.'}</P>

        <H2>{sl ? '48. člen – Piškotki, analytics in podobne tehnologije' : 'Article 48 – Cookies, analytics and similar technologies'}</H2>
        <P>{sl ? '(1) Obrtdesk lahko uporablja nujno potrebne piškotke ali podobne tehnologije za prijavo, varnost, shranjevanje seje in osnovno delovanje.' : '(1) Obrtdesk may use strictly necessary cookies or similar technologies for login, security, session storage and core operation.'}</P>
        <P>{sl ? '(2) Obrtdesk trenutno ne uporablja neobveznega spletnega analytics sistema, session replay sistema ali namenskega error-monitoring ponudnika za sledenje vedenju končnih uporabnikov.' : '(2) Obrtdesk currently does not use an optional web-analytics system, session-replay system or dedicated error-monitoring provider to track end-user behaviour.'}</P>
        <P>{sl ? '(3) Če Ponudnik v prihodnje uvede neobvezno analitiko, session replay, oglaševalske ali druge tehnologije, za katere je potrebno soglasje ali dodatno obvestilo, jih bo uvedel skladno z veljavno zakonodajo in po potrebi ustrezno posodobil Politiko zasebnosti oziroma mehanizem soglasja.' : '(3) If optional analytics, session replay, advertising or other technologies requiring consent or additional notice are introduced in the future, they will be implemented in accordance with applicable law and the Privacy Policy and consent mechanism will be updated where required.'}</P>

        {/* XIV */}
        <H1>{sl ? 'XIV. ODGOVORNOST NAROČNIKA IN ZAHTEVKI TRETJIH OSEB' : 'XIV. CUSTOMER RESPONSIBILITY AND THIRD-PARTY CLAIMS'}</H1>

        <H2>{sl ? '49. člen – Zakonitost podatkov in uporabe' : 'Article 49 – Legality of data and use'}</H2>
        <P>{sl ? '(1) Naročnik je odgovoren za zakonitost podatkov, ki jih vnese v Storitev, ter za to, da ima za obdelavo in posredovanje podatkov ustrezno pravno podlago.' : '(1) The Customer is responsible for the legality of data it submits and for having an appropriate lawful basis for processing and sharing that data.'}</P>
        <P>{sl ? '(2) Naročnik ne sme uporabljati Storitev na način, ki krši pravice intelektualne lastnine, zaupnost, varstvo osebnih podatkov, poslovne skrivnosti ali druge pravice tretjih oseb.' : '(2) The Customer must not use the Service in a manner that infringes intellectual property, confidentiality, privacy, trade-secret or other rights of third parties.'}</P>

        <H2>{sl ? '50. člen – Zahtevki tretjih oseb' : 'Article 50 – Third-party claims'}</H2>
        <P>{sl ? '(1) Če proti Ponudniku nastane zahtevek tretje osebe, ki neposredno izvira iz nezakonitih Uporabniških podatkov, kršitve pravic tretjih oseb ali očitno nezakonite uporabe Storitev s strani Naročnika, mora Naročnik s Ponudnikom razumno sodelovati pri obrambi in odpravi kršitve.' : '(1) If a third-party claim against the Provider arises directly from unlawful Customer Data, infringement of third-party rights or manifestly unlawful use by the Customer, the Customer must reasonably cooperate with the Provider in defending and remediating the matter.'}</P>
        <P>{sl ? '(2) Nobena določba tega člena ne nalaga Naročniku odgovornosti, ki je po veljavnem pravu ne bi bilo mogoče zakonito dogovoriti.' : '(2) Nothing in this Article imposes liability that could not lawfully be agreed under applicable law.'}</P>

        {/* XV */}
        <H1>{sl ? 'XV. KOMUNIKACIJA IN SPREMEMBE' : 'XV. COMMUNICATIONS AND CHANGES'}</H1>

        <H2>{sl ? '51. člen – Obvestila' : 'Article 51 – Notices'}</H2>
        <P>{sl ? '(1) Ponudnik lahko Naročniku pošilja obvestila prek e-pošte, znotraj Storitev ali z objavo na spletni strani, kadar je tak način glede na naravo obvestila primeren.' : '(1) The Provider may send notices by email, through the Service or by publication on the website where appropriate to the nature of the notice.'}</P>
        <P>{sl ? '(2) Naročnik je odgovoren, da so njegovi kontaktni podatki ažurni.' : '(2) The Customer is responsible for keeping contact details current.'}</P>
        <P>{sl ? '(3) Kontakt Ponudnika za običajna vprašanja je info@bimetric.si.' : '(3) The Provider\'s general contact is info@bimetric.si.'}</P>

        <H2>{sl ? '52. člen – Spremembe Pogojev' : 'Article 52 – Changes to Terms'}</H2>
        <P>{sl ? '(1) Ponudnik lahko Pogoje spremeni zaradi razvoja Storitev, sprememb zakonodaje, varnosti, poslovnega modela ali drugih utemeljenih razlogov.' : '(1) The Provider may amend these Terms due to Service development, changes in law, security, business model or other legitimate reasons.'}</P>
        <P>{sl ? '(2) Pri bistvenih spremembah bo Ponudnik uporabnike obvestil v razumnem roku pred začetkom veljavnosti, kadar je to izvedljivo.' : '(2) Material changes will be notified within a reasonable period before taking effect where practicable.'}</P>
        <P>{sl ? '(3) Če se Naročnik z bistveno spremembo ne strinja, lahko preneha uporabljati Storitev in zahteva izbris Računa.' : '(3) If the Customer does not accept a material change, it may stop using the Service and request Account deletion.'}</P>

        <H2>{sl ? '53. člen – Prenos razmerja in sprememba ponudnika' : 'Article 53 – Assignment and change of Provider'}</H2>
        <P>{sl ? '(1) Ponudnik lahko v prihodnje prenese upravljanje, razvoj ali zagotavljanje Obrtdesk na novo ustanovljeno ali drugo povezano pravno osebo oziroma poslovni subjekt, če je tak prenos zakonit.' : '(1) The Provider may in future transfer the operation, development or provision of Obrtdesk to a newly established or other affiliated legal entity or business where lawful.'}</P>
        <P>{sl ? '(2) Če bi tak prenos pomenil spremembo upravljavca osebnih podatkov ali pogodbenega ponudnika, bodo uporabniki o tem ustrezno obveščeni.' : '(2) If such transfer changes the controller of personal data or contractual provider, users will be appropriately informed.'}</P>
        <P>{sl ? '(3) Naročnik ne sme prenesti svojih pravic iz teh Pogojev na tretjo osebo brez predhodnega soglasja Ponudnika, razen v okviru statusnega preoblikovanja ali prenosa poslovanja, če s tem ne nastane dodatno tveganje za Ponudnika.' : '(3) The Customer may not assign its rights under these Terms without prior consent, except as part of a corporate restructuring or transfer of business that does not create additional material risk to the Provider.'}</P>

        {/* XVI */}
        <H1>{sl ? 'XVI. KONČNE DOLOČBE' : 'XVI. FINAL PROVISIONS'}</H1>

        <H2>{sl ? '54. člen – Celovitost dogovora' : 'Article 54 – Entire agreement and severability'}</H2>
        <P>{sl ? '(1) Ti Pogoji skupaj z morebitnim DPA, Politiko zasebnosti in izrecno dogovorjenimi individualnimi pogoji predstavljajo dogovor glede uporabe Storitev.' : '(1) These Terms, together with any applicable DPA, Privacy Policy and expressly agreed individual terms, form the agreement governing use of the Service.'}</P>
        <P>{sl ? '(2) Če je katera določba neveljavna ali neizvršljiva, ostale določbe ostanejo v veljavi, neveljavna določba pa se razlaga ali nadomesti v obsegu, ki je najbližji njenemu zakonitemu gospodarskemu namenu.' : '(2) If a provision is invalid or unenforceable, the remaining provisions remain effective and the invalid provision shall be interpreted or replaced as closely as legally possible to its intended commercial purpose.'}</P>
        <P>{sl ? '(3) Neukrepanje Ponudnika ob posamezni kršitvi ne pomeni odpovedi pravici do uveljavljanja iste ali druge kršitve v prihodnje.' : '(3) Failure to enforce a breach does not waive the right to enforce the same or another breach later.'}</P>

        <H2>{sl ? '55. člen – Veljavno pravo' : 'Article 55 – Governing law'}</H2>
        <P>{sl ? '(1) Za te Pogoje se uporablja pravo Republike Slovenije, brez poseganja v prisilne določbe prava, ki se morebiti uporabljajo ne glede na izbiro prava.' : '(1) These Terms are governed by the laws of the Republic of Slovenia, without prejudice to mandatory laws that apply irrespective of choice of law.'}</P>
        <P>{sl ? '(2) Za vprašanja, ki niso posebej urejena, se uporabljajo veljavni predpisi Republike Slovenije in neposredno uporabljivi predpisi Evropske unije.' : '(2) Matters not expressly addressed are governed by applicable Slovenian law and directly applicable European Union law.'}</P>

        <H2>{sl ? '56. člen – Reševanje sporov' : 'Article 56 – Dispute resolution and jurisdiction'}</H2>
        <P>{sl ? '(1) Stranki si bosta prizadevali morebitni spor najprej rešiti sporazumno.' : '(1) The parties will first attempt to resolve disputes amicably.'}</P>
        <P>{sl ? '(2) Če sporazumna rešitev ni mogoča, je za spore med Ponudnikom in Naročnikom dogovorjeno stvarno pristojno sodišče v Ljubljani, Republika Slovenija, kolikor je tak dogovor o krajevni pristojnosti po veljavnem pravu dopusten. Če prisilni predpisi določajo drugače, se uporabijo ti predpisi.' : '(2) If no amicable resolution is reached, the parties agree to the competent court in Ljubljana, Republic of Slovenia, to the extent that such choice of territorial jurisdiction is permitted by applicable law. Mandatory jurisdiction rules prevail where applicable.'}</P>

        <H2>{sl ? '57. člen – Jezik' : 'Article 57 – Language'}</H2>
        <P>{sl ? '(1) Pogoji so lahko objavljeni v slovenskem in angleškem jeziku.' : '(1) These Terms may be published in Slovenian and English.'}</P>
        <P>{sl ? '(2) Če med različicama pride do vsebinskega neskladja, ima za razmerje, ki se presoja po slovenskem pravu, prednost slovenska različica, razen če je z Naročnikom izrecno dogovorjeno drugače.' : '(2) In case of inconsistency, the Slovenian version prevails for relationships governed by Slovenian law unless expressly agreed otherwise with the Customer.'}</P>

        {/* Annexes */}
        <H1>{sl ? 'PRILOGA 1 – PODOBDELOVALCI IN INFRASTRUKTURNI PONUDNIKI' : 'SCHEDULE 1 – SUBPROCESSORS AND INFRASTRUCTURE PROVIDERS'}</H1>
        <Table
          headers={sl ? ['Ponudnik', 'Pravna oseba in naslov', 'Namen'] : ['Provider', 'Legal entity and address', 'Purpose']}
          rows={[
            ['Supabase', 'SUPABASE PTE. LTD., 65 Chulia Street #38-02/03, OCBC Centre, Singapore 049513, Singapore', sl ? 'PostgreSQL podatkovna baza, avtentikacija in povezane backend storitve' : 'PostgreSQL database, authentication and related backend services'],
            ['Vercel', 'Vercel Inc., Delaware corporation, 440 N Barranca Ave #4133, Covina, CA 91723, USA', sl ? 'Gostovanje, izvajanje in globalna dostava spletne aplikacije' : 'Hosting, execution and global delivery of the web application'],
          ]}
        />
        <P>{sl ? 'Seznam se lahko spremeni, če Ponudnik spremeni infrastrukturo ali doda dodatne ponudnike. V takem primeru bo aktualni seznam objavljen ali drugače dan na voljo Naročnikom.' : 'This list may change if the Provider changes infrastructure or adds additional providers. The current list will be published or otherwise made available to Customers.'}</P>

        <H1>{sl ? 'PRILOGA 2 – POVZETEK TEHNIČNIH IN ORGANIZACIJSKIH UKREPOV' : 'SCHEDULE 2 – SUMMARY OF TECHNICAL AND ORGANISATIONAL MEASURES'}</H1>
        <P>{sl ? 'Ponudnik glede na trenutno beta fazo in dejansko arhitekturo uporablja oziroma namerava vzdrževati zlasti naslednje kategorije ukrepov:' : 'Taking into account the current beta stage and actual architecture, the Provider uses or intends to maintain the following categories of measures:'}</P>
        <Ul items={sl ? [
          'avtentikacijo in nadzor dostopa;',
          'ločevanje dostopa med različnimi uporabniki oziroma organizacijami;',
          'HTTPS/TLS za prenos podatkov;',
          'varno upravljanje skrivnosti in servisnih ključev;',
          'omejen administratorski dostop;',
          'uporabo varnostnih funkcij Supabase in Vercel;',
          'posodobitve aplikacijske kode in odvisnosti;',
          'spremljanje napak in relevantnih varnostnih dogodkov, kjer je tehnično omogočeno;',
          'varnostno kopiranje v obsegu, ki ga omogoča uporabljena infrastruktura;',
          'postopke za odziv na varnostne incidente;',
          'načelo najmanjših potrebnih pravic;',
          'periodičen pregled dostopov in konfiguracije, ko se ekipa in obseg Storitev povečujeta.',
        ] : [
          'authentication and access control;',
          'separation of access between different users or organisations;',
          'HTTPS/TLS for data transmission;',
          'secure management of secrets and service keys;',
          'restricted administrative access;',
          'use of Supabase and Vercel security controls;',
          'updates of application code and dependencies;',
          'monitoring of errors and relevant security events where technically enabled;',
          'backups to the extent supported by the infrastructure used;',
          'incident-response procedures;',
          'least-privilege principles;',
          'periodic review of access and configuration as the team and Service scale.',
        ]} />

        {/* Footer */}
        <div className="mt-12 pt-6 border-t border-gray-200 text-sm text-gray-500 space-y-1">
          <div><strong>{sl ? 'Kontakt:' : 'Contact:'}</strong> info@bimetric.si</div>
          <div><strong>{sl ? 'Ponudnik:' : 'Provider:'}</strong> Bimetric</div>
          <div><strong>{sl ? 'Storitev:' : 'Service:'}</strong> Obrtdesk</div>
        </div>
      </div>
    </div>
  )
}
