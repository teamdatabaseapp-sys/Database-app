/**
 * Country-based Legal Compliance Data
 *
 * This file contains localized legal disclaimers for email marketing compliance
 * based on the user's selected country/region. Each entry includes the applicable
 * laws and is displayed in the official language of that country.
 *
 * Also includes dynamic email footer generation based on country/state and language.
 */

import { CountryCode, Language, CurrencyCode } from './types';

// Country to Currency mapping
export const COUNTRY_CURRENCY_MAP: Record<CountryCode, CurrencyCode> = {
  // North America
  US: 'USD',
  CA: 'CAD',
  MX: 'MXN',

  // Europe - Western (Eurozone)
  DE: 'EUR',
  FR: 'EUR',
  IT: 'EUR',
  ES: 'EUR',
  PT: 'EUR',
  NL: 'EUR',
  BE: 'EUR',
  AT: 'EUR',
  IE: 'EUR',
  LU: 'EUR',
  MC: 'EUR',

  // Europe - Non-Eurozone
  GB: 'GBP',
  CH: 'CHF',
  SE: 'SEK',
  NO: 'NOK',
  DK: 'DKK',
  PL: 'PLN',
  IS: 'ISK',
  FI: 'EUR',

  // Europe - Eastern
  RU: 'RUB',
  TR: 'TRY',
  BY: 'RUB', // Belarus uses Russian Ruble commonly
  KZ: 'RUB', // Kazakhstan uses Russian Ruble commonly
  UA: 'EUR', // Ukraine moving toward EUR

  // Asia Pacific
  AU: 'AUD',
  NZ: 'NZD',
  JP: 'JPY',
  KR: 'KRW',
  CN: 'CNY',
  TW: 'TWD',
  SG: 'SGD',
  HK: 'HKD',
  IN: 'INR',

  // Central America & Caribbean
  GT: 'USD', // Guatemala uses USD commonly
  CU: 'USD', // Cuba uses USD for tourism
  DO: 'USD', // Dominican Republic uses USD commonly
  HN: 'USD', // Honduras uses USD commonly
  SV: 'USD', // El Salvador uses USD officially
  NI: 'USD', // Nicaragua uses USD commonly
  CR: 'USD', // Costa Rica uses USD commonly
  PA: 'USD', // Panama uses USD officially
  HT: 'USD', // Haiti uses USD commonly
  PR: 'USD', // Puerto Rico uses USD

  // South America
  BR: 'BRL',
  AR: 'ARS',
  CL: 'CLP',
  CO: 'COP',
  PE: 'PEN',
  VE: 'USD', // Venezuela uses USD due to inflation
  EC: 'USD', // Ecuador uses USD officially
  BO: 'USD', // Bolivia uses USD commonly
  PY: 'USD', // Paraguay uses USD commonly
  UY: 'USD', // Uruguay uses USD commonly

  // Middle East
  AE: 'AED',
  SA: 'SAR',
  EG: 'EGP',
  MA: 'MAD',
  DZ: 'MAD', // Algeria - using MAD as closest
  TN: 'EUR', // Tunisia uses EUR commonly
  JO: 'USD', // Jordan uses USD commonly
  LB: 'USD', // Lebanon uses USD commonly
  KW: 'AED', // Kuwait - using AED as regional
  QA: 'AED', // Qatar - using AED as regional
  BH: 'AED', // Bahrain - using AED as regional
  OM: 'AED', // Oman - using AED as regional
  IQ: 'USD', // Iraq uses USD commonly
  SY: 'USD', // Syria uses USD commonly
  LY: 'USD', // Libya uses USD commonly

  // Africa
  ZA: 'ZAR',
  CI: 'EUR', // Ivory Coast uses EUR commonly
  SN: 'EUR', // Senegal uses EUR commonly
  CM: 'EUR', // Cameroon uses EUR commonly
  CD: 'USD', // DR Congo uses USD commonly
  SD: 'USD', // Sudan uses USD commonly
};

/**
 * Get the default currency for a country
 */
export function getCurrencyForCountry(countryCode: CountryCode): CurrencyCode {
  return COUNTRY_CURRENCY_MAP[countryCode] || 'USD';
}

// US State codes and names
export interface USState {
  code: string;
  name: string;
}

export const US_STATES: USState[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
  { code: 'DC', name: 'District of Columbia' },
];

export interface CountryLegalInfo {
  code: CountryCode;
  name: string;
  nativeName: string;
  language: Language;
  region?: string; // For countries with state-level laws (e.g., US states)
  flag: string;
}

export interface EmailComplianceDisclaimer {
  title: string;
  disclaimer: string;
  lawReference: string;
}

// Country metadata with native names and associated languages
export const COUNTRIES: CountryLegalInfo[] = [
  // North America
  { code: 'US', name: 'United States', nativeName: 'United States', language: 'en', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', nativeName: 'Canada', language: 'en', flag: '🇨🇦' },
  { code: 'MX', name: 'Mexico', nativeName: 'México', language: 'es', flag: '🇲🇽' },

  // Europe - Western
  { code: 'GB', name: 'United Kingdom', nativeName: 'United Kingdom', language: 'en', flag: '🇬🇧' },
  { code: 'IE', name: 'Ireland', nativeName: 'Ireland', language: 'en', flag: '🇮🇪' },
  { code: 'DE', name: 'Germany', nativeName: 'Deutschland', language: 'de', flag: '🇩🇪' },
  { code: 'AT', name: 'Austria', nativeName: 'Österreich', language: 'de', flag: '🇦🇹' },
  { code: 'CH', name: 'Switzerland', nativeName: 'Schweiz', language: 'de', flag: '🇨🇭' },
  { code: 'FR', name: 'France', nativeName: 'France', language: 'fr', flag: '🇫🇷' },
  { code: 'BE', name: 'Belgium', nativeName: 'België / Belgique', language: 'nl', flag: '🇧🇪' },
  { code: 'NL', name: 'Netherlands', nativeName: 'Nederland', language: 'nl', flag: '🇳🇱' },
  { code: 'ES', name: 'Spain', nativeName: 'España', language: 'es', flag: '🇪🇸' },
  { code: 'PT', name: 'Portugal', nativeName: 'Portugal', language: 'pt', flag: '🇵🇹' },
  { code: 'IT', name: 'Italy', nativeName: 'Italia', language: 'it', flag: '🇮🇹' },
  { code: 'LU', name: 'Luxembourg', nativeName: 'Luxembourg', language: 'fr', flag: '🇱🇺' },
  { code: 'MC', name: 'Monaco', nativeName: 'Monaco', language: 'fr', flag: '🇲🇨' },

  // Europe - Nordic
  { code: 'SE', name: 'Sweden', nativeName: 'Sverige', language: 'sv', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', nativeName: 'Norge', language: 'no', flag: '🇳🇴' },
  { code: 'DK', name: 'Denmark', nativeName: 'Danmark', language: 'da', flag: '🇩🇰' },
  { code: 'FI', name: 'Finland', nativeName: 'Suomi', language: 'fi', flag: '🇫🇮' },
  { code: 'IS', name: 'Iceland', nativeName: 'Ísland', language: 'is', flag: '🇮🇸' },

  // Europe - Eastern
  { code: 'PL', name: 'Poland', nativeName: 'Polska', language: 'en', flag: '🇵🇱' },
  { code: 'RU', name: 'Russia', nativeName: 'Россия', language: 'ru', flag: '🇷🇺' },
  { code: 'TR', name: 'Turkey', nativeName: 'Türkiye', language: 'tr', flag: '🇹🇷' },
  { code: 'BY', name: 'Belarus', nativeName: 'Беларусь', language: 'ru', flag: '🇧🇾' },
  { code: 'KZ', name: 'Kazakhstan', nativeName: 'Қазақстан', language: 'ru', flag: '🇰🇿' },
  { code: 'UA', name: 'Ukraine', nativeName: 'Україна', language: 'ru', flag: '🇺🇦' },

  // Asia Pacific
  { code: 'AU', name: 'Australia', nativeName: 'Australia', language: 'en', flag: '🇦🇺' },
  { code: 'NZ', name: 'New Zealand', nativeName: 'New Zealand', language: 'en', flag: '🇳🇿' },
  { code: 'JP', name: 'Japan', nativeName: '日本', language: 'ja', flag: '🇯🇵' },
  { code: 'KR', name: 'South Korea', nativeName: '대한민국', language: 'ko', flag: '🇰🇷' },
  { code: 'CN', name: 'China', nativeName: '中国', language: 'zh', flag: '🇨🇳' },
  { code: 'TW', name: 'Taiwan', nativeName: '台灣', language: 'zh', flag: '🇹🇼' },
  { code: 'SG', name: 'Singapore', nativeName: 'Singapore', language: 'en', flag: '🇸🇬' },
  { code: 'HK', name: 'Hong Kong', nativeName: '香港', language: 'zh', flag: '🇭🇰' },
  { code: 'IN', name: 'India', nativeName: 'India', language: 'en', flag: '🇮🇳' },

  // Central America & Caribbean
  { code: 'GT', name: 'Guatemala', nativeName: 'Guatemala', language: 'es', flag: '🇬🇹' },
  { code: 'CU', name: 'Cuba', nativeName: 'Cuba', language: 'es', flag: '🇨🇺' },
  { code: 'DO', name: 'Dominican Republic', nativeName: 'República Dominicana', language: 'es', flag: '🇩🇴' },
  { code: 'HN', name: 'Honduras', nativeName: 'Honduras', language: 'es', flag: '🇭🇳' },
  { code: 'SV', name: 'El Salvador', nativeName: 'El Salvador', language: 'es', flag: '🇸🇻' },
  { code: 'NI', name: 'Nicaragua', nativeName: 'Nicaragua', language: 'es', flag: '🇳🇮' },
  { code: 'CR', name: 'Costa Rica', nativeName: 'Costa Rica', language: 'es', flag: '🇨🇷' },
  { code: 'PA', name: 'Panama', nativeName: 'Panamá', language: 'es', flag: '🇵🇦' },
  { code: 'HT', name: 'Haiti', nativeName: 'Ayiti', language: 'ht', flag: '🇭🇹' },
  { code: 'PR', name: 'Puerto Rico', nativeName: 'Puerto Rico', language: 'es', flag: '🇵🇷' },

  // South America
  { code: 'BR', name: 'Brazil', nativeName: 'Brasil', language: 'pt', flag: '🇧🇷' },
  { code: 'AR', name: 'Argentina', nativeName: 'Argentina', language: 'es', flag: '🇦🇷' },
  { code: 'CL', name: 'Chile', nativeName: 'Chile', language: 'es', flag: '🇨🇱' },
  { code: 'CO', name: 'Colombia', nativeName: 'Colombia', language: 'es', flag: '🇨🇴' },
  { code: 'PE', name: 'Peru', nativeName: 'Perú', language: 'es', flag: '🇵🇪' },
  { code: 'VE', name: 'Venezuela', nativeName: 'Venezuela', language: 'es', flag: '🇻🇪' },
  { code: 'EC', name: 'Ecuador', nativeName: 'Ecuador', language: 'es', flag: '🇪🇨' },
  { code: 'BO', name: 'Bolivia', nativeName: 'Bolivia', language: 'es', flag: '🇧🇴' },
  { code: 'PY', name: 'Paraguay', nativeName: 'Paraguay', language: 'es', flag: '🇵🇾' },
  { code: 'UY', name: 'Uruguay', nativeName: 'Uruguay', language: 'es', flag: '🇺🇾' },

  // Africa
  { code: 'ZA', name: 'South Africa', nativeName: 'South Africa', language: 'en', flag: '🇿🇦' },
  { code: 'CI', name: 'Ivory Coast', nativeName: 'Côte d\'Ivoire', language: 'fr', flag: '🇨🇮' },
  { code: 'SN', name: 'Senegal', nativeName: 'Sénégal', language: 'fr', flag: '🇸🇳' },
  { code: 'CM', name: 'Cameroon', nativeName: 'Cameroun', language: 'fr', flag: '🇨🇲' },
  { code: 'CD', name: 'Democratic Republic of Congo', nativeName: 'République démocratique du Congo', language: 'fr', flag: '🇨🇩' },
];

// Get country by code
export function getCountryByCode(code: CountryCode): CountryLegalInfo | undefined {
  return COUNTRIES.find(c => c.code === code);
}

// Get all countries sorted by native name
export function getAllCountries(): CountryLegalInfo[] {
  return [...COUNTRIES].sort((a, b) => a.nativeName.localeCompare(b.nativeName));
}

// Email compliance disclaimers by country - displayed in the country's official language
export const EMAIL_COMPLIANCE_DISCLAIMERS: Record<CountryCode, EmailComplianceDisclaimer> = {
  // United States - English
  US: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the CAN-SPAM Act (15 U.S.C. § 7701 et seq.) and applicable state laws including the California Consumer Privacy Act (CCPA). All commercial emails must include accurate header information, a clear subject line, identification as an advertisement, your valid physical postal address, and a clear opt-out mechanism. Opt-out requests must be honored within 10 business days. Violations can result in penalties up to $50,120 per email.',
    lawReference: 'CAN-SPAM Act, CCPA, State Consumer Protection Laws',
  },

  // Canada - English
  CA: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with Canada\'s Anti-Spam Legislation (CASL). You must have express or implied consent before sending commercial electronic messages. All emails must clearly identify the sender, include valid contact information, and provide a functional unsubscribe mechanism. Consent records must be maintained. Penalties can reach up to $10 million CAD for organizations.',
    lawReference: 'Canada\'s Anti-Spam Legislation (CASL)',
  },

  // Mexico - Spanish
  MX: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley Federal de Protección de Datos Personales en Posesión de los Particulares (LFPDPPP). Debe obtener consentimiento previo para enviar comunicaciones comerciales, proporcionar información clara sobre su identidad y ofrecer un mecanismo sencillo para darse de baja. El incumplimiento puede resultar en multas significativas.',
    lawReference: 'Ley Federal de Protección de Datos Personales (LFPDPPP)',
  },

  // United Kingdom - English
  GB: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the UK GDPR and the Privacy and Electronic Communications Regulations (PECR). You must have valid consent or legitimate interest before sending marketing emails. All emails must clearly identify your organization, include your contact details, and provide a simple opt-out mechanism. You must also comply with data protection requirements under UK law.',
    lawReference: 'UK GDPR, Privacy and Electronic Communications Regulations (PECR)',
  },

  // Ireland - English
  IE: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the EU General Data Protection Regulation (GDPR) as implemented in Ireland and the ePrivacy Regulations. Prior consent is required for marketing communications. All emails must identify the sender, provide contact information, and include an easy unsubscribe option. Data protection principles must be followed at all times.',
    lawReference: 'EU GDPR, Irish ePrivacy Regulations',
  },

  // Germany - German
  DE: {
    title: 'E-Mail-Kampagnen-Compliance',
    disclaimer: 'Ihre E-Mail-Kommunikation muss der EU-Datenschutz-Grundverordnung (DSGVO) und dem deutschen Gesetz gegen den unlauteren Wettbewerb (UWG) entsprechen. Sie benötigen eine ausdrückliche vorherige Einwilligung für Werbe-E-Mails. Alle E-Mails müssen den Absender klar identifizieren, eine gültige Impressumsangabe enthalten und eine einfache Abmeldemöglichkeit bieten. Verstöße können zu erheblichen Bußgeldern führen.',
    lawReference: 'DSGVO, Gesetz gegen den unlauteren Wettbewerb (UWG)',
  },

  // Austria - German
  AT: {
    title: 'E-Mail-Kampagnen-Compliance',
    disclaimer: 'Ihre E-Mail-Kommunikation muss der EU-Datenschutz-Grundverordnung (DSGVO) und dem österreichischen Telekommunikationsgesetz (TKG) entsprechen. Eine ausdrückliche Einwilligung ist für kommerzielle E-Mails erforderlich. Alle Nachrichten müssen den Absender identifizieren, Kontaktinformationen enthalten und eine klare Abmeldemöglichkeit bieten.',
    lawReference: 'DSGVO, Telekommunikationsgesetz (TKG)',
  },

  // Switzerland - German
  CH: {
    title: 'E-Mail-Kampagnen-Compliance',
    disclaimer: 'Ihre E-Mail-Kommunikation muss dem Schweizer Datenschutzgesetz (DSG) und dem Bundesgesetz gegen den unlauteren Wettbewerb (UWG) entsprechen. Werbung per E-Mail ist nur mit vorheriger Einwilligung oder bestehender Kundenbeziehung zulässig. Alle E-Mails müssen den Absender klar identifizieren und eine Abmeldemöglichkeit enthalten.',
    lawReference: 'Datenschutzgesetz (DSG), Bundesgesetz gegen den unlauteren Wettbewerb (UWG)',
  },

  // France - French
  FR: {
    title: 'Conformité des Campagnes Email',
    disclaimer: 'Vos communications par email doivent être conformes au Règlement Général sur la Protection des Données (RGPD) et à la loi Informatique et Libertés. Le consentement préalable est requis pour les emails marketing. Tous les emails doivent identifier clairement l\'expéditeur, inclure vos coordonnées et offrir un mécanisme de désinscription simple. Les violations peuvent entraîner des amendes significatives.',
    lawReference: 'RGPD, Loi Informatique et Libertés',
  },

  // Belgium - Dutch
  BE: {
    title: 'Naleving E-mailcampagnes',
    disclaimer: 'Uw e-mailcommunicatie moet voldoen aan de Algemene Verordening Gegevensbescherming (AVG) en de Belgische wetgeving inzake elektronische communicatie. Voorafgaande toestemming is vereist voor marketingberichten. Alle e-mails moeten de afzender duidelijk identificeren, contactgegevens bevatten en een eenvoudige uitschrijfmogelijkheid bieden.',
    lawReference: 'AVG (GDPR), Belgische Wet Elektronische Communicatie',
  },

  // Netherlands - Dutch
  NL: {
    title: 'Naleving E-mailcampagnes',
    disclaimer: 'Uw e-mailcommunicatie moet voldoen aan de Algemene Verordening Gegevensbescherming (AVG) en de Telecommunicatiewet. Voorafgaande toestemming is vereist voor commerciële e-mails, tenzij er een bestaande klantrelatie is. Alle e-mails moeten de afzender identificeren, contactgegevens bevatten en een duidelijke uitschrijfmogelijkheid bieden. Overtredingen kunnen leiden tot boetes tot €900.000.',
    lawReference: 'AVG (GDPR), Telecommunicatiewet',
  },

  // Spain - Spanish
  ES: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con el Reglamento General de Protección de Datos (RGPD) y la Ley de Servicios de la Sociedad de la Información (LSSI). Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'RGPD, Ley de Servicios de la Sociedad de la Información (LSSI)',
  },

  // Portugal - Portuguese
  PT: {
    title: 'Conformidade de Campanhas de Email',
    disclaimer: 'As suas comunicações por email devem estar em conformidade com o Regulamento Geral sobre a Proteção de Dados (RGPD) e a Lei das Comunicações Eletrónicas. É necessário consentimento prévio para emails de marketing. Todos os emails devem identificar claramente o remetente, incluir informações de contacto e oferecer um mecanismo simples de cancelamento de subscrição.',
    lawReference: 'RGPD, Lei das Comunicações Eletrónicas',
  },

  // Italy - Italian
  IT: {
    title: 'Conformità Campagne Email',
    disclaimer: 'Le vostre comunicazioni email devono essere conformi al Regolamento Generale sulla Protezione dei Dati (GDPR) e al Codice della Privacy italiano. È richiesto il consenso preventivo per le email di marketing. Tutte le email devono identificare chiaramente il mittente, includere i dati di contatto e offrire un meccanismo semplice di disiscrizione. Le violazioni possono comportare sanzioni significative.',
    lawReference: 'GDPR, Codice della Privacy',
  },

  // Sweden - Swedish
  SE: {
    title: 'E-postkampanjers Efterlevnad',
    disclaimer: 'Din e-postkommunikation måste följa EU:s allmänna dataskyddsförordning (GDPR) och lagen om elektronisk kommunikation. Förhandssamtycke krävs för marknadsföringsmeddelanden. Alla e-postmeddelanden måste tydligt identifiera avsändaren, innehålla kontaktuppgifter och erbjuda en enkel avregistreringsmekanism. Överträdelser kan leda till betydande böter.',
    lawReference: 'GDPR, Lagen om elektronisk kommunikation',
  },

  // Norway - Norwegian
  NO: {
    title: 'Overholdelse av E-postkampanjer',
    disclaimer: 'Din e-postkommunikasjon må overholde EUs personvernforordning (GDPR) som implementert i Norge og markedsføringsloven. Forhåndssamtykke er påkrevd for markedsføringse-poster. Alle e-poster må tydelig identifisere avsender, inkludere kontaktinformasjon og tilby en enkel avmeldingsmekanisme.',
    lawReference: 'GDPR, Markedsføringsloven',
  },

  // Denmark - Danish
  DK: {
    title: 'Overholdelse af E-mailkampagner',
    disclaimer: 'Din e-mailkommunikation skal overholde EU\'s generelle databeskyttelsesforordning (GDPR) og markedsføringsloven. Forudgående samtykke er påkrævet for markedsføringsmails. Alle e-mails skal tydeligt identificere afsenderen, indeholde kontaktoplysninger og tilbyde en nem afmeldingsmekanisme.',
    lawReference: 'GDPR, Markedsføringsloven',
  },

  // Finland - Finnish
  FI: {
    title: 'Sähköpostikampanjoiden Vaatimustenmukaisuus',
    disclaimer: 'Sähköpostiviestintäsi on noudatettava EU:n yleistä tietosuoja-asetusta (GDPR) ja sähköisen viestinnän palveluista annettua lakia. Markkinointiviesteille vaaditaan ennakkosuostumus. Kaikissa sähköposteissa on selkeästi tunnistettava lähettäjä, sisällytettävä yhteystiedot ja tarjottava helppo tapa peruuttaa tilaus.',
    lawReference: 'GDPR, Laki sähköisen viestinnän palveluista',
  },

  // Iceland - Icelandic
  IS: {
    title: 'Fylgni Tölvupóstsherferða',
    disclaimer: 'Tölvupóstssamskipti þín verða að vera í samræmi við almenna persónuverndarreglugerð ESB (GDPR) eins og hún er innleidd á Íslandi og lög um rafræn viðskipti. Fyrirfram samþykki er krafist fyrir markaðspósta. Allir tölvupóstar verða að auðkenna sendanda greinilega, innihalda tengiliðaupplýsingar og bjóða upp á einfaldan afskráningarvalkost.',
    lawReference: 'GDPR, Lög um rafræn viðskipti og aðra rafræna þjónustu',
  },

  // Poland - English (as Polish is not in supported languages)
  PL: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the EU General Data Protection Regulation (GDPR) as implemented in Poland and the Act on Providing Services by Electronic Means. Prior consent is required for marketing emails. All emails must clearly identify the sender, include contact information, and provide an easy unsubscribe option.',
    lawReference: 'GDPR, Act on Providing Services by Electronic Means',
  },

  // Russia - Russian
  RU: {
    title: 'Соответствие Email-кампаний',
    disclaimer: 'Ваши электронные сообщения должны соответствовать Федеральному закону «О персональных данных» (152-ФЗ) и Федеральному закону «О рекламе». Для отправки рекламных сообщений требуется предварительное согласие получателя. Все письма должны четко идентифицировать отправителя, содержать контактную информацию и предоставлять простой способ отказа от рассылки.',
    lawReference: 'Федеральный закон «О персональных данных» (152-ФЗ), Федеральный закон «О рекламе»',
  },

  // Turkey - Turkish
  TR: {
    title: 'E-posta Kampanyası Uyumluluğu',
    disclaimer: 'E-posta iletişimleriniz Kişisel Verilerin Korunması Kanunu (KVKK) ve Elektronik Ticaretin Düzenlenmesi Hakkında Kanun\'a uygun olmalıdır. Ticari e-postalar için önceden onay alınması zorunludur. Tüm e-postalar göndereni açıkça belirtmeli, iletişim bilgilerini içermeli ve kolay bir abonelik iptal mekanizması sunmalıdır.',
    lawReference: 'KVKK, Elektronik Ticaretin Düzenlenmesi Hakkında Kanun',
  },

  // Australia - English
  AU: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the Spam Act 2003 and the Privacy Act 1988. You must have consent before sending commercial electronic messages. All emails must accurately identify the sender, include contact information, and provide a functional unsubscribe facility. Unsubscribe requests must be honored within 5 business days. Penalties can reach up to $2.22 million AUD per day.',
    lawReference: 'Spam Act 2003, Privacy Act 1988',
  },

  // New Zealand - English
  NZ: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the Unsolicited Electronic Messages Act 2007 and the Privacy Act 2020. Consent is required before sending commercial electronic messages. All emails must clearly identify the sender, include contact information, and provide a functional unsubscribe mechanism.',
    lawReference: 'Unsolicited Electronic Messages Act 2007, Privacy Act 2020',
  },

  // Japan - Japanese
  JP: {
    title: 'メールキャンペーンのコンプライアンス',
    disclaimer: '電子メール通信は、特定電子メール法および個人情報保護法に準拠する必要があります。商業メールの送信には事前の同意が必要です。すべてのメールには送信者を明確に特定し、連絡先情報を含め、簡単な配信停止方法を提供する必要があります。違反には罰則が科される場合があります。',
    lawReference: '特定電子メール法、個人情報保護法',
  },

  // South Korea - Korean
  KR: {
    title: '이메일 캠페인 준수',
    disclaimer: '이메일 통신은 정보통신망법 및 개인정보보호법을 준수해야 합니다. 상업적 이메일 발송에는 사전 동의가 필요합니다. 모든 이메일은 발신자를 명확히 식별하고, 연락처 정보를 포함하며, 간편한 수신거부 방법을 제공해야 합니다. 위반 시 과태료가 부과될 수 있습니다.',
    lawReference: '정보통신망 이용촉진 및 정보보호 등에 관한 법률, 개인정보보호법',
  },

  // China - Chinese
  CN: {
    title: '电子邮件营销合规',
    disclaimer: '您的电子邮件通信必须遵守《中华人民共和国个人信息保护法》和《中华人民共和国网络安全法》。发送商业电子邮件需要事先获得同意。所有邮件必须明确标识发件人，包含联系信息，并提供简便的退订机制。违规可能导致严重处罚。',
    lawReference: '个人信息保护法、网络安全法',
  },

  // Taiwan - Chinese
  TW: {
    title: '電子郵件行銷合規',
    disclaimer: '您的電子郵件通訊必須遵守《個人資料保護法》。發送商業電子郵件需要事先取得同意。所有郵件必須明確標識寄件人，包含聯絡資訊，並提供簡便的退訂機制。',
    lawReference: '個人資料保護法',
  },

  // Singapore - English
  SG: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the Personal Data Protection Act (PDPA) and the Spam Control Act. Prior consent is required for sending commercial messages. All emails must clearly identify the sender, include contact information, and provide a functional unsubscribe mechanism. Violations can result in significant fines.',
    lawReference: 'Personal Data Protection Act (PDPA), Spam Control Act',
  },

  // Hong Kong - Chinese
  HK: {
    title: '電郵推廣合規',
    disclaimer: '您的電郵通訊必須遵守《個人資料（私隱）條例》及《非應邀電子訊息條例》。發送商業電子郵件需要事先取得同意。所有郵件必須明確標識寄件人，包含聯絡資訊，並提供簡便的退訂機制。',
    lawReference: '個人資料（私隱）條例、非應邀電子訊息條例',
  },

  // India - English
  IN: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the Information Technology Act 2000 and the Digital Personal Data Protection Act 2023. Consent is required for sending commercial communications. All emails must clearly identify the sender, include contact information, and provide an easy unsubscribe option.',
    lawReference: 'Information Technology Act 2000, Digital Personal Data Protection Act 2023',
  },

  // Brazil - Portuguese
  BR: {
    title: 'Conformidade de Campanhas de Email',
    disclaimer: 'Suas comunicações por email devem estar em conformidade com a Lei Geral de Proteção de Dados (LGPD). É necessário consentimento prévio para enviar emails de marketing. Todos os emails devem identificar claramente o remetente, incluir informações de contato e oferecer um mecanismo simples de cancelamento de inscrição. Violações podem resultar em multas de até 2% do faturamento.',
    lawReference: 'Lei Geral de Proteção de Dados (LGPD)',
  },

  // Argentina - Spanish
  AR: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley de Protección de Datos Personales (Ley 25.326). Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley de Protección de Datos Personales (Ley 25.326)',
  },

  // Chile - Spanish
  CL: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley sobre Protección de la Vida Privada (Ley 19.628). Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley sobre Protección de la Vida Privada (Ley 19.628)',
  },

  // Colombia - Spanish
  CO: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley Estatutaria 1581 de 2012 de Protección de Datos Personales. Se requiere autorización previa para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley Estatutaria 1581 de 2012',
  },

  // Peru - Spanish
  PE: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley de Protección de Datos Personales (Ley 29733). Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley de Protección de Datos Personales (Ley 29733)',
  },

  // UAE - Arabic
  AE: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع قانون حماية البيانات الشخصية في دولة الإمارات العربية المتحدة. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قانون حماية البيانات الشخصية',
  },

  // Saudi Arabia - Arabic
  SA: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع نظام حماية البيانات الشخصية في المملكة العربية السعودية. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التجارية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'نظام حماية البيانات الشخصية',
  },

  // Egypt - Arabic
  EG: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع قانون حماية البيانات الشخصية المصري (القانون رقم 151 لسنة 2020). يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قانون حماية البيانات الشخصية (القانون رقم 151 لسنة 2020)',
  },

  // Morocco - Arabic
  MA: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع القانون رقم 09-08 المتعلق بحماية الأشخاص الذاتيين تجاه معالجة المعطيات ذات الطابع الشخصي. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'القانون رقم 09-08',
  },

  // South Africa - English
  ZA: {
    title: 'Email Campaign Compliance',
    disclaimer: 'Your email communications must comply with the Protection of Personal Information Act (POPIA) and the Consumer Protection Act. Prior consent is required for sending direct marketing communications. All emails must clearly identify the sender, include contact information, and provide an easy opt-out mechanism. Data subjects have the right to object to direct marketing at any time.',
    lawReference: 'Protection of Personal Information Act (POPIA), Consumer Protection Act',
  },

  // Luxembourg - French
  LU: {
    title: 'Conformité des Campagnes Email',
    disclaimer: 'Vos communications par email doivent être conformes au Règlement Général sur la Protection des Données (RGPD) et à la législation luxembourgeoise. Le consentement préalable est requis pour les emails marketing. Tous les emails doivent identifier clairement l\'expéditeur, inclure vos coordonnées et offrir un mécanisme de désinscription simple.',
    lawReference: 'RGPD, Loi luxembourgeoise sur la protection des données',
  },

  // Monaco - French
  MC: {
    title: 'Conformité des Campagnes Email',
    disclaimer: 'Vos communications par email doivent être conformes à la Loi n° 1.165 sur la protection des informations nominatives. Le consentement préalable est requis pour les emails marketing. Tous les emails doivent identifier clairement l\'expéditeur, inclure vos coordonnées et offrir un mécanisme de désinscription simple.',
    lawReference: 'Loi n° 1.165 sur la protection des informations nominatives',
  },

  // Belarus - Russian
  BY: {
    title: 'Соответствие Email-кампаний',
    disclaimer: 'Ваши электронные сообщения должны соответствовать Закону Республики Беларусь «О персональных данных» и Закону «О рекламе». Для отправки рекламных сообщений требуется предварительное согласие получателя. Все письма должны четко идентифицировать отправителя, содержать контактную информацию и предоставлять простой способ отказа от рассылки.',
    lawReference: 'Закон «О персональных данных», Закон «О рекламе»',
  },

  // Kazakhstan - Russian
  KZ: {
    title: 'Соответствие Email-кампаний',
    disclaimer: 'Ваши электронные сообщения должны соответствовать Закону Республики Казахстан «О персональных данных и их защите». Для отправки рекламных сообщений требуется предварительное согласие получателя. Все письма должны четко идентифицировать отправителя, содержать контактную информацию и предоставлять простой способ отказа от рассылки.',
    lawReference: 'Закон «О персональных данных и их защите»',
  },

  // Ukraine - Russian
  UA: {
    title: 'Соответствие Email-кампаний',
    disclaimer: 'Ваши электронные сообщения должны соответствовать Закону Украины «О защите персональных данных». Для отправки рекламных сообщений требуется предварительное согласие получателя. Все письма должны четко идентифицировать отправителя, содержать контактную информацию и предоставлять простой способ отказа от рассылки.',
    lawReference: 'Закон Украины «О защите персональных данных»',
  },

  // Guatemala - Spanish
  GT: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley de Acceso a la Información Pública y las normas de protección de datos personales de Guatemala. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley de Acceso a la Información Pública',
  },

  // Cuba - Spanish
  CU: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con las regulaciones cubanas de comunicaciones electrónicas. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Regulaciones de Comunicaciones Electrónicas de Cuba',
  },

  // Dominican Republic - Spanish
  DO: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley General de Protección de Datos Personales (Ley 172-13). Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley General de Protección de Datos Personales (Ley 172-13)',
  },

  // Honduras - Spanish
  HN: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley de Transparencia y Acceso a la Información Pública de Honduras. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley de Transparencia y Acceso a la Información Pública',
  },

  // El Salvador - Spanish
  SV: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la legislación salvadoreña de protección de datos. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Legislación de Protección de Datos de El Salvador',
  },

  // Nicaragua - Spanish
  NI: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley de Protección de Datos Personales de Nicaragua (Ley No. 787). Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley de Protección de Datos Personales (Ley No. 787)',
  },

  // Costa Rica - Spanish
  CR: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales (Ley 8968). Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley de Protección de la Persona frente al Tratamiento de sus Datos Personales (Ley 8968)',
  },

  // Panama - Spanish
  PA: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley 81 de Protección de Datos Personales de Panamá. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley 81 de Protección de Datos Personales',
  },

  // Haiti - French
  HT: {
    title: 'Conformité des Campagnes Email',
    disclaimer: 'Vos communications par email doivent être conformes aux lois haïtiennes sur les communications électroniques. Le consentement préalable est requis pour les emails marketing. Tous les emails doivent identifier clairement l\'expéditeur, inclure vos coordonnées et offrir un mécanisme de désinscription simple.',
    lawReference: 'Lois haïtiennes sur les communications électroniques',
  },

  // Puerto Rico - Spanish
  PR: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley CAN-SPAM de Estados Unidos y las regulaciones de Puerto Rico. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'CAN-SPAM Act, Regulaciones de Puerto Rico',
  },

  // Venezuela - Spanish
  VE: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley Especial contra los Delitos Informáticos y las regulaciones de protección de datos de Venezuela. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley Especial contra los Delitos Informáticos',
  },

  // Ecuador - Spanish
  EC: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley Orgánica de Protección de Datos Personales de Ecuador. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley Orgánica de Protección de Datos Personales',
  },

  // Bolivia - Spanish
  BO: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Constitución Política del Estado y las regulaciones de protección de datos de Bolivia. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Constitución Política del Estado de Bolivia',
  },

  // Paraguay - Spanish
  PY: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley de Protección de Datos Personales Crediticios de Paraguay. Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley de Protección de Datos Personales Crediticios',
  },

  // Uruguay - Spanish
  UY: {
    title: 'Cumplimiento de Campañas de Email',
    disclaimer: 'Sus comunicaciones por correo electrónico deben cumplir con la Ley de Protección de Datos Personales y Acción de Habeas Data (Ley 18.331). Se requiere consentimiento previo para enviar comunicaciones comerciales. Todos los emails deben identificar claramente al remitente, incluir datos de contacto y ofrecer un mecanismo sencillo de cancelación de suscripción.',
    lawReference: 'Ley de Protección de Datos Personales y Acción de Habeas Data (Ley 18.331)',
  },

  // Algeria - Arabic
  DZ: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع القانون رقم 18-07 المتعلق بحماية الأشخاص الطبيعيين في مجال معالجة المعطيات ذات الطابع الشخصي. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'القانون رقم 18-07',
  },

  // Tunisia - Arabic
  TN: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع القانون الأساسي عدد 63 لسنة 2004 المتعلق بحماية المعطيات الشخصية. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'القانون الأساسي عدد 63 لسنة 2004',
  },

  // Jordan - Arabic
  JO: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع قانون حماية البيانات الشخصية الأردني. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قانون حماية البيانات الشخصية',
  },

  // Lebanon - Arabic
  LB: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع قانون المعاملات الإلكترونية والبيانات ذات الطابع الشخصي اللبناني. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قانون المعاملات الإلكترونية والبيانات ذات الطابع الشخصي',
  },

  // Kuwait - Arabic
  KW: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع قانون حماية البيانات الشخصية الكويتي. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قانون حماية البيانات الشخصية',
  },

  // Qatar - Arabic
  QA: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع قانون حماية خصوصية البيانات الشخصية في قطر. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قانون حماية خصوصية البيانات الشخصية',
  },

  // Bahrain - Arabic
  BH: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع قانون حماية البيانات الشخصية في مملكة البحرين. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قانون حماية البيانات الشخصية',
  },

  // Oman - Arabic
  OM: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع قانون حماية البيانات الشخصية في سلطنة عمان. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قانون حماية البيانات الشخصية',
  },

  // Iraq - Arabic
  IQ: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع القوانين العراقية المتعلقة بالاتصالات الإلكترونية. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قوانين الاتصالات الإلكترونية العراقية',
  },

  // Syria - Arabic
  SY: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع القوانين السورية المتعلقة بالاتصالات الإلكترونية. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قوانين الاتصالات الإلكترونية السورية',
  },

  // Libya - Arabic
  LY: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع القوانين الليبية المتعلقة بالاتصالات الإلكترونية. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قوانين الاتصالات الإلكترونية الليبية',
  },

  // Ivory Coast - French
  CI: {
    title: 'Conformité des Campagnes Email',
    disclaimer: 'Vos communications par email doivent être conformes à la Loi n° 2013-450 relative à la protection des données à caractère personnel. Le consentement préalable est requis pour les emails marketing. Tous les emails doivent identifier clairement l\'expéditeur, inclure vos coordonnées et offrir un mécanisme de désinscription simple.',
    lawReference: 'Loi n° 2013-450 relative à la protection des données à caractère personnel',
  },

  // Senegal - French
  SN: {
    title: 'Conformité des Campagnes Email',
    disclaimer: 'Vos communications par email doivent être conformes à la Loi n° 2008-12 sur la protection des données à caractère personnel. Le consentement préalable est requis pour les emails marketing. Tous les emails doivent identifier clairement l\'expéditeur, inclure vos coordonnées et offrir un mécanisme de désinscription simple.',
    lawReference: 'Loi n° 2008-12 sur la protection des données à caractère personnel',
  },

  // Cameroon - French
  CM: {
    title: 'Conformité des Campagnes Email',
    disclaimer: 'Vos communications par email doivent être conformes à la Loi n° 2010/012 relative à la cybersécurité et à la cybercriminalité. Le consentement préalable est requis pour les emails marketing. Tous les emails doivent identifier clairement l\'expéditeur, inclure vos coordonnées et offrir un mécanisme de désinscription simple.',
    lawReference: 'Loi n° 2010/012 relative à la cybersécurité et à la cybercriminalité',
  },

  // Democratic Republic of Congo - French
  CD: {
    title: 'Conformité des Campagnes Email',
    disclaimer: 'Vos communications par email doivent être conformes aux lois congolaises sur les communications électroniques. Le consentement préalable est requis pour les emails marketing. Tous les emails doivent identifier clairement l\'expéditeur, inclure vos coordonnées et offrir un mécanisme de désinscription simple.',
    lawReference: 'Lois sur les communications électroniques',
  },

  // Sudan - Arabic
  SD: {
    title: 'الامتثال لحملات البريد الإلكتروني',
    disclaimer: 'يجب أن تتوافق اتصالاتك عبر البريد الإلكتروني مع القوانين السودانية المتعلقة بالاتصالات الإلكترونية. يلزم الحصول على موافقة مسبقة لإرسال رسائل البريد الإلكتروني التسويقية. يجب أن تحدد جميع رسائل البريد الإلكتروني المرسل بوضوح، وتتضمن معلومات الاتصال، وتوفر آلية سهلة لإلغاء الاشتراك.',
    lawReference: 'قوانين الاتصالات الإلكترونية السودانية',
  },
};

// Get email compliance disclaimer for a country
export function getEmailComplianceDisclaimer(countryCode: CountryCode): EmailComplianceDisclaimer {
  return EMAIL_COMPLIANCE_DISCLAIMERS[countryCode] || EMAIL_COMPLIANCE_DISCLAIMERS.US;
}

// Pricing disclaimer by language (not country-specific, just translated)
export const PRICING_DISCLAIMERS: Record<Language, { title: string; disclaimer: string }> = {
  en: {
    title: 'Pricing Notice',
    disclaimer: 'The official subscription price is $25 USD per month. Prices displayed in other currencies are converted using approximate exchange rates for convenience only. Exchange rates may vary and we are not responsible for fluctuations. You will never be charged more than the $25 USD equivalent for a monthly subscription. The annual plan is $250/year — save 2 months. Billed annually. Non-refundable.',
  },
  es: {
    title: 'Aviso de Precios',
    disclaimer: 'El precio oficial de la suscripción es de $25 USD por mes. Los precios mostrados en otras monedas se convierten utilizando tasas de cambio aproximadas solo para su conveniencia. Las tasas de cambio pueden variar y no somos responsables de las fluctuaciones. Nunca se le cobrará más que el equivalente a $25 USD por una suscripción mensual. El plan anual es $250/año — ahorra 2 meses. Facturado anualmente. No reembolsable.',
  },
  fr: {
    title: 'Avis sur les Prix',
    disclaimer: 'Le prix officiel de l\'abonnement est de 25 $ USD par mois. Les prix affichés dans d\'autres devises sont convertis en utilisant des taux de change approximatifs à titre indicatif uniquement. Les taux de change peuvent varier et nous ne sommes pas responsables des fluctuations. Vous ne serez jamais facturé plus que l\'équivalent de 25 $ USD pour un abonnement mensuel. Le plan annuel est 250 $/an — économisez 2 mois. Facturé annuellement. Non remboursable.',
  },
  pt: {
    title: 'Aviso de Preços',
    disclaimer: 'O preço oficial da assinatura é de $25 USD por mês. Os preços exibidos em outras moedas são convertidos usando taxas de câmbio aproximadas apenas para conveniência. As taxas de câmbio podem variar e não somos responsáveis pelas flutuações. Você nunca será cobrado mais do que o equivalente a $25 USD por uma assinatura mensal. O plano anual é $250/ano — economize 2 meses. Cobrado anualmente. Não reembolsável.',
  },
  de: {
    title: 'Preishinweis',
    disclaimer: 'Der offizielle Abonnementpreis beträgt 25 $ USD pro Monat. Preise in anderen Währungen werden mit ungefähren Wechselkursen nur zur Information umgerechnet. Wechselkurse können schwanken und wir sind nicht für Schwankungen verantwortlich. Ihnen wird niemals mehr als das Äquivalent von 25 $ USD für ein monatliches Abonnement berechnet. Der Jahresplan kostet 250 $/Jahr — sparen Sie 2 Monate. Jährlich abgerechnet. Nicht erstattungsfähig.',
  },
  it: {
    title: 'Avviso sui Prezzi',
    disclaimer: 'Il prezzo ufficiale dell\'abbonamento è di $25 USD al mese. I prezzi visualizzati in altre valute sono convertiti utilizzando tassi di cambio approssimativi solo per comodità. I tassi di cambio possono variare e non siamo responsabili per le fluttuazioni. Non ti verrà mai addebitato più dell\'equivalente di $25 USD per un abbonamento mensile. Il piano annuale è $250/anno — risparmia 2 mesi. Fatturato annualmente. Non rimborsabile.',
  },
  nl: {
    title: 'Prijsmelding',
    disclaimer: 'De officiële abonnementsprijs is $25 USD per maand. Prijzen in andere valuta\'s worden omgerekend met geschatte wisselkoersen, uitsluitend ter indicatie. Wisselkoersen kunnen variëren en wij zijn niet verantwoordelijk voor schommelingen. Er wordt u nooit meer dan het equivalent van $25 USD voor een maandelijks abonnement in rekening gebracht. Het jaarplan is $250/jaar — bespaar 2 maanden. Jaarlijks gefactureerd. Niet terugbetaalbaar.',
  },
  sv: {
    title: 'Prismeddelande',
    disclaimer: 'Det officiella prenumerationspriset är $25 USD per månad. Priser som visas i andra valutor omvandlas med ungefärliga växelkurser endast för bekvämlighet. Växelkurser kan variera och vi ansvarar inte för fluktuationer. Du kommer aldrig att debiteras mer än motsvarande $25 USD för en månatlig prenumeration. Årsplanen är $250/år — spara 2 månader. Faktureras årligen. Ej återbetalningsbar.',
  },
  no: {
    title: 'Prisvarsel',
    disclaimer: 'Den offisielle abonnementsprisen er $25 USD per måned. Priser vist i andre valutaer er konvertert med omtrentlige valutakurser kun for enkelhets skyld. Valutakurser kan variere, og vi er ikke ansvarlige for svingninger. Du vil aldri bli belastet mer enn tilsvarende $25 USD for et månedlig abonnement. Årsplanen er $250/år — spar 2 måneder. Faktureres årlig. Ikke refunderbar.',
  },
  da: {
    title: 'Prismeddelelse',
    disclaimer: 'Den officielle abonnementspris er $25 USD pr. måned. Priser vist i andre valutaer omregnes ved hjælp af omtrentlige valutakurser kun for nemheds skyld. Valutakurser kan variere, og vi er ikke ansvarlige for udsving. Du vil aldrig blive opkrævet mere end hvad der svarer til $25 USD for et månedligt abonnement. Årsplanen er $250/år — spar 2 måneder. Faktureres årligt. Ikke refunderbar.',
  },
  fi: {
    title: 'Hintailmoitus',
    disclaimer: 'Virallinen tilauksen hinta on 25 USD kuukaudessa. Muissa valuutoissa näytetyt hinnat muunnetaan likimääräisillä valuuttakursseilla vain mukavuuden vuoksi. Valuuttakurssit voivat vaihdella, emmekä ole vastuussa vaihteluista. Sinulta ei koskaan veloiteta enempää kuin 25 USD:n vastine kuukausitilauksesta. Vuosisuunnitelma on 250 USD/vuosi — säästä 2 kuukautta. Laskutetaan vuosittain. Ei palautettavissa.',
  },
  is: {
    title: 'Verðtilkynning',
    disclaimer: 'Opinbert áskriftarverð er $25 USD á mánuði. Verð sýnd í öðrum gjaldmiðlum eru umreiknuð með áætluðu gengi eingöngu til þæginda. Gengi getur breyst og við berum ekki ábyrgð á sveiflum. Þú verður aldrei rukkaður meira en jafngildi $25 USD fyrir mánaðaráskrift. Ársáætlunin er $250/ár — sparaðu 2 mánuði. Reikningsfært árlega. Ekki endurgreiðanlegt.',
  },
  ru: {
    title: 'Уведомление о ценах',
    disclaimer: 'Официальная цена подписки составляет $25 USD в месяц. Цены в других валютах конвертируются по приблизительным курсам только для удобства. Курсы валют могут меняться, и мы не несем ответственности за колебания. С вас никогда не будет взиматься более эквивалента $25 USD за месячную подписку. Годовой план — $250/год, экономия 2 месяца. Оплачивается ежегодно. Возврат не предусмотрен.',
  },
  tr: {
    title: 'Fiyatlandırma Bildirimi',
    disclaimer: 'Resmi abonelik fiyatı aylık 25 USD\'dir. Diğer para birimlerinde gösterilen fiyatlar yalnızca kolaylık sağlamak amacıyla yaklaşık döviz kurları kullanılarak dönüştürülmüştür. Döviz kurları değişebilir ve dalgalanmalardan sorumlu değiliz. Aylık abonelik için asla 25 USD eşdeğerinden fazla ücret alınmayacaktır. Yıllık plan 250 USD/yıl — 2 ay tasarruf edin. Yıllık faturalandırılır. İade edilmez.',
  },
  zh: {
    title: '定价通知',
    disclaimer: '官方订阅价格为每月25美元。其他货币显示的价格仅为方便起见使用近似汇率转换。汇率可能变化，我们不对波动负责。您的月度订阅费用永远不会超过25美元的等值金额。年度计划为250美元/年——节省2个月。按年计费。不可退款。',
  },
  ko: {
    title: '가격 안내',
    disclaimer: '공식 구독 가격은 월 $25 USD입니다. 다른 통화로 표시된 가격은 편의를 위해 대략적인 환율을 사용하여 변환된 것입니다. 환율은 변동될 수 있으며 당사는 변동에 대해 책임지지 않습니다. 월간 구독료는 $25 USD에 해당하는 금액을 초과하여 청구되지 않습니다. 연간 플랜은 $250/년 — 2개월 절약. 연간 청구. 환불 불가.',
  },
  ja: {
    title: '価格に関するお知らせ',
    disclaimer: '公式のサブスクリプション価格は月額25ドルです。他の通貨で表示される価格は、便宜上、概算の為替レートを使用して換算されています。為替レートは変動する可能性があり、当社は変動に対して責任を負いません。月額サブスクリプションで25ドル相当額を超える請求が行われることはありません。年間プランは250ドル/年 — 2ヶ月分お得。年間一括払い。返金不可。',
  },
  ht: {
    title: 'Avi sou Pri',
    disclaimer: 'Pri ofisyèl abònman an se $25 USD pa mwa. Pri ki afiche nan lòt lajan yo konvèti avèk to echanj apwoksimatif pou fasilite sèlman. To echanj yo kapab varye epi nou pa responsab pou fliktiyasyon yo. Ou pap janm peye plis pase ekivalan $25 USD pou yon abònman chak mwa. Plan anyèl la se $250/ane — ekonomize 2 mwa. Faktire chak ane. Pa ranbousab.',
  },
};

// Get pricing disclaimer for a language
export function getPricingDisclaimer(language: Language): { title: string; disclaimer: string } {
  return PRICING_DISCLAIMERS[language] || PRICING_DISCLAIMERS.en;
}

// ============================================
// DYNAMIC EMAIL FOOTER GENERATION
// ============================================

/**
 * Email footer legal text by language
 * These are the localized versions of the unsubscribe and compliance text
 */
export interface EmailFooterText {
  receivingBecause: string;
  unsubscribeText: string;
  unsubscribeLinkText: string;
  linkActiveText: string;
  sentOnBehalf: string;
  legalNotice?: string; // Optional country-specific legal notice
}

// Email footer text in all supported languages
export const EMAIL_FOOTER_TRANSLATIONS: Record<Language, EmailFooterText> = {
  en: {
    receivingBecause: 'You are receiving this email because you are a customer of',
    unsubscribeText: 'To stop receiving emails from',
    unsubscribeLinkText: 'click here to unsubscribe',
    linkActiveText: 'This unsubscribe link will remain active for at least 30 days.',
    sentOnBehalf: 'Sent on behalf of',
  },
  es: {
    receivingBecause: 'Usted recibe este correo electrónico porque es cliente de',
    unsubscribeText: 'Para dejar de recibir correos electrónicos de',
    unsubscribeLinkText: 'haga clic aquí para cancelar la suscripción',
    linkActiveText: 'Este enlace de cancelación permanecerá activo durante al menos 30 días.',
    sentOnBehalf: 'Enviado en nombre de',
  },
  fr: {
    receivingBecause: 'Vous recevez cet e-mail parce que vous êtes client de',
    unsubscribeText: 'Pour ne plus recevoir d\'e-mails de',
    unsubscribeLinkText: 'cliquez ici pour vous désabonner',
    linkActiveText: 'Ce lien de désabonnement restera actif pendant au moins 30 jours.',
    sentOnBehalf: 'Envoyé au nom de',
  },
  pt: {
    receivingBecause: 'Você está recebendo este e-mail porque é cliente de',
    unsubscribeText: 'Para deixar de receber e-mails de',
    unsubscribeLinkText: 'clique aqui para cancelar a inscrição',
    linkActiveText: 'Este link de cancelamento permanecerá ativo por pelo menos 30 dias.',
    sentOnBehalf: 'Enviado em nome de',
  },
  de: {
    receivingBecause: 'Sie erhalten diese E-Mail, weil Sie Kunde von',
    unsubscribeText: 'Um keine E-Mails mehr von',
    unsubscribeLinkText: 'klicken Sie hier zum Abmelden',
    linkActiveText: 'Dieser Abmeldelink bleibt mindestens 30 Tage aktiv.',
    sentOnBehalf: 'Gesendet im Namen von',
  },
  it: {
    receivingBecause: 'Ricevi questa email perché sei cliente di',
    unsubscribeText: 'Per non ricevere più email da',
    unsubscribeLinkText: 'clicca qui per annullare l\'iscrizione',
    linkActiveText: 'Questo link di cancellazione rimarrà attivo per almeno 30 giorni.',
    sentOnBehalf: 'Inviato per conto di',
  },
  nl: {
    receivingBecause: 'U ontvangt deze e-mail omdat u klant bent van',
    unsubscribeText: 'Om geen e-mails meer te ontvangen van',
    unsubscribeLinkText: 'klik hier om u af te melden',
    linkActiveText: 'Deze afmeldlink blijft minimaal 30 dagen actief.',
    sentOnBehalf: 'Verzonden namens',
  },
  sv: {
    receivingBecause: 'Du får detta e-postmeddelande eftersom du är kund hos',
    unsubscribeText: 'För att sluta ta emot e-post från',
    unsubscribeLinkText: 'klicka här för att avregistrera dig',
    linkActiveText: 'Denna avregistreringslänk förblir aktiv i minst 30 dagar.',
    sentOnBehalf: 'Skickat på uppdrag av',
  },
  no: {
    receivingBecause: 'Du mottar denne e-posten fordi du er kunde hos',
    unsubscribeText: 'For å slutte å motta e-post fra',
    unsubscribeLinkText: 'klikk her for å avslutte abonnementet',
    linkActiveText: 'Denne avmeldingslenken vil være aktiv i minst 30 dager.',
    sentOnBehalf: 'Sendt på vegne av',
  },
  da: {
    receivingBecause: 'Du modtager denne e-mail, fordi du er kunde hos',
    unsubscribeText: 'For at stoppe med at modtage e-mails fra',
    unsubscribeLinkText: 'klik her for at afmelde dig',
    linkActiveText: 'Dette afmeldingslink vil forblive aktivt i mindst 30 dage.',
    sentOnBehalf: 'Sendt på vegne af',
  },
  fi: {
    receivingBecause: 'Saat tämän sähköpostin, koska olet asiakas',
    unsubscribeText: 'Lopettaaksesi sähköpostien vastaanottamisen',
    unsubscribeLinkText: 'klikkaa tästä peruuttaaksesi tilauksen',
    linkActiveText: 'Tämä tilauksen peruutuslinkki pysyy aktiivisena vähintään 30 päivää.',
    sentOnBehalf: 'Lähetetty puolesta',
  },
  is: {
    receivingBecause: 'Þú færð þennan tölvupóst vegna þess að þú ert viðskiptavinur',
    unsubscribeText: 'Til að hætta að fá tölvupóst frá',
    unsubscribeLinkText: 'smelltu hér til að segja upp áskrift',
    linkActiveText: 'Þessi afskráningartengill verður virkur í að minnsta kosti 30 daga.',
    sentOnBehalf: 'Sent fyrir hönd',
  },
  ru: {
    receivingBecause: 'Вы получаете это письмо, потому что являетесь клиентом',
    unsubscribeText: 'Чтобы прекратить получать письма от',
    unsubscribeLinkText: 'нажмите здесь, чтобы отписаться',
    linkActiveText: 'Эта ссылка для отписки будет активна не менее 30 дней.',
    sentOnBehalf: 'Отправлено от имени',
  },
  tr: {
    receivingBecause: 'Bu e-postayı alıyorsunuz çünkü bir müşterisisiniz',
    unsubscribeText: 'E-posta almayı durdurmak için',
    unsubscribeLinkText: 'abonelikten çıkmak için buraya tıklayın',
    linkActiveText: 'Bu abonelik iptal bağlantısı en az 30 gün aktif kalacaktır.',
    sentOnBehalf: 'Adına gönderildi',
  },
  zh: {
    receivingBecause: '您收到此电子邮件是因为您是以下公司的客户：',
    unsubscribeText: '如需停止接收来自以下公司的电子邮件：',
    unsubscribeLinkText: '点击此处取消订阅',
    linkActiveText: '此退订链接将保持有效至少30天。',
    sentOnBehalf: '代表发送：',
  },
  ko: {
    receivingBecause: '귀하는 다음 업체의 고객이므로 이 이메일을 받고 있습니다:',
    unsubscribeText: '다음 업체의 이메일 수신을 중단하려면',
    unsubscribeLinkText: '여기를 클릭하여 구독을 취소하세요',
    linkActiveText: '이 구독 취소 링크는 최소 30일 동안 유효합니다.',
    sentOnBehalf: '대행 발송:',
  },
  ja: {
    receivingBecause: 'このメールは、お客様が以下の企業の顧客であるため送信されています：',
    unsubscribeText: '以下の企業からのメール受信を停止するには',
    unsubscribeLinkText: 'こちらをクリックして登録解除',
    linkActiveText: 'この登録解除リンクは少なくとも30日間有効です。',
    sentOnBehalf: '代理送信：',
  },
  ht: {
    receivingBecause: 'Ou resevwa imèl sa a paske ou se yon kliyan',
    unsubscribeText: 'Pou sispann resevwa imèl nan men',
    unsubscribeLinkText: 'klike la a pou dezabòne',
    linkActiveText: 'Lyen dezabònman sa a ap rete aktif pou omwen 30 jou.',
    sentOnBehalf: 'Voye sou non',
  },
};

/**
 * Country-specific legal notice by country code
 * These appear in addition to the base footer text
 */
export const COUNTRY_LEGAL_NOTICES: Partial<Record<CountryCode, Record<Language, string>>> = {
  // United States - CAN-SPAM Act compliance
  US: {
    en: 'This message complies with the CAN-SPAM Act (15 U.S.C. § 7701).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM (15 U.S.C. § 7701).',
    fr: 'Ce message est conforme à la loi CAN-SPAM (15 U.S.C. § 7701).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM (15 U.S.C. § 7701).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz (15 U.S.C. § 7701).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM (15 U.S.C. § 7701).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM (15 U.S.C. § 7701).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet (15 U.S.C. § 7701).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen (15 U.S.C. § 7701).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven (15 U.S.C. § 7701).',
    da: 'Denne besked overholder CAN-SPAM-loven (15 U.S.C. § 7701).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia (15 U.S.C. § 7701).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin (15 U.S.C. § 7701).',
    ru: 'Это сообщение соответствует закону CAN-SPAM (15 U.S.C. § 7701).',
    tr: 'Bu mesaj CAN-SPAM Yasasına (15 U.S.C. § 7701) uygundur.',
    zh: '此邮件符合CAN-SPAM法案（15 U.S.C. § 7701）。',
    ko: '이 메시지는 CAN-SPAM 법(15 U.S.C. § 7701)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法（15 U.S.C. § 7701）に準拠しています。',
  },
  // Canada - CASL compliance
  CA: {
    en: 'This message complies with Canada\'s Anti-Spam Legislation (CASL).',
    es: 'Este mensaje cumple con la Legislación Anti-Spam de Canadá (CASL).',
    fr: 'Ce message est conforme à la Loi canadienne anti-pourriel (LCAP).',
    pt: 'Esta mensagem está em conformidade com a Legislação Anti-Spam do Canadá (CASL).',
    de: 'Diese Nachricht entspricht Kanadas Anti-Spam-Gesetz (CASL).',
    ht: 'Mesaj sa a konfòm ak Lejislasyon Anti-Spam Kanada (CASL).',
    it: 'Questo messaggio è conforme alla Legislazione Anti-Spam del Canada (CASL).',
    nl: 'Dit bericht voldoet aan de Canadese Anti-Spam Wetgeving (CASL).',
    sv: 'Detta meddelande överensstämmer med Kanadas antispam-lagstiftning (CASL).',
    no: 'Denne meldingen er i samsvar med Canadas anti-spam-lovgivning (CASL).',
    da: 'Denne besked overholder Canadas anti-spam-lovgivning (CASL).',
    fi: 'Tämä viesti noudattaa Kanadan roskapostilakia (CASL).',
    is: 'Þessi skilaboð uppfylla ruslpóstslög Kanada (CASL).',
    ru: 'Это сообщение соответствует канадскому антиспам-законодательству (CASL).',
    tr: 'Bu mesaj Kanada Anti-Spam Mevzuatına (CASL) uygundur.',
    zh: '此邮件符合加拿大反垃圾邮件法（CASL）。',
    ko: '이 메시지는 캐나다 스팸방지법(CASL)을 준수합니다.',
    ja: 'このメッセージはカナダのスパム対策法（CASL）に準拠しています。',
  },
  // EU countries - GDPR compliance
  GB: {
    en: 'This message complies with UK GDPR and PECR regulations.',
    es: 'Este mensaje cumple con el RGPD del Reino Unido y las regulaciones PECR.',
    fr: 'Ce message est conforme au RGPD britannique et aux règlements PECR.',
    pt: 'Esta mensagem está em conformidade com o RGPD do Reino Unido e regulamentos PECR.',
    de: 'Diese Nachricht entspricht der britischen DSGVO und den PECR-Vorschriften.',
    ht: 'Mesaj sa a konfòm ak GDPR UK ak règleman PECR yo.',
    it: 'Questo messaggio è conforme al GDPR del Regno Unito e ai regolamenti PECR.',
    nl: 'Dit bericht voldoet aan de Britse AVG en PECR-regelgeving.',
    sv: 'Detta meddelande överensstämmer med brittiska GDPR och PECR-förordningar.',
    no: 'Denne meldingen er i samsvar med britiske GDPR og PECR-forskrifter.',
    da: 'Denne besked overholder britiske GDPR og PECR-regler.',
    fi: 'Tämä viesti noudattaa Britannian GDPR:ää ja PECR-säädöksiä.',
    is: 'Þessi skilaboð uppfylla GDPR Bretlands og PECR reglugerðir.',
    ru: 'Это сообщение соответствует GDPR Великобритании и правилам PECR.',
    tr: 'Bu mesaj Birleşik Krallık GDPR ve PECR düzenlemelerine uygundur.',
    zh: '此邮件符合英国GDPR和PECR法规。',
    ko: '이 메시지는 영국 GDPR 및 PECR 규정을 준수합니다.',
    ja: 'このメッセージは英国のGDPRおよびPECR規制に準拠しています。',
  },
  DE: {
    en: 'This message complies with EU GDPR and German UWG.',
    es: 'Este mensaje cumple con el RGPD de la UE y la UWG alemana.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi UWG allemande.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a UWG alemã.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem deutschen UWG.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak UWG Alman.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla UWG tedesca.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Duitse UWG.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och tyska UWG.',
    no: 'Denne meldingen er i samsvar med EU GDPR og tysk UWG.',
    da: 'Denne besked overholder EU GDPR og tysk UWG.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Saksan UWG:tä.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og þýska UWG.',
    ru: 'Это сообщение соответствует GDPR ЕС и немецкому UWG.',
    tr: 'Bu mesaj AB GDPR ve Alman UWG\'ye uygundur.',
    zh: '此邮件符合欧盟GDPR和德国UWG。',
    ko: '이 메시지는 EU GDPR 및 독일 UWG를 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびドイツのUWGに準拠しています。',
  },
  FR: {
    en: 'This message complies with EU GDPR and French data protection laws.',
    es: 'Este mensaje cumple con el RGPD de la UE y las leyes francesas de protección de datos.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi Informatique et Libertés.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e as leis francesas de proteção de dados.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und den französischen Datenschutzgesetzen.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak lwa pwoteksyon done Frans.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alle leggi francesi sulla protezione dei dati.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Franse gegevensbeschermingswetten.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och franska dataskyddslagar.',
    no: 'Denne meldingen er i samsvar med EU GDPR og franske personvernlover.',
    da: 'Denne besked overholder EU GDPR og franske databeskyttelseslove.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Ranskan tietosuojalakeja.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og frönsk persónuverndarlög.',
    ru: 'Это сообщение соответствует GDPR ЕС и французским законам о защите данных.',
    tr: 'Bu mesaj AB GDPR ve Fransız veri koruma yasalarına uygundur.',
    zh: '此邮件符合欧盟GDPR和法国数据保护法。',
    ko: '이 메시지는 EU GDPR 및 프랑스 데이터 보호법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびフランスのデータ保護法に準拠しています。',
  },
  // Australia - Spam Act
  AU: {
    en: 'This message complies with the Australian Spam Act 2003.',
    es: 'Este mensaje cumple con la Ley de Spam de Australia de 2003.',
    fr: 'Ce message est conforme à la loi australienne sur le spam de 2003.',
    pt: 'Esta mensagem está em conformidade com a Lei de Spam da Austrália de 2003.',
    de: 'Diese Nachricht entspricht dem australischen Spam-Gesetz von 2003.',
    ht: 'Mesaj sa a konfòm ak Lwa Spam Ostrali 2003.',
    it: 'Questo messaggio è conforme alla legge australiana sullo spam del 2003.',
    nl: 'Dit bericht voldoet aan de Australische Spam Act 2003.',
    sv: 'Detta meddelande överensstämmer med australiska Spam Act 2003.',
    no: 'Denne meldingen er i samsvar med den australske Spam Act 2003.',
    da: 'Denne besked overholder den australske Spam Act 2003.',
    fi: 'Tämä viesti noudattaa Australian roskapostilakia 2003.',
    is: 'Þessi skilaboð uppfylla áströlsku ruslpóstslögin 2003.',
    ru: 'Это сообщение соответствует австралийскому закону о спаме 2003 года.',
    tr: 'Bu mesaj Avustralya Spam Yasası 2003\'e uygundur.',
    zh: '此邮件符合澳大利亚2003年反垃圾邮件法。',
    ko: '이 메시지는 호주 스팸법 2003을 준수합니다.',
    ja: 'このメッセージはオーストラリアのスパム法2003に準拠しています。',
  },
  // Brazil - LGPD
  BR: {
    en: 'This message complies with the Brazilian General Data Protection Law (LGPD).',
    es: 'Este mensaje cumple con la Ley General de Protección de Datos de Brasil (LGPD).',
    fr: 'Ce message est conforme à la loi brésilienne sur la protection des données (LGPD).',
    pt: 'Esta mensagem está em conformidade com a Lei Geral de Proteção de Dados (LGPD).',
    de: 'Diese Nachricht entspricht dem brasilianischen Datenschutzgesetz (LGPD).',
    ht: 'Mesaj sa a konfòm ak Lwa Jeneral Pwoteksyon Done Brezil (LGPD).',
    it: 'Questo messaggio è conforme alla legge brasiliana sulla protezione dei dati (LGPD).',
    nl: 'Dit bericht voldoet aan de Braziliaanse gegevensbeschermingswet (LGPD).',
    sv: 'Detta meddelande överensstämmer med brasilianska dataskyddslagen (LGPD).',
    no: 'Denne meldingen er i samsvar med brasiliansk personvernlov (LGPD).',
    da: 'Denne besked overholder den brasilianske databeskyttelseslov (LGPD).',
    fi: 'Tämä viesti noudattaa Brasilian tietosuojalakia (LGPD).',
    is: 'Þessi skilaboð uppfylla brasilísku persónuverndarlögin (LGPD).',
    ru: 'Это сообщение соответствует бразильскому закону о защите данных (LGPD).',
    tr: 'Bu mesaj Brezilya Genel Veri Koruma Yasasına (LGPD) uygundur.',
    zh: '此邮件符合巴西通用数据保护法（LGPD）。',
    ko: '이 메시지는 브라질 일반 데이터 보호법(LGPD)을 준수합니다.',
    ja: 'このメッセージはブラジルの一般データ保護法（LGPD）に準拠しています。',
  },
  // Japan
  JP: {
    en: 'This message complies with Japan\'s Act on Specified Electronic Mail.',
    es: 'Este mensaje cumple con la Ley de Correo Electrónico Especificado de Japón.',
    fr: 'Ce message est conforme à la loi japonaise sur les e-mails spécifiés.',
    pt: 'Esta mensagem está em conformidade com a Lei de E-mail Especificado do Japão.',
    de: 'Diese Nachricht entspricht dem japanischen Gesetz über spezifische elektronische Post.',
    ht: 'Mesaj sa a konfòm ak Lwa Japon sou Imèl Elektwonik Espesifye.',
    it: 'Questo messaggio è conforme alla legge giapponese sulle e-mail specificate.',
    nl: 'Dit bericht voldoet aan de Japanse wet op gespecificeerde e-mail.',
    sv: 'Detta meddelande överensstämmer med Japans lag om specificerad e-post.',
    no: 'Denne meldingen er i samsvar med Japans lov om spesifisert e-post.',
    da: 'Denne besked overholder Japans lov om specificeret e-mail.',
    fi: 'Tämä viesti noudattaa Japanin sähköpostilakia.',
    is: 'Þessi skilaboð uppfylla japönsku rafpóstslögin.',
    ru: 'Это сообщение соответствует японскому закону о специфической электронной почте.',
    tr: 'Bu mesaj Japonya\'nın Belirli Elektronik Posta Yasasına uygundur.',
    zh: '此邮件符合日本特定电子邮件法。',
    ko: '이 메시지는 일본의 특정전자메일법을 준수합니다.',
    ja: 'このメッセージは特定電子メール法に準拠しています。',
  },
  // Nordic Countries - GDPR compliance
  DK: {
    en: 'This message complies with EU GDPR and Danish Marketing Act.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Marketing de Dinamarca.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi danoise sur le marketing.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Marketing da Dinamarca.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem dänischen Marketinggesetz.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Maketing Danmak.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge danese sul marketing.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Deense marketingwet.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och dansk marknadsföringslag.',
    no: 'Denne meldingen er i samsvar med EU GDPR og dansk markedsføringslov.',
    da: 'Denne besked overholder EU GDPR og markedsføringsloven.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Tanskan markkinointilakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og danska markaðslöggjöf.',
    ru: 'Это сообщение соответствует GDPR ЕС и датскому закону о маркетинге.',
    tr: 'Bu mesaj AB GDPR ve Danimarka Pazarlama Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和丹麦营销法。',
    ko: '이 메시지는 EU GDPR 및 덴마크 마케팅법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびデンマークのマーケティング法に準拠しています。',
  },
  SE: {
    en: 'This message complies with EU GDPR and Swedish Electronic Communications Act.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Comunicaciones Electrónicas de Suecia.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi suédoise sur les communications électroniques.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Comunicações Eletrónicas da Suécia.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem schwedischen Gesetz über elektronische Kommunikation.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Kominikasyon Elektwonik Syèd.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge svedese sulle comunicazioni elettroniche.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Zweedse wet op elektronische communicatie.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och lagen om elektronisk kommunikation.',
    no: 'Denne meldingen er i samsvar med EU GDPR og svensk lov om elektronisk kommunikasjon.',
    da: 'Denne besked overholder EU GDPR og svensk lov om elektronisk kommunikation.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Ruotsin sähköisen viestinnän lakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og sænsk lög um rafræn samskipti.',
    ru: 'Это сообщение соответствует GDPR ЕС и шведскому закону об электронных коммуникациях.',
    tr: 'Bu mesaj AB GDPR ve İsveç Elektronik İletişim Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和瑞典电子通信法。',
    ko: '이 메시지는 EU GDPR 및 스웨덴 전자통신법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびスウェーデンの電子通信法に準拠しています。',
  },
  NO: {
    en: 'This message complies with EU GDPR and Norwegian Marketing Control Act.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Control de Marketing de Noruega.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi norvégienne sur le contrôle du marketing.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Controlo de Marketing da Noruega.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem norwegischen Marketingkontrollgesetz.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Kontwòl Maketing Nòvèj.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge norvegese sul controllo del marketing.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Noorse marketingcontrolewet.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och norsk marknadsföringskontrollag.',
    no: 'Denne meldingen er i samsvar med EU GDPR og markedsføringsloven.',
    da: 'Denne besked overholder EU GDPR og norsk markedsføringskontrollov.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Norjan markkinointivalvontalakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og norska markaðseftirlitslög.',
    ru: 'Это сообщение соответствует GDPR ЕС и норвежскому закону о контроле маркетинга.',
    tr: 'Bu mesaj AB GDPR ve Norveç Pazarlama Kontrol Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和挪威营销控制法。',
    ko: '이 메시지는 EU GDPR 및 노르웨이 마케팅 통제법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびノルウェーのマーケティング規制法に準拠しています。',
  },
  FI: {
    en: 'This message complies with EU GDPR and Finnish Information Society Code.',
    es: 'Este mensaje cumple con el RGPD de la UE y el Código de Sociedad de la Información de Finlandia.',
    fr: 'Ce message est conforme au RGPD de l\'UE et au Code de la société de l\'information finlandais.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e o Código da Sociedade da Informação da Finlândia.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem finnischen Informationsgesellschaftsgesetz.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Kòd Sosyete Enfòmasyon Fenlann.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e al Codice finlandese della società dell\'informazione.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Finse informatiemaatschappijwet.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och finska informationssamhällslagen.',
    no: 'Denne meldingen er i samsvar med EU GDPR og finsk informasjonssamfunnslov.',
    da: 'Denne besked overholder EU GDPR og finsk informationssamfundskodeks.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja tietoyhteiskuntakaarta.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og finnsku upplýsingasamfélagslögin.',
    ru: 'Это сообщение соответствует GDPR ЕС и финскому Кодексу информационного общества.',
    tr: 'Bu mesaj AB GDPR ve Finlandiya Bilgi Toplumu Kanununa uygundur.',
    zh: '此邮件符合欧盟GDPR和芬兰信息社会法典。',
    ko: '이 메시지는 EU GDPR 및 핀란드 정보사회법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびフィンランドの情報社会法に準拠しています。',
  },
  IS: {
    en: 'This message complies with EU GDPR and Icelandic Electronic Communications Act.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Comunicaciones Electrónicas de Islandia.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi islandaise sur les communications électroniques.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Comunicações Eletrónicas da Islândia.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem isländischen Gesetz über elektronische Kommunikation.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Kominikasyon Elektwonik Islann.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge islandese sulle comunicazioni elettroniche.',
    nl: 'Dit bericht voldoet aan de EU AVG en de IJslandse wet op elektronische communicatie.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och isländsk lag om elektronisk kommunikation.',
    no: 'Denne meldingen er i samsvar med EU GDPR og islandsk lov om elektronisk kommunikasjon.',
    da: 'Denne besked overholder EU GDPR og islandsk lov om elektronisk kommunikation.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Islannin sähköisen viestinnän lakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og lög um fjarskipti.',
    ru: 'Это сообщение соответствует GDPR ЕС и исландскому закону об электронных коммуникациях.',
    tr: 'Bu mesaj AB GDPR ve İzlanda Elektronik İletişim Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和冰岛电子通信法。',
    ko: '이 메시지는 EU GDPR 및 아이슬란드 전자통신법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびアイスランドの電子通信法に準拠しています。',
  },
  // Additional EU countries
  NL: {
    en: 'This message complies with EU GDPR and Dutch Telecommunications Act.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Telecomunicaciones de los Países Bajos.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi néerlandaise sur les télécommunications.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Telecomunicações dos Países Baixos.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem niederländischen Telekommunikationsgesetz.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Telekominikasyon Olandè.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge olandese sulle telecomunicazioni.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Telecommunicatiewet.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och nederländsk telekomlag.',
    no: 'Denne meldingen er i samsvar med EU GDPR og nederlandsk telekomlov.',
    da: 'Denne besked overholder EU GDPR og hollandsk telelov.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Alankomaiden teletoimintalakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og hollensk fjarskiptalög.',
    ru: 'Это сообщение соответствует GDPR ЕС и голландскому закону о телекоммуникациях.',
    tr: 'Bu mesaj AB GDPR ve Hollanda Telekomünikasyon Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和荷兰电信法。',
    ko: '이 메시지는 EU GDPR 및 네덜란드 통신법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびオランダの電気通信法に準拠しています。',
  },
  IT: {
    en: 'This message complies with EU GDPR and Italian Privacy Code.',
    es: 'Este mensaje cumple con el RGPD de la UE y el Código de Privacidad italiano.',
    fr: 'Ce message est conforme au RGPD de l\'UE et au Code de la vie privée italien.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e o Código de Privacidade italiano.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem italienischen Datenschutzgesetz.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Kòd Konfidansyalite Italyen.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e al Codice della Privacy.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Italiaanse privacywet.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och italiensk integritetslag.',
    no: 'Denne meldingen er i samsvar med EU GDPR og italiensk personvernlov.',
    da: 'Denne besked overholder EU GDPR og italiensk privatlivskodeks.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Italian yksityisyyslakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og ítölsku persónuverndarlögin.',
    ru: 'Это сообщение соответствует GDPR ЕС и итальянскому Кодексу о конфиденциальности.',
    tr: 'Bu mesaj AB GDPR ve İtalyan Gizlilik Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和意大利隐私法典。',
    ko: '이 메시지는 EU GDPR 및 이탈리아 개인정보보호법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびイタリアのプライバシー法に準拠しています。',
  },
  ES: {
    en: 'This message complies with EU GDPR and Spanish LSSI.',
    es: 'Este mensaje cumple con el RGPD de la UE y la LSSI.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la LSSI espagnole.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a LSSI espanhola.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem spanischen LSSI.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak LSSI Panyòl.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla LSSI spagnola.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Spaanse LSSI.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och spansk LSSI.',
    no: 'Denne meldingen er i samsvar med EU GDPR og spansk LSSI.',
    da: 'Denne besked overholder EU GDPR og spansk LSSI.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Espanjan LSSI:tä.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og spænsk LSSI.',
    ru: 'Это сообщение соответствует GDPR ЕС и испанскому LSSI.',
    tr: 'Bu mesaj AB GDPR ve İspanyol LSSI\'ye uygundur.',
    zh: '此邮件符合欧盟GDPR和西班牙LSSI。',
    ko: '이 메시지는 EU GDPR 및 스페인 LSSI를 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびスペインのLSSIに準拠しています。',
  },
  PT: {
    en: 'This message complies with EU GDPR and Portuguese Electronic Communications Law.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Comunicaciones Electrónicas de Portugal.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi portugaise sur les communications électroniques.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei das Comunicações Eletrónicas.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem portugiesischen Gesetz über elektronische Kommunikation.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Kominikasyon Elektwonik Pòtigè.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge portoghese sulle comunicazioni elettroniche.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Portugese wet op elektronische communicatie.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och portugisisk lag om elektronisk kommunikation.',
    no: 'Denne meldingen er i samsvar med EU GDPR og portugisisk lov om elektronisk kommunikasjon.',
    da: 'Denne besked overholder EU GDPR og portugisisk lov om elektronisk kommunikation.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Portugalin sähköisen viestinnän lakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og portúgölsk lög um rafræn samskipti.',
    ru: 'Это сообщение соответствует GDPR ЕС и португальскому закону об электронных коммуникациях.',
    tr: 'Bu mesaj AB GDPR ve Portekiz Elektronik İletişim Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和葡萄牙电子通信法。',
    ko: '이 메시지는 EU GDPR 및 포르투갈 전자통신법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびポルトガルの電子通信法に準拠しています。',
  },
  // Belgium - EU GDPR compliance
  BE: {
    en: 'This message complies with EU GDPR and Belgian Electronic Communications Law.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Comunicaciones Electrónicas de Bélgica.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi belge sur les communications électroniques.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Comunicações Eletrónicas da Bélgica.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem belgischen Gesetz über elektronische Kommunikation.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Kominikasyon Elektwonik Bèlj.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge belga sulle comunicazioni elettroniche.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Belgische wet op elektronische communicatie.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och belgisk lag om elektronisk kommunikation.',
    no: 'Denne meldingen er i samsvar med EU GDPR og belgisk lov om elektronisk kommunikasjon.',
    da: 'Denne besked overholder EU GDPR og belgisk lov om elektronisk kommunikation.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Belgian sähköisen viestinnän lakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og belgísk lög um rafræn samskipti.',
    ru: 'Это сообщение соответствует GDPR ЕС и бельгийскому закону об электронных коммуникациях.',
    tr: 'Bu mesaj AB GDPR ve Belçika Elektronik İletişim Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和比利时电子通信法。',
    ko: '이 메시지는 EU GDPR 및 벨기에 전자통신법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびベルギーの電子通信法に準拠しています。',
  },
  // Ireland - EU GDPR compliance
  IE: {
    en: 'This message complies with EU GDPR and Irish ePrivacy Regulations.',
    es: 'Este mensaje cumple con el RGPD de la UE y las Regulaciones de Privacidad Electrónica de Irlanda.',
    fr: 'Ce message est conforme au RGPD de l\'UE et aux règlements irlandais sur la vie privée électronique.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e os Regulamentos de Privacidade Eletrónica da Irlanda.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und den irischen ePrivacy-Vorschriften.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Règleman ePrivacy Ilann.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e ai regolamenti ePrivacy irlandesi.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Ierse ePrivacy-regelgeving.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och irländska ePrivacy-förordningar.',
    no: 'Denne meldingen er i samsvar med EU GDPR og irske ePrivacy-forskrifter.',
    da: 'Denne besked overholder EU GDPR og irske ePrivacy-regler.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Irlannin ePrivacy-säädöksiä.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og írskar ePrivacy reglugerðir.',
    ru: 'Это сообщение соответствует GDPR ЕС и ирландским правилам ePrivacy.',
    tr: 'Bu mesaj AB GDPR ve İrlanda ePrivacy Düzenlemelerine uygundur.',
    zh: '此邮件符合欧盟GDPR和爱尔兰电子隐私法规。',
    ko: '이 메시지는 EU GDPR 및 아일랜드 ePrivacy 규정을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびアイルランドのePrivacy規制に準拠しています。',
  },
  // Austria - EU GDPR compliance
  AT: {
    en: 'This message complies with EU GDPR and Austrian Telecommunications Act.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Telecomunicaciones de Austria.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi autrichienne sur les télécommunications.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Telecomunicações da Áustria.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem österreichischen Telekommunikationsgesetz (TKG).',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Telekominikasyon Otrich.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge austriaca sulle telecomunicazioni.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Oostenrijkse telecommunicatiewet.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och österrikisk telekomlag.',
    no: 'Denne meldingen er i samsvar med EU GDPR og østerriksk telekomlov.',
    da: 'Denne besked overholder EU GDPR og østrigsk telelov.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Itävallan teletoimintalakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og austurrísk fjarskiptalög.',
    ru: 'Это сообщение соответствует GDPR ЕС и австрийскому закону о телекоммуникациях.',
    tr: 'Bu mesaj AB GDPR ve Avusturya Telekomünikasyon Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和奥地利电信法。',
    ko: '이 메시지는 EU GDPR 및 오스트리아 통신법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびオーストリアの電気通信法に準拠しています。',
  },
  // Luxembourg - EU GDPR compliance
  LU: {
    en: 'This message complies with EU GDPR and Luxembourg Electronic Communications Law.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Comunicaciones Electrónicas de Luxemburgo.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi luxembourgeoise sur les communications électroniques.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Comunicações Eletrónicas de Luxemburgo.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem luxemburgischen Gesetz über elektronische Kommunikation.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Kominikasyon Elektwonik Liksanbou.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge lussemburghese sulle comunicazioni elettroniche.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Luxemburgse wet op elektronische communicatie.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och luxemburgsk lag om elektronisk kommunikation.',
    no: 'Denne meldingen er i samsvar med EU GDPR og luxemburgsk lov om elektronisk kommunikasjon.',
    da: 'Denne besked overholder EU GDPR og luxembourgsk lov om elektronisk kommunikation.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Luxemburgin sähköisen viestinnän lakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og lúxemborgsk lög um rafræn samskipti.',
    ru: 'Это сообщение соответствует GDPR ЕС и люксембургскому закону об электронных коммуникациях.',
    tr: 'Bu mesaj AB GDPR ve Lüksemburg Elektronik İletişim Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和卢森堡电子通信法。',
    ko: '이 메시지는 EU GDPR 및 룩셈부르크 전자통신법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびルクセンブルクの電子通信法に準拠しています。',
  },
  // Poland - EU GDPR compliance
  PL: {
    en: 'This message complies with EU GDPR and Polish Electronic Communications Law.',
    es: 'Este mensaje cumple con el RGPD de la UE y la Ley de Comunicaciones Electrónicas de Polonia.',
    fr: 'Ce message est conforme au RGPD de l\'UE et à la loi polonaise sur les communications électroniques.',
    pt: 'Esta mensagem está em conformidade com o RGPD da UE e a Lei de Comunicações Eletrónicas da Polónia.',
    de: 'Diese Nachricht entspricht der EU-DSGVO und dem polnischen Gesetz über elektronische Kommunikation.',
    ht: 'Mesaj sa a konfòm ak GDPR UE ak Lwa Kominikasyon Elektwonik Polòy.',
    it: 'Questo messaggio è conforme al GDPR dell\'UE e alla legge polacca sulle comunicazioni elettroniche.',
    nl: 'Dit bericht voldoet aan de EU AVG en de Poolse wet op elektronische communicatie.',
    sv: 'Detta meddelande överensstämmer med EU GDPR och polsk lag om elektronisk kommunikation.',
    no: 'Denne meldingen er i samsvar med EU GDPR og polsk lov om elektronisk kommunikasjon.',
    da: 'Denne besked overholder EU GDPR og polsk lov om elektronisk kommunikation.',
    fi: 'Tämä viesti noudattaa EU:n GDPR:ää ja Puolan sähköisen viestinnän lakia.',
    is: 'Þessi skilaboð uppfylla GDPR ESB og pólsk lög um rafræn samskipti.',
    ru: 'Это сообщение соответствует GDPR ЕС и польскому закону об электронных коммуникациях.',
    tr: 'Bu mesaj AB GDPR ve Polonya Elektronik İletişim Yasasına uygundur.',
    zh: '此邮件符合欧盟GDPR和波兰电子通信法。',
    ko: '이 메시지는 EU GDPR 및 폴란드 전자통신법을 준수합니다.',
    ja: 'このメッセージはEU GDPRおよびポーランドの電子通信法に準拠しています。',
  },
  // Switzerland - Swiss data protection compliance
  CH: {
    en: 'This message complies with the Swiss Federal Data Protection Act (FADP).',
    es: 'Este mensaje cumple con la Ley Federal Suiza de Protección de Datos (LPD).',
    fr: 'Ce message est conforme à la loi fédérale suisse sur la protection des données (LPD).',
    pt: 'Esta mensagem está em conformidade com a Lei Federal Suíça de Proteção de Dados (LPD).',
    de: 'Diese Nachricht entspricht dem Schweizer Datenschutzgesetz (DSG).',
    ht: 'Mesaj sa a konfòm ak Lwa Federal Swis sou Pwoteksyon Done (FADP).',
    it: 'Questo messaggio è conforme alla legge federale svizzera sulla protezione dei dati (LPD).',
    nl: 'Dit bericht voldoet aan de Zwitserse federale gegevensbeschermingswet (FADP).',
    sv: 'Detta meddelande överensstämmer med Schweiziska federala dataskyddslagen (FADP).',
    no: 'Denne meldingen er i samsvar med den sveitsiske føderale personvernloven (FADP).',
    da: 'Denne besked overholder den schweiziske føderale databeskyttelseslov (FADP).',
    fi: 'Tämä viesti noudattaa Sveitsin liittovaltion tietosuojalakia (FADP).',
    is: 'Þessi skilaboð uppfylla svissnesku alríkispersónuverndarlögin (FADP).',
    ru: 'Это сообщение соответствует Швейцарскому федеральному закону о защите данных (FADP).',
    tr: 'Bu mesaj İsviçre Federal Veri Koruma Yasasına (FADP) uygundur.',
    zh: '此邮件符合瑞士联邦数据保护法（FADP）。',
    ko: '이 메시지는 스위스 연방 데이터 보호법(FADP)을 준수합니다.',
    ja: 'このメッセージはスイス連邦データ保護法（FADP）に準拠しています。',
  },
};

/**
 * US State-specific legal notices
 * States with specific privacy/data protection laws get custom notices
 * Other states get standard CAN-SPAM compliance text
 */
export const US_STATE_LEGAL_NOTICES: Record<string, Record<Language, string>> = {
  // States with specific privacy laws
  CA: {
    en: 'This message complies with the CAN-SPAM Act and the California Consumer Privacy Act (CCPA/CPRA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad del Consumidor de California (CCPA/CPRA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la California Consumer Privacy Act (CCPA/CPRA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade do Consumidor da Califórnia (CCPA/CPRA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem California Consumer Privacy Act (CCPA/CPRA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Konsomatè Kalifòni (CCPA/CPRA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al California Consumer Privacy Act (CCPA/CPRA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de California Consumer Privacy Act (CCPA/CPRA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och California Consumer Privacy Act (CCPA/CPRA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og California Consumer Privacy Act (CCPA/CPRA).',
    da: 'Denne besked overholder CAN-SPAM-loven og California Consumer Privacy Act (CCPA/CPRA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Kalifornian kuluttajan yksityisyyslakia (CCPA/CPRA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og California Consumer Privacy Act (CCPA/CPRA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и Калифорнийскому закону о защите конфиденциальности потребителей (CCPA/CPRA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Kaliforniya Tüketici Gizlilik Yasasına (CCPA/CPRA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和加州消费者隐私法（CCPA/CPRA）。',
    ko: '이 메시지는 CAN-SPAM 법과 캘리포니아 소비자 개인정보 보호법(CCPA/CPRA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびカリフォルニア州消費者プライバシー法（CCPA/CPRA）に準拠しています。',
  },
  CO: {
    en: 'This message complies with the CAN-SPAM Act and the Colorado Privacy Act (CPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad de Colorado (CPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Colorado Privacy Act (CPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade do Colorado (CPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Colorado Privacy Act (CPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Colorado (CPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al Colorado Privacy Act (CPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Colorado Privacy Act (CPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Colorado Privacy Act (CPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Colorado Privacy Act (CPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Colorado Privacy Act (CPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Coloradon yksityisyyslakia (CPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Colorado Privacy Act (CPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности штата Колорадо (CPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Colorado Gizlilik Yasasına (CPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和科罗拉多州隐私法（CPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 콜로라도 개인정보 보호법(CPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびコロラド州プライバシー法（CPA）に準拠しています。',
  },
  CT: {
    en: 'This message complies with the CAN-SPAM Act and the Connecticut Data Privacy Act (CTDPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad de Datos de Connecticut (CTDPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Connecticut Data Privacy Act (CTDPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade de Dados de Connecticut (CTDPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Connecticut Data Privacy Act (CTDPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Done Connecticut (CTDPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al Connecticut Data Privacy Act (CTDPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Connecticut Data Privacy Act (CTDPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Connecticut Data Privacy Act (CTDPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Connecticut Data Privacy Act (CTDPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Connecticut Data Privacy Act (CTDPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Connecticutin tietosuojalakia (CTDPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Connecticut Data Privacy Act (CTDPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности данных штата Коннектикут (CTDPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Connecticut Veri Gizliliği Yasasına (CTDPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和康涅狄格州数据隐私法（CTDPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 코네티컷 데이터 개인정보 보호법(CTDPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびコネチカット州データプライバシー法（CTDPA）に準拠しています。',
  },
  DE: {
    en: 'This message complies with the CAN-SPAM Act and the Delaware Personal Data Privacy Act (DPDPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad de Datos Personales de Delaware (DPDPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Delaware Personal Data Privacy Act (DPDPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade de Dados Pessoais de Delaware (DPDPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Delaware Personal Data Privacy Act (DPDPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Done Pèsonèl Delaware (DPDPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al Delaware Personal Data Privacy Act (DPDPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Delaware Personal Data Privacy Act (DPDPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Delaware Personal Data Privacy Act (DPDPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Delaware Personal Data Privacy Act (DPDPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Delaware Personal Data Privacy Act (DPDPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Delawaren henkilötietojen yksityisyyslakia (DPDPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Delaware Personal Data Privacy Act (DPDPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности персональных данных штата Делавэр (DPDPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Delaware Kişisel Veri Gizliliği Yasasına (DPDPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和特拉华州个人数据隐私法（DPDPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 델라웨어 개인 데이터 개인정보 보호법(DPDPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびデラウェア州個人データプライバシー法（DPDPA）に準拠しています。',
  },
  FL: {
    en: 'This message complies with the CAN-SPAM Act and Florida Digital Bill of Rights (FDBR).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Carta de Derechos Digitales de Florida (FDBR).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Florida Digital Bill of Rights (FDBR).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Carta de Direitos Digitais da Flórida (FDBR).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und der Florida Digital Bill of Rights (FDBR).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Dwa Dijital Florid (FDBR).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e alla Florida Digital Bill of Rights (FDBR).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Florida Digital Bill of Rights (FDBR).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Florida Digital Bill of Rights (FDBR).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Florida Digital Bill of Rights (FDBR).',
    da: 'Denne besked overholder CAN-SPAM-loven og Florida Digital Bill of Rights (FDBR).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Floridan digitaalisten oikeuksien lakia (FDBR).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Florida Digital Bill of Rights (FDBR).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о цифровых правах штата Флорида (FDBR).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Florida Dijital Haklar Bildirgesi (FDBR) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和佛罗里达州数字权利法案（FDBR）。',
    ko: '이 메시지는 CAN-SPAM 법과 플로리다 디지털 권리 장전(FDBR)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびフロリダ州デジタル権利章典（FDBR）に準拠しています。',
  },
  IN: {
    en: 'This message complies with the CAN-SPAM Act and the Indiana Consumer Data Protection Act (ICDPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Protección de Datos del Consumidor de Indiana (ICDPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Indiana Consumer Data Protection Act (ICDPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Proteção de Dados do Consumidor de Indiana (ICDPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Indiana Consumer Data Protection Act (ICDPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Pwoteksyon Done Konsomatè Indiana (ICDPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e all\'Indiana Consumer Data Protection Act (ICDPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Indiana Consumer Data Protection Act (ICDPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Indiana Consumer Data Protection Act (ICDPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Indiana Consumer Data Protection Act (ICDPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Indiana Consumer Data Protection Act (ICDPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Indianan kuluttajatietojen suojalakia (ICDPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Indiana Consumer Data Protection Act (ICDPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о защите данных потребителей штата Индиана (ICDPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Indiana Tüketici Veri Koruma Yasasına (ICDPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和印第安纳州消费者数据保护法（ICDPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 인디애나 소비자 데이터 보호법(ICDPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびインディアナ州消費者データ保護法（ICDPA）に準拠しています。',
  },
  IA: {
    en: 'This message complies with the CAN-SPAM Act and the Iowa Consumer Data Protection Act (ICDPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Protección de Datos del Consumidor de Iowa (ICDPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Iowa Consumer Data Protection Act (ICDPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Proteção de Dados do Consumidor de Iowa (ICDPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Iowa Consumer Data Protection Act (ICDPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Pwoteksyon Done Konsomatè Iowa (ICDPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e all\'Iowa Consumer Data Protection Act (ICDPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Iowa Consumer Data Protection Act (ICDPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Iowa Consumer Data Protection Act (ICDPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Iowa Consumer Data Protection Act (ICDPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Iowa Consumer Data Protection Act (ICDPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Iowan kuluttajatietojen suojalakia (ICDPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Iowa Consumer Data Protection Act (ICDPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о защите данных потребителей штата Айова (ICDPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Iowa Tüketici Veri Koruma Yasasına (ICDPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和爱荷华州消费者数据保护法（ICDPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 아이오와 소비자 데이터 보호법(ICDPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびアイオワ州消費者データ保護法（ICDPA）に準拠しています。',
  },
  MT: {
    en: 'This message complies with the CAN-SPAM Act and the Montana Consumer Data Privacy Act (MCDPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad de Datos del Consumidor de Montana (MCDPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Montana Consumer Data Privacy Act (MCDPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade de Dados do Consumidor de Montana (MCDPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Montana Consumer Data Privacy Act (MCDPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Done Konsomatè Montana (MCDPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al Montana Consumer Data Privacy Act (MCDPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Montana Consumer Data Privacy Act (MCDPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Montana Consumer Data Privacy Act (MCDPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Montana Consumer Data Privacy Act (MCDPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Montana Consumer Data Privacy Act (MCDPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Montanan kuluttajatietojen yksityisyyslakia (MCDPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Montana Consumer Data Privacy Act (MCDPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности данных потребителей штата Монтана (MCDPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Montana Tüketici Veri Gizliliği Yasasına (MCDPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和蒙大拿州消费者数据隐私法（MCDPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 몬태나 소비자 데이터 개인정보 보호법(MCDPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびモンタナ州消費者データプライバシー法（MCDPA）に準拠しています。',
  },
  NV: {
    en: 'This message complies with the CAN-SPAM Act and Nevada Privacy Law (SB 220).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad de Nevada (SB 220).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Nevada Privacy Law (SB 220).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade de Nevada (SB 220).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Nevada Privacy Law (SB 220).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Nevada (SB 220).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e alla Nevada Privacy Law (SB 220).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Nevada Privacy Law (SB 220).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Nevada Privacy Law (SB 220).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Nevada Privacy Law (SB 220).',
    da: 'Denne besked overholder CAN-SPAM-loven og Nevada Privacy Law (SB 220).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Nevadan yksityisyyslakia (SB 220).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Nevada Privacy Law (SB 220).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности штата Невада (SB 220).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Nevada Gizlilik Yasasına (SB 220) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和内华达州隐私法（SB 220）。',
    ko: '이 메시지는 CAN-SPAM 법과 네바다 개인정보 보호법(SB 220)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびネバダ州プライバシー法（SB 220）に準拠しています。',
  },
  NH: {
    en: 'This message complies with the CAN-SPAM Act and the New Hampshire Privacy Act (NHPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad de New Hampshire (NHPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la New Hampshire Privacy Act (NHPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade de New Hampshire (NHPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem New Hampshire Privacy Act (NHPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite New Hampshire (NHPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al New Hampshire Privacy Act (NHPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de New Hampshire Privacy Act (NHPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och New Hampshire Privacy Act (NHPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og New Hampshire Privacy Act (NHPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og New Hampshire Privacy Act (NHPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja New Hampshiren yksityisyyslakia (NHPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og New Hampshire Privacy Act (NHPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности штата Нью-Гэмпшир (NHPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve New Hampshire Gizlilik Yasasına (NHPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和新罕布什尔州隐私法（NHPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 뉴햄프셔 개인정보 보호법(NHPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびニューハンプシャー州プライバシー法（NHPA）に準拠しています。',
  },
  NJ: {
    en: 'This message complies with the CAN-SPAM Act and the New Jersey Data Privacy Act (NJDPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad de Datos de New Jersey (NJDPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la New Jersey Data Privacy Act (NJDPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade de Dados de New Jersey (NJDPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem New Jersey Data Privacy Act (NJDPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Done New Jersey (NJDPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al New Jersey Data Privacy Act (NJDPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de New Jersey Data Privacy Act (NJDPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och New Jersey Data Privacy Act (NJDPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og New Jersey Data Privacy Act (NJDPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og New Jersey Data Privacy Act (NJDPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja New Jerseyn tietosuojalakia (NJDPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og New Jersey Data Privacy Act (NJDPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности данных штата Нью-Джерси (NJDPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve New Jersey Veri Gizliliği Yasasına (NJDPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和新泽西州数据隐私法（NJDPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 뉴저지 데이터 개인정보 보호법(NJDPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびニュージャージー州データプライバシー法（NJDPA）に準拠しています。',
  },
  OR: {
    en: 'This message complies with the CAN-SPAM Act and the Oregon Consumer Privacy Act (OCPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad del Consumidor de Oregon (OCPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Oregon Consumer Privacy Act (OCPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade do Consumidor de Oregon (OCPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Oregon Consumer Privacy Act (OCPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Konsomatè Oregon (OCPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e all\'Oregon Consumer Privacy Act (OCPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Oregon Consumer Privacy Act (OCPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Oregon Consumer Privacy Act (OCPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Oregon Consumer Privacy Act (OCPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Oregon Consumer Privacy Act (OCPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Oregonin kuluttajan yksityisyyslakia (OCPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Oregon Consumer Privacy Act (OCPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности потребителей штата Орегон (OCPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Oregon Tüketici Gizlilik Yasasına (OCPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和俄勒冈州消费者隐私法（OCPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 오레곤 소비자 개인정보 보호법(OCPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびオレゴン州消費者プライバシー法（OCPA）に準拠しています。',
  },
  TN: {
    en: 'This message complies with the CAN-SPAM Act and the Tennessee Information Protection Act (TIPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Protección de Información de Tennessee (TIPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Tennessee Information Protection Act (TIPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Proteção de Informações de Tennessee (TIPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Tennessee Information Protection Act (TIPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Pwoteksyon Enfòmasyon Tennessee (TIPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al Tennessee Information Protection Act (TIPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Tennessee Information Protection Act (TIPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Tennessee Information Protection Act (TIPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Tennessee Information Protection Act (TIPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Tennessee Information Protection Act (TIPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Tennesseen tietosuojalakia (TIPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Tennessee Information Protection Act (TIPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о защите информации штата Теннесси (TIPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Tennessee Bilgi Koruma Yasasına (TIPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和田纳西州信息保护法（TIPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 테네시 정보 보호법(TIPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびテネシー州情報保護法（TIPA）に準拠しています。',
  },
  TX: {
    en: 'This message complies with the CAN-SPAM Act and the Texas Data Privacy and Security Act (TDPSA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad y Seguridad de Datos de Texas (TDPSA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Texas Data Privacy and Security Act (TDPSA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade e Segurança de Dados do Texas (TDPSA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Texas Data Privacy and Security Act (TDPSA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite ak Sekirite Done Texas (TDPSA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al Texas Data Privacy and Security Act (TDPSA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Texas Data Privacy and Security Act (TDPSA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Texas Data Privacy and Security Act (TDPSA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Texas Data Privacy and Security Act (TDPSA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Texas Data Privacy and Security Act (TDPSA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Texasin tietosuoja- ja turvallisuuslakia (TDPSA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Texas Data Privacy and Security Act (TDPSA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности и безопасности данных штата Техас (TDPSA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Texas Veri Gizliliği ve Güvenliği Yasasına (TDPSA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和德克萨斯州数据隐私和安全法（TDPSA）。',
    ko: '이 메시지는 CAN-SPAM 법과 텍사스 데이터 개인정보 보호 및 보안법(TDPSA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびテキサス州データプライバシー・セキュリティ法（TDPSA）に準拠しています。',
  },
  UT: {
    en: 'This message complies with the CAN-SPAM Act and the Utah Consumer Privacy Act (UCPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Privacidad del Consumidor de Utah (UCPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Utah Consumer Privacy Act (UCPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Privacidade do Consumidor de Utah (UCPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Utah Consumer Privacy Act (UCPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Konfidansyalite Konsomatè Utah (UCPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e all\'Utah Consumer Privacy Act (UCPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Utah Consumer Privacy Act (UCPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Utah Consumer Privacy Act (UCPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Utah Consumer Privacy Act (UCPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Utah Consumer Privacy Act (UCPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Utahin kuluttajan yksityisyyslakia (UCPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Utah Consumer Privacy Act (UCPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о конфиденциальности потребителей штата Юта (UCPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Utah Tüketici Gizlilik Yasasına (UCPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和犹他州消费者隐私法（UCPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 유타 소비자 개인정보 보호법(UCPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびユタ州消費者プライバシー法（UCPA）に準拠しています。',
  },
  VA: {
    en: 'This message complies with the CAN-SPAM Act and the Virginia Consumer Data Protection Act (VCDPA).',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley de Protección de Datos del Consumidor de Virginia (VCDPA).',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la Virginia Consumer Data Protection Act (VCDPA).',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei de Proteção de Dados do Consumidor da Virgínia (VCDPA).',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem Virginia Consumer Data Protection Act (VCDPA).',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa Pwoteksyon Done Konsomatè Virginia (VCDPA).',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al Virginia Consumer Data Protection Act (VCDPA).',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de Virginia Consumer Data Protection Act (VCDPA).',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och Virginia Consumer Data Protection Act (VCDPA).',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og Virginia Consumer Data Protection Act (VCDPA).',
    da: 'Denne besked overholder CAN-SPAM-loven og Virginia Consumer Data Protection Act (VCDPA).',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja Virginian kuluttajatietojen suojalakia (VCDPA).',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og Virginia Consumer Data Protection Act (VCDPA).',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону о защите данных потребителей штата Вирджиния (VCDPA).',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve Virginia Tüketici Veri Koruma Yasasına (VCDPA) uygundur.',
    zh: '此邮件符合CAN-SPAM法案和弗吉尼亚州消费者数据保护法（VCDPA）。',
    ko: '이 메시지는 CAN-SPAM 법과 버지니아 소비자 데이터 보호법(VCDPA)을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびバージニア州消費者データ保護法（VCDPA）に準拠しています。',
  },
  NY: {
    en: 'This message complies with the CAN-SPAM Act and New York SHIELD Act.',
    es: 'Este mensaje cumple con la Ley CAN-SPAM y la Ley SHIELD de Nueva York.',
    fr: 'Ce message est conforme à la loi CAN-SPAM et à la New York SHIELD Act.',
    pt: 'Esta mensagem está em conformidade com a Lei CAN-SPAM e a Lei SHIELD de Nova York.',
    de: 'Diese Nachricht entspricht dem CAN-SPAM-Gesetz und dem New York SHIELD Act.',
    ht: 'Mesaj sa a konfòm ak Lwa CAN-SPAM ak Lwa SHIELD New York.',
    it: 'Questo messaggio è conforme alla legge CAN-SPAM e al New York SHIELD Act.',
    nl: 'Dit bericht voldoet aan de CAN-SPAM-wet en de New York SHIELD Act.',
    sv: 'Detta meddelande överensstämmer med CAN-SPAM-lagen och New York SHIELD Act.',
    no: 'Denne meldingen er i samsvar med CAN-SPAM-loven og New York SHIELD Act.',
    da: 'Denne besked overholder CAN-SPAM-loven og New York SHIELD Act.',
    fi: 'Tämä viesti noudattaa CAN-SPAM-lakia ja New Yorkin SHIELD-lakia.',
    is: 'Þessi skilaboð uppfylla CAN-SPAM lögin og New York SHIELD Act.',
    ru: 'Это сообщение соответствует закону CAN-SPAM и закону SHIELD штата Нью-Йорк.',
    tr: 'Bu mesaj CAN-SPAM Yasasına ve New York SHIELD Yasasına uygundur.',
    zh: '此邮件符合CAN-SPAM法案和纽约州SHIELD法。',
    ko: '이 메시지는 CAN-SPAM 법과 뉴욕 SHIELD 법을 준수합니다.',
    ja: 'このメッセージはCAN-SPAM法およびニューヨーク州SHIELD法に準拠しています。',
  },
};

/**
 * Generate email footer based on country, state (if US), and language
 * @param businessName - The business name to display
 * @param businessAddress - The business address to display
 * @param countryCode - The country code for legal compliance
 * @param stateCode - The US state code (only used if country is US)
 * @param footerLanguage - The language for the footer text
 * @param unsubscribeUrl - The unsubscribe URL (optional, placeholder used if not provided)
 * @returns Formatted email footer string
 */
/**
 * Format phone number for display in email footer
 * US numbers: (XXX) XXX-XXXX
 * International: [original format preserved]
 */
export function formatPhoneForEmailFooter(phone: string): string {
  if (!phone) return '';
  const digitsOnly = phone.replace(/\D/g, '');
  // Check if it's a 10-digit US number
  if (digitsOnly.length === 10) {
    return `(${digitsOnly.slice(0, 3)}) ${digitsOnly.slice(3, 6)}-${digitsOnly.slice(6)}`;
  }
  // For international or other formats, return as-is
  return phone;
}

export function generateEmailFooter(
  businessName: string,
  businessAddress: string,
  countryCode: CountryCode | undefined,
  stateCode: string | undefined,
  footerLanguage: Language,
  unsubscribeUrl?: string,
  businessPhoneNumber?: string
): string {
  const footer = EMAIL_FOOTER_TRANSLATIONS[footerLanguage] || EMAIL_FOOTER_TRANSLATIONS.en;

  // Get country-specific legal notice - only if country is specified
  // IMPORTANT: Do NOT default to US - CAN-SPAM only applies to US businesses
  let legalNotice = '';

  if (countryCode) {
    // For US, check state-specific notices first
    if (countryCode === 'US' && stateCode && US_STATE_LEGAL_NOTICES[stateCode]) {
      legalNotice = US_STATE_LEGAL_NOTICES[stateCode][footerLanguage] || US_STATE_LEGAL_NOTICES[stateCode].en;
    } else if (COUNTRY_LEGAL_NOTICES[countryCode]) {
      const countryNotices = COUNTRY_LEGAL_NOTICES[countryCode];
      if (countryNotices) {
        legalNotice = countryNotices[footerLanguage] || countryNotices.en || '';
      }
    }
  }

  const unsubLink = unsubscribeUrl || '[Unsubscribe Link]';

  // Build business info block with optional phone number (formatted in US style)
  // Order: Business Name, Address, Phone Number (below address)
  let businessInfoBlock = `${businessName}
${businessAddress}`;
  if (businessPhoneNumber) {
    businessInfoBlock += `
${formatPhoneForEmailFooter(businessPhoneNumber)}`;
  }

  let footerText = `

---
${businessInfoBlock}

${footer.receivingBecause} ${businessName}.

${footer.unsubscribeText} ${businessName}, ${footer.unsubscribeLinkText}:
${unsubLink}

${footer.linkActiveText}`;

  if (legalNotice) {
    footerText += `

${legalNotice}`;
  }

  return footerText;
}

/**
 * Get the preview footer for display in the UI (without actual unsubscribe URL)
 */
export function getEmailFooterPreview(
  businessName: string,
  businessAddress: string,
  countryCode: CountryCode | undefined,
  stateCode: string | undefined,
  footerLanguage: Language,
  businessPhoneNumber?: string
): {
  businessName: string;
  businessAddress: string;
  businessPhoneNumber?: string;
  receivingText: string;
  unsubscribeText: string;
  linkActiveText: string;
  legalNotice: string;
  sentOnBehalf: string;
} {
  const footer = EMAIL_FOOTER_TRANSLATIONS[footerLanguage] || EMAIL_FOOTER_TRANSLATIONS.en;

  // Get country-specific legal notice - only if country is specified
  // IMPORTANT: Do NOT default to US - CAN-SPAM only applies to US businesses
  let legalNotice = '';

  if (countryCode) {
    // For US, check state-specific notices first
    if (countryCode === 'US' && stateCode && US_STATE_LEGAL_NOTICES[stateCode]) {
      legalNotice = US_STATE_LEGAL_NOTICES[stateCode][footerLanguage] || US_STATE_LEGAL_NOTICES[stateCode].en;
    } else if (COUNTRY_LEGAL_NOTICES[countryCode]) {
      const countryNotices = COUNTRY_LEGAL_NOTICES[countryCode];
      if (countryNotices) {
        legalNotice = countryNotices[footerLanguage] || countryNotices.en || '';
      }
    }
  }

  return {
    businessName,
    businessAddress,
    businessPhoneNumber,
    receivingText: `${footer.receivingBecause} ${businessName}.`,
    unsubscribeText: `${footer.unsubscribeText} ${businessName}, ${footer.unsubscribeLinkText}`,
    linkActiveText: footer.linkActiveText,
    legalNotice,
    sentOnBehalf: footer.sentOnBehalf,
  };
}

/**
 * Email compliance helper messages by country/region
 * These are shown above the Send button to inform users about email compliance requirements
 */
export const EMAIL_COMPLIANCE_HELPER_MESSAGES: Record<Language, {
  us: string;
  eu: string;
  uk: string;
  canada: string;
  australia: string;
  brazil: string;
  japan: string;
  generic: string;
}> = {
  en: {
    us: 'An unsubscribe link and CAN-SPAM compliant footer will be automatically added.',
    eu: 'An unsubscribe link and GDPR/ePrivacy compliant footer will be automatically added.',
    uk: 'An unsubscribe link and UK GDPR/PECR compliant footer will be automatically added.',
    canada: 'An unsubscribe link and CASL compliant footer will be automatically added.',
    australia: 'An unsubscribe link and Spam Act compliant footer will be automatically added.',
    brazil: 'An unsubscribe link and LGPD compliant footer will be automatically added.',
    japan: 'An unsubscribe link and compliant footer will be automatically added.',
    generic: 'An unsubscribe link and compliant footer will be automatically added.',
  },
  es: {
    us: 'Se añadirá automáticamente un enlace de cancelación y un pie de página conforme a CAN-SPAM.',
    eu: 'Se añadirá automáticamente un enlace de cancelación y un pie de página conforme al RGPD/ePrivacy.',
    uk: 'Se añadirá automáticamente un enlace de cancelación y un pie de página conforme al RGPD del Reino Unido/PECR.',
    canada: 'Se añadirá automáticamente un enlace de cancelación y un pie de página conforme a CASL.',
    australia: 'Se añadirá automáticamente un enlace de cancelación y un pie de página conforme a la Ley de Spam.',
    brazil: 'Se añadirá automáticamente un enlace de cancelación y un pie de página conforme a la LGPD.',
    japan: 'Se añadirá automáticamente un enlace de cancelación y un pie de página conforme.',
    generic: 'Se añadirá automáticamente un enlace de cancelación y un pie de página conforme.',
  },
  fr: {
    us: 'Un lien de désabonnement et un pied de page conforme CAN-SPAM seront ajoutés automatiquement.',
    eu: 'Un lien de désabonnement et un pied de page conforme RGPD/ePrivacy seront ajoutés automatiquement.',
    uk: 'Un lien de désabonnement et un pied de page conforme RGPD UK/PECR seront ajoutés automatiquement.',
    canada: 'Un lien de désabonnement et un pied de page conforme LCAP seront ajoutés automatiquement.',
    australia: 'Un lien de désabonnement et un pied de page conforme à la loi Spam seront ajoutés automatiquement.',
    brazil: 'Un lien de désabonnement et un pied de page conforme LGPD seront ajoutés automatiquement.',
    japan: 'Un lien de désabonnement et un pied de page conforme seront ajoutés automatiquement.',
    generic: 'Un lien de désabonnement et un pied de page conforme seront ajoutés automatiquement.',
  },
  pt: {
    us: 'Um link de cancelamento e um rodapé em conformidade com CAN-SPAM serão adicionados automaticamente.',
    eu: 'Um link de cancelamento e um rodapé em conformidade com RGPD/ePrivacy serão adicionados automaticamente.',
    uk: 'Um link de cancelamento e um rodapé em conformidade com RGPD UK/PECR serão adicionados automaticamente.',
    canada: 'Um link de cancelamento e um rodapé em conformidade com CASL serão adicionados automaticamente.',
    australia: 'Um link de cancelamento e um rodapé em conformidade com a Lei de Spam serão adicionados automaticamente.',
    brazil: 'Um link de cancelamento e um rodapé em conformidade com a LGPD serão adicionados automaticamente.',
    japan: 'Um link de cancelamento e um rodapé em conformidade serão adicionados automaticamente.',
    generic: 'Um link de cancelamento e um rodapé em conformidade serão adicionados automaticamente.',
  },
  de: {
    us: 'Ein Abmeldelink und eine CAN-SPAM-konforme Fußzeile werden automatisch hinzugefügt.',
    eu: 'Ein Abmeldelink und eine DSGVO/ePrivacy-konforme Fußzeile werden automatisch hinzugefügt.',
    uk: 'Ein Abmeldelink und eine UK DSGVO/PECR-konforme Fußzeile werden automatisch hinzugefügt.',
    canada: 'Ein Abmeldelink und eine CASL-konforme Fußzeile werden automatisch hinzugefügt.',
    australia: 'Ein Abmeldelink und eine Spam Act-konforme Fußzeile werden automatisch hinzugefügt.',
    brazil: 'Ein Abmeldelink und eine LGPD-konforme Fußzeile werden automatisch hinzugefügt.',
    japan: 'Ein Abmeldelink und eine konforme Fußzeile werden automatisch hinzugefügt.',
    generic: 'Ein Abmeldelink und eine konforme Fußzeile werden automatisch hinzugefügt.',
  },
  ht: {
    us: 'Yon lyen dezabònman ak yon pye paj konfòm CAN-SPAM ap ajoute otomatikman.',
    eu: 'Yon lyen dezabònman ak yon pye paj konfòm GDPR/ePrivacy ap ajoute otomatikman.',
    uk: 'Yon lyen dezabònman ak yon pye paj konfòm UK GDPR/PECR ap ajoute otomatikman.',
    canada: 'Yon lyen dezabònman ak yon pye paj konfòm CASL ap ajoute otomatikman.',
    australia: 'Yon lyen dezabònman ak yon pye paj konfòm Lwa Spam ap ajoute otomatikman.',
    brazil: 'Yon lyen dezabònman ak yon pye paj konfòm LGPD ap ajoute otomatikman.',
    japan: 'Yon lyen dezabònman ak yon pye paj konfòm ap ajoute otomatikman.',
    generic: 'Yon lyen dezabònman ak yon pye paj konfòm ap ajoute otomatikman.',
  },
  it: {
    us: 'Un link di cancellazione e un piè di pagina conforme CAN-SPAM verranno aggiunti automaticamente.',
    eu: 'Un link di cancellazione e un piè di pagina conforme GDPR/ePrivacy verranno aggiunti automaticamente.',
    uk: 'Un link di cancellazione e un piè di pagina conforme UK GDPR/PECR verranno aggiunti automaticamente.',
    canada: 'Un link di cancellazione e un piè di pagina conforme CASL verranno aggiunti automaticamente.',
    australia: 'Un link di cancellazione e un piè di pagina conforme Spam Act verranno aggiunti automaticamente.',
    brazil: 'Un link di cancellazione e un piè di pagina conforme LGPD verranno aggiunti automaticamente.',
    japan: 'Un link di cancellazione e un piè di pagina conforme verranno aggiunti automaticamente.',
    generic: 'Un link di cancellazione e un piè di pagina conforme verranno aggiunti automaticamente.',
  },
  nl: {
    us: 'Een uitschrijflink en CAN-SPAM-conforme voettekst worden automatisch toegevoegd.',
    eu: 'Een uitschrijflink en AVG/ePrivacy-conforme voettekst worden automatisch toegevoegd.',
    uk: 'Een uitschrijflink en UK AVG/PECR-conforme voettekst worden automatisch toegevoegd.',
    canada: 'Een uitschrijflink en CASL-conforme voettekst worden automatisch toegevoegd.',
    australia: 'Een uitschrijflink en Spam Act-conforme voettekst worden automatisch toegevoegd.',
    brazil: 'Een uitschrijflink en LGPD-conforme voettekst worden automatisch toegevoegd.',
    japan: 'Een uitschrijflink en conforme voettekst worden automatisch toegevoegd.',
    generic: 'Een uitschrijflink en conforme voettekst worden automatisch toegevoegd.',
  },
  sv: {
    us: 'En avregistreringslänk och CAN-SPAM-kompatibel sidfot läggs till automatiskt.',
    eu: 'En avregistreringslänk och GDPR/ePrivacy-kompatibel sidfot läggs till automatiskt.',
    uk: 'En avregistreringslänk och UK GDPR/PECR-kompatibel sidfot läggs till automatiskt.',
    canada: 'En avregistreringslänk och CASL-kompatibel sidfot läggs till automatiskt.',
    australia: 'En avregistreringslänk och Spam Act-kompatibel sidfot läggs till automatiskt.',
    brazil: 'En avregistreringslänk och LGPD-kompatibel sidfot läggs till automatiskt.',
    japan: 'En avregistreringslänk och kompatibel sidfot läggs till automatiskt.',
    generic: 'En avregistreringslänk och kompatibel sidfot läggs till automatiskt.',
  },
  no: {
    us: 'En avmeldingslenke og CAN-SPAM-kompatibel bunntekst legges til automatisk.',
    eu: 'En avmeldingslenke og GDPR/ePrivacy-kompatibel bunntekst legges til automatisk.',
    uk: 'En avmeldingslenke og UK GDPR/PECR-kompatibel bunntekst legges til automatisk.',
    canada: 'En avmeldingslenke og CASL-kompatibel bunntekst legges til automatisk.',
    australia: 'En avmeldingslenke og Spam Act-kompatibel bunntekst legges til automatisk.',
    brazil: 'En avmeldingslenke og LGPD-kompatibel bunntekst legges til automatisk.',
    japan: 'En avmeldingslenke og kompatibel bunntekst legges til automatisk.',
    generic: 'En avmeldingslenke og kompatibel bunntekst legges til automatisk.',
  },
  da: {
    us: 'Et afmeldingslink og CAN-SPAM-kompatibel sidefod tilføjes automatisk.',
    eu: 'Et afmeldingslink og GDPR/ePrivacy-kompatibel sidefod tilføjes automatisk.',
    uk: 'Et afmeldingslink og UK GDPR/PECR-kompatibel sidefod tilføjes automatisk.',
    canada: 'Et afmeldingslink og CASL-kompatibel sidefod tilføjes automatisk.',
    australia: 'Et afmeldingslink og Spam Act-kompatibel sidefod tilføjes automatisk.',
    brazil: 'Et afmeldingslink og LGPD-kompatibel sidefod tilføjes automatisk.',
    japan: 'Et afmeldingslink og kompatibel sidefod tilføjes automatisk.',
    generic: 'Et afmeldingslink og kompatibel sidefod tilføjes automatisk.',
  },
  fi: {
    us: 'Peruutuslinkki ja CAN-SPAM-yhteensopiva alatunniste lisätään automaattisesti.',
    eu: 'Peruutuslinkki ja GDPR/ePrivacy-yhteensopiva alatunniste lisätään automaattisesti.',
    uk: 'Peruutuslinkki ja UK GDPR/PECR-yhteensopiva alatunniste lisätään automaattisesti.',
    canada: 'Peruutuslinkki ja CASL-yhteensopiva alatunniste lisätään automaattisesti.',
    australia: 'Peruutuslinkki ja Spam Act-yhteensopiva alatunniste lisätään automaattisesti.',
    brazil: 'Peruutuslinkki ja LGPD-yhteensopiva alatunniste lisätään automaattisesti.',
    japan: 'Peruutuslinkki ja yhteensopiva alatunniste lisätään automaattisesti.',
    generic: 'Peruutuslinkki ja yhteensopiva alatunniste lisätään automaattisesti.',
  },
  is: {
    us: 'Afskráningartengill og CAN-SPAM samhæfður síðufótur bætist við sjálfkrafa.',
    eu: 'Afskráningartengill og GDPR/ePrivacy samhæfður síðufótur bætist við sjálfkrafa.',
    uk: 'Afskráningartengill og UK GDPR/PECR samhæfður síðufótur bætist við sjálfkrafa.',
    canada: 'Afskráningartengill og CASL samhæfður síðufótur bætist við sjálfkrafa.',
    australia: 'Afskráningartengill og Spam Act samhæfður síðufótur bætist við sjálfkrafa.',
    brazil: 'Afskráningartengill og LGPD samhæfður síðufótur bætist við sjálfkrafa.',
    japan: 'Afskráningartengill og samhæfður síðufótur bætist við sjálfkrafa.',
    generic: 'Afskráningartengill og samhæfður síðufótur bætist við sjálfkrafa.',
  },
  ru: {
    us: 'Ссылка для отписки и нижний колонтитул, соответствующий CAN-SPAM, будут добавлены автоматически.',
    eu: 'Ссылка для отписки и нижний колонтитул, соответствующий GDPR/ePrivacy, будут добавлены автоматически.',
    uk: 'Ссылка для отписки и нижний колонтитул, соответствующий UK GDPR/PECR, будут добавлены автоматически.',
    canada: 'Ссылка для отписки и нижний колонтитул, соответствующий CASL, будут добавлены автоматически.',
    australia: 'Ссылка для отписки и нижний колонтитул, соответствующий Spam Act, будут добавлены автоматически.',
    brazil: 'Ссылка для отписки и нижний колонтитул, соответствующий LGPD, будут добавлены автоматически.',
    japan: 'Ссылка для отписки и соответствующий нижний колонтитул будут добавлены автоматически.',
    generic: 'Ссылка для отписки и соответствующий нижний колонтитул будут добавлены автоматически.',
  },
  tr: {
    us: 'Abonelikten çıkma bağlantısı ve CAN-SPAM uyumlu altbilgi otomatik olarak eklenecektir.',
    eu: 'Abonelikten çıkma bağlantısı ve GDPR/ePrivacy uyumlu altbilgi otomatik olarak eklenecektir.',
    uk: 'Abonelikten çıkma bağlantısı ve UK GDPR/PECR uyumlu altbilgi otomatik olarak eklenecektir.',
    canada: 'Abonelikten çıkma bağlantısı ve CASL uyumlu altbilgi otomatik olarak eklenecektir.',
    australia: 'Abonelikten çıkma bağlantısı ve Spam Yasası uyumlu altbilgi otomatik olarak eklenecektir.',
    brazil: 'Abonelikten çıkma bağlantısı ve LGPD uyumlu altbilgi otomatik olarak eklenecektir.',
    japan: 'Abonelikten çıkma bağlantısı ve uyumlu altbilgi otomatik olarak eklenecektir.',
    generic: 'Abonelikten çıkma bağlantısı ve uyumlu altbilgi otomatik olarak eklenecektir.',
  },
  zh: {
    us: '退订链接和符合CAN-SPAM的页脚将自动添加。',
    eu: '退订链接和符合GDPR/ePrivacy的页脚将自动添加。',
    uk: '退订链接和符合UK GDPR/PECR的页脚将自动添加。',
    canada: '退订链接和符合CASL的页脚将自动添加。',
    australia: '退订链接和符合反垃圾邮件法的页脚将自动添加。',
    brazil: '退订链接和符合LGPD的页脚将自动添加。',
    japan: '退订链接和合规页脚将自动添加。',
    generic: '退订链接和合规页脚将自动添加。',
  },
  ko: {
    us: '수신 거부 링크와 CAN-SPAM 준수 바닥글이 자동으로 추가됩니다.',
    eu: '수신 거부 링크와 GDPR/ePrivacy 준수 바닥글이 자동으로 추가됩니다.',
    uk: '수신 거부 링크와 UK GDPR/PECR 준수 바닥글이 자동으로 추가됩니다.',
    canada: '수신 거부 링크와 CASL 준수 바닥글이 자동으로 추가됩니다.',
    australia: '수신 거부 링크와 스팸법 준수 바닥글이 자동으로 추가됩니다.',
    brazil: '수신 거부 링크와 LGPD 준수 바닥글이 자동으로 추가됩니다.',
    japan: '수신 거부 링크와 준수 바닥글이 자동으로 추가됩니다.',
    generic: '수신 거부 링크와 준수 바닥글이 자동으로 추가됩니다.',
  },
  ja: {
    us: '配信停止リンクとCAN-SPAM準拠のフッターが自動的に追加されます。',
    eu: '配信停止リンクとGDPR/ePrivacy準拠のフッターが自動的に追加されます。',
    uk: '配信停止リンクとUK GDPR/PECR準拠のフッターが自動的に追加されます。',
    canada: '配信停止リンクとCASL準拠のフッターが自動的に追加されます。',
    australia: '配信停止リンクとスパム法準拠のフッターが自動的に追加されます。',
    brazil: '配信停止リンクとLGPD準拠のフッターが自動的に追加されます。',
    japan: '配信停止リンクと準拠フッターが自動的に追加されます。',
    generic: '配信停止リンクと準拠フッターが自動的に追加されます。',
  },
};

// EU member states for compliance region detection
const EU_COUNTRIES: CountryCode[] = [
  'DE', 'FR', 'IT', 'ES', 'PT', 'NL', 'BE', 'AT', 'IE', 'LU',
  'SE', 'DK', 'FI', 'PL', 'IS', 'NO', // Note: NO and IS are EEA, not EU
];

/**
 * Get the compliance region for a country code
 */
function getComplianceRegion(countryCode: CountryCode | undefined): 'us' | 'eu' | 'uk' | 'canada' | 'australia' | 'brazil' | 'japan' | 'generic' {
  if (!countryCode) return 'generic';

  if (countryCode === 'US') return 'us';
  if (countryCode === 'GB') return 'uk';
  if (countryCode === 'CA') return 'canada';
  if (countryCode === 'AU' || countryCode === 'NZ') return 'australia';
  if (countryCode === 'BR') return 'brazil';
  if (countryCode === 'JP') return 'japan';
  if (EU_COUNTRIES.includes(countryCode)) return 'eu';

  return 'generic';
}

/**
 * State-specific helper messages for US states with privacy laws
 * Maps state code to the privacy law name to append to the helper message
 */
const US_STATE_PRIVACY_LAW_NAMES: Record<string, string> = {
  CA: 'CCPA/CPRA',
  CO: 'CPA',
  CT: 'CTDPA',
  DE: 'DPDPA',
  FL: 'FDBR',
  IN: 'ICDPA',
  IA: 'ICDPA',
  MT: 'MCDPA',
  NV: 'SB 220',
  NH: 'NHPA',
  NJ: 'NJDPA',
  OR: 'OCPA',
  TN: 'TIPA',
  TX: 'TDPSA',
  UT: 'UCPA',
  VA: 'VCDPA',
  NY: 'SHIELD Act',
};

/**
 * State-specific helper message templates per language
 * {0} = state-specific law name
 */
const US_STATE_HELPER_TEMPLATES: Record<Language, string> = {
  en: 'Unsubscribe link and CAN-SPAM/{0} compliant footer will be added automatically.',
  es: 'El enlace de cancelación de suscripción y el pie de página compatible con CAN-SPAM/{0} se añadirán automáticamente.',
  fr: 'Le lien de désabonnement et le pied de page conforme CAN-SPAM/{0} seront ajoutés automatiquement.',
  pt: 'O link de cancelamento de inscrição e o rodapé compatível com CAN-SPAM/{0} serão adicionados automaticamente.',
  de: 'Der Abmeldelink und die CAN-SPAM/{0}-konforme Fußzeile werden automatisch hinzugefügt.',
  ht: 'Lyen dezabònman ak pye paj konfòm CAN-SPAM/{0} ap ajoute otomatikman.',
  it: 'Il link di annullamento dell\'iscrizione e il piè di pagina conforme a CAN-SPAM/{0} verranno aggiunti automaticamente.',
  nl: 'De afmeldlink en CAN-SPAM/{0}-conforme voettekst worden automatisch toegevoegd.',
  sv: 'Avprenumerationslänk och CAN-SPAM/{0}-kompatibel sidfot läggs till automatiskt.',
  no: 'Avmeldingslenke og CAN-SPAM/{0}-kompatibel bunntekst legges til automatisk.',
  da: 'Afmeldingslink og CAN-SPAM/{0}-kompatibel sidefod tilføjes automatisk.',
  fi: 'Peruutuslinkki ja CAN-SPAM/{0}-yhteensopiva alatunniste lisätään automaattisesti.',
  is: 'Afskráningartengill og CAN-SPAM/{0} samhæfður síðufótur bætist við sjálfkrafa.',
  ru: 'Ссылка для отписки и нижний колонтитул, соответствующий CAN-SPAM/{0}, будут добавлены автоматически.',
  tr: 'Abonelikten çıkma bağlantısı ve CAN-SPAM/{0} uyumlu altbilgi otomatik olarak eklenecektir.',
  zh: '退订链接和符合CAN-SPAM/{0}的页脚将自动添加。',
  ko: '수신 거부 링크와 CAN-SPAM/{0} 준수 바닥글이 자동으로 추가됩니다.',
  ja: '配信停止リンクとCAN-SPAM/{0}準拠のフッターが自動的に追加されます。',
};

/**
 * Get the compliance helper message for a specific country, state, and language
 * This is shown above the Send button to inform users about email compliance requirements
 * @param countryCode - The business country code
 * @param language - The display language
 * @param stateCode - Optional US state code for state-specific messaging
 */
export function getComplianceHelperMessage(
  countryCode: CountryCode | undefined,
  language: Language,
  stateCode?: string
): string {
  const messages = EMAIL_COMPLIANCE_HELPER_MESSAGES[language] || EMAIL_COMPLIANCE_HELPER_MESSAGES.en;
  const region = getComplianceRegion(countryCode);

  // For US with state-specific privacy laws, show enhanced message
  if (countryCode === 'US' && stateCode && US_STATE_PRIVACY_LAW_NAMES[stateCode]) {
    const template = US_STATE_HELPER_TEMPLATES[language] || US_STATE_HELPER_TEMPLATES.en;
    const lawName = US_STATE_PRIVACY_LAW_NAMES[stateCode];
    return template.replace('{0}', lawName);
  }

  return messages[region];
}

/**
 * Get the primary compliance law reference for a specific country
 * Used in the Drip Campaign activation consent modal
 * @param countryCode - The business country code
 * @param stateCode - Optional US state code for state-specific laws
 * @returns The primary compliance law name (e.g., "CAN-SPAM Act", "GDPR", "CASL")
 */
export function getComplianceLawReference(
  countryCode: CountryCode | undefined,
  stateCode?: string
): string {
  // Default to CAN-SPAM if no country specified
  if (!countryCode) {
    return 'CAN-SPAM Act';
  }

  // Get the law reference from the country's disclaimer data
  const disclaimer = EMAIL_COMPLIANCE_DISCLAIMERS[countryCode];
  if (disclaimer) {
    return disclaimer.lawReference;
  }

  // Fallback based on region
  const region = getComplianceRegion(countryCode);
  switch (region) {
    case 'eu':
      return 'GDPR';
    case 'uk':
      return 'UK GDPR & PECR';
    case 'canada':
      return 'CASL';
    case 'australia':
      return 'Spam Act 2003';
    case 'brazil':
      return 'LGPD';
    default:
      return 'applicable email marketing laws';
  }
}
