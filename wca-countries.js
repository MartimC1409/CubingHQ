/* ============================================================
   CubingHQ — WCA country & continent reference data
   ------------------------------------------------------------
   The WCA records API keys national records by WCA country *id*
   ("Portugal", "USA"), not by ISO code, and continental records by
   continent id ("_Europe"). This table maps those ids to an ISO2
   code (for flags) and a display name, so the records view can
   build its region filter and render flags.

   Generated from the WCA's own static data:
   thewca/worldcubeassociation.org -> lib/static_data/countries.real.json
   Fields kept: id, iso2, continent, name.
   ============================================================ */
(function () {
    'use strict';

    // [id, iso2, continentId, name] — name omitted when identical to id.
    const CONTINENTS = [
        ['_Africa', 'Africa'],
        ['_Asia', 'Asia'],
        ['_Europe', 'Europe'],
        ['_North America', 'North America'],
        ['_Oceania', 'Oceania'],
        ['_South America', 'South America'],
    ];

    const COUNTRIES = [
        ['Afghanistan', 'AF', '_Asia'],
        ['Albania', 'AL', '_Europe'],
        ['Algeria', 'DZ', '_Africa'],
        ['Andorra', 'AD', '_Europe'],
        ['Angola', 'AO', '_Africa'],
        ['Antigua and Barbuda', 'AG', '_North America'],
        ['Argentina', 'AR', '_South America'],
        ['Armenia', 'AM', '_Europe'],
        ['Australia', 'AU', '_Oceania'],
        ['Austria', 'AT', '_Europe'],
        ['Azerbaijan', 'AZ', '_Europe'],
        ['Bahamas', 'BS', '_North America'],
        ['Bahrain', 'BH', '_Asia'],
        ['Bangladesh', 'BD', '_Asia'],
        ['Barbados', 'BB', '_North America'],
        ['Belarus', 'BY', '_Europe'],
        ['Belgium', 'BE', '_Europe'],
        ['Belize', 'BZ', '_North America'],
        ['Benin', 'BJ', '_Africa'],
        ['Bhutan', 'BT', '_Asia'],
        ['Bolivia', 'BO', '_South America'],
        ['Bosnia and Herzegovina', 'BA', '_Europe'],
        ['Botswana', 'BW', '_Africa'],
        ['Brazil', 'BR', '_South America'],
        ['Brunei', 'BN', '_Asia'],
        ['Bulgaria', 'BG', '_Europe'],
        ['Burkina Faso', 'BF', '_Africa'],
        ['Burundi', 'BI', '_Africa'],
        ['Cabo Verde', 'CV', '_Africa'],
        ['Cambodia', 'KH', '_Asia'],
        ['Cameroon', 'CM', '_Africa'],
        ['Canada', 'CA', '_North America'],
        ['Central African Republic', 'CF', '_Africa'],
        ['Chad', 'TD', '_Africa'],
        ['Chile', 'CL', '_South America'],
        ['China', 'CN', '_Asia'],
        ['Taiwan', 'TW', '_Asia', 'Chinese Taipei'],
        ['Colombia', 'CO', '_South America'],
        ['Comoros', 'KM', '_Africa'],
        ['Congo', 'CG', '_Africa'],
        ['Costa Rica', 'CR', '_North America'],
        ['Croatia', 'HR', '_Europe'],
        ['Cuba', 'CU', '_North America'],
        ['Cyprus', 'CY', '_Europe'],
        ['Czech Republic', 'CZ', '_Europe'],
        ['Cote d_Ivoire', 'CI', '_Africa', 'Côte d\'Ivoire'],
        ['Democratic People_s Republic of Korea', 'KP', '_Asia', 'Democratic People\'s Republic of Korea'],
        ['Democratic Republic of the Congo', 'CD', '_Africa'],
        ['Denmark', 'DK', '_Europe'],
        ['Djibouti', 'DJ', '_Africa'],
        ['Dominica', 'DM', '_North America'],
        ['Dominican Republic', 'DO', '_North America'],
        ['Ecuador', 'EC', '_South America'],
        ['Egypt', 'EG', '_Africa'],
        ['El Salvador', 'SV', '_North America'],
        ['Equatorial Guinea', 'GQ', '_Africa'],
        ['Eritrea', 'ER', '_Africa'],
        ['Estonia', 'EE', '_Europe'],
        ['Eswatini', 'SZ', '_Africa'],
        ['Ethiopia', 'ET', '_Africa'],
        ['Federated States of Micronesia', 'FM', '_Oceania'],
        ['Fiji', 'FJ', '_Oceania'],
        ['Finland', 'FI', '_Europe'],
        ['France', 'FR', '_Europe'],
        ['Gabon', 'GA', '_Africa'],
        ['Gambia', 'GM', '_Africa'],
        ['Georgia', 'GE', '_Europe'],
        ['Germany', 'DE', '_Europe'],
        ['Ghana', 'GH', '_Africa'],
        ['Greece', 'GR', '_Europe'],
        ['Grenada', 'GD', '_North America'],
        ['Guatemala', 'GT', '_North America'],
        ['Guinea', 'GN', '_Africa'],
        ['Guinea Bissau', 'GW', '_Africa'],
        ['Guyana', 'GY', '_South America'],
        ['Haiti', 'HT', '_North America'],
        ['Honduras', 'HN', '_North America'],
        ['Hong Kong', 'HK', '_Asia', 'Hong Kong, China'],
        ['Hungary', 'HU', '_Europe'],
        ['Iceland', 'IS', '_Europe'],
        ['India', 'IN', '_Asia'],
        ['Indonesia', 'ID', '_Asia'],
        ['Iran', 'IR', '_Asia'],
        ['Iraq', 'IQ', '_Asia'],
        ['Ireland', 'IE', '_Europe'],
        ['Israel', 'IL', '_Europe'],
        ['Italy', 'IT', '_Europe'],
        ['Jamaica', 'JM', '_North America'],
        ['Japan', 'JP', '_Asia'],
        ['Jordan', 'JO', '_Asia'],
        ['Kazakhstan', 'KZ', '_Asia'],
        ['Kenya', 'KE', '_Africa'],
        ['Kiribati', 'KI', '_Oceania'],
        ['Kosovo', 'XK', '_Europe'],
        ['Kuwait', 'KW', '_Asia'],
        ['Kyrgyzstan', 'KG', '_Asia'],
        ['Laos', 'LA', '_Asia'],
        ['Latvia', 'LV', '_Europe'],
        ['Lebanon', 'LB', '_Asia'],
        ['Lesotho', 'LS', '_Africa'],
        ['Liberia', 'LR', '_Africa'],
        ['Libya', 'LY', '_Africa'],
        ['Liechtenstein', 'LI', '_Europe'],
        ['Lithuania', 'LT', '_Europe'],
        ['Luxembourg', 'LU', '_Europe'],
        ['Macau', 'MO', '_Asia', 'Macau, China'],
        ['Madagascar', 'MG', '_Africa'],
        ['Malawi', 'MW', '_Africa'],
        ['Malaysia', 'MY', '_Asia'],
        ['Maldives', 'MV', '_Asia'],
        ['Mali', 'ML', '_Africa'],
        ['Malta', 'MT', '_Europe'],
        ['Marshall Islands', 'MH', '_Oceania'],
        ['Mauritania', 'MR', '_Africa'],
        ['Mauritius', 'MU', '_Africa'],
        ['Mexico', 'MX', '_North America'],
        ['Moldova', 'MD', '_Europe'],
        ['Monaco', 'MC', '_Europe'],
        ['Mongolia', 'MN', '_Asia'],
        ['Montenegro', 'ME', '_Europe'],
        ['Morocco', 'MA', '_Africa'],
        ['Mozambique', 'MZ', '_Africa'],
        ['Myanmar', 'MM', '_Asia'],
        ['Namibia', 'NA', '_Africa'],
        ['Nauru', 'NR', '_Oceania'],
        ['Nepal', 'NP', '_Asia'],
        ['Netherlands', 'NL', '_Europe'],
        ['New Zealand', 'NZ', '_Oceania'],
        ['Nicaragua', 'NI', '_North America'],
        ['Niger', 'NE', '_Africa'],
        ['Nigeria', 'NG', '_Africa'],
        ['North Macedonia', 'MK', '_Europe'],
        ['Norway', 'NO', '_Europe'],
        ['Oman', 'OM', '_Asia'],
        ['Pakistan', 'PK', '_Asia'],
        ['Palau', 'PW', '_Oceania'],
        ['Palestine', 'PS', '_Asia'],
        ['Panama', 'PA', '_North America'],
        ['Papua New Guinea', 'PG', '_Oceania'],
        ['Paraguay', 'PY', '_South America'],
        ['Peru', 'PE', '_South America'],
        ['Philippines', 'PH', '_Asia'],
        ['Poland', 'PL', '_Europe'],
        ['Portugal', 'PT', '_Europe'],
        ['Qatar', 'QA', '_Asia'],
        ['Korea', 'KR', '_Asia', 'Republic of Korea'],
        ['Romania', 'RO', '_Europe'],
        ['Russia', 'RU', '_Europe'],
        ['Rwanda', 'RW', '_Africa'],
        ['Saint Kitts and Nevis', 'KN', '_North America'],
        ['Saint Lucia', 'LC', '_North America'],
        ['Saint Vincent and the Grenadines', 'VC', '_North America'],
        ['Samoa', 'WS', '_Oceania'],
        ['San Marino', 'SM', '_Europe'],
        ['Saudi Arabia', 'SA', '_Asia'],
        ['Senegal', 'SN', '_Africa'],
        ['Serbia', 'RS', '_Europe'],
        ['Seychelles', 'SC', '_Africa'],
        ['Sierra Leone', 'SL', '_Africa'],
        ['Singapore', 'SG', '_Asia'],
        ['Slovakia', 'SK', '_Europe'],
        ['Slovenia', 'SI', '_Europe'],
        ['Solomon Islands', 'SB', '_Oceania'],
        ['Somalia', 'SO', '_Africa'],
        ['South Africa', 'ZA', '_Africa'],
        ['South Sudan', 'SS', '_Africa'],
        ['Spain', 'ES', '_Europe'],
        ['Sri Lanka', 'LK', '_Asia'],
        ['Sudan', 'SD', '_Africa'],
        ['Suriname', 'SR', '_South America'],
        ['Sweden', 'SE', '_Europe'],
        ['Switzerland', 'CH', '_Europe'],
        ['Syria', 'SY', '_Asia'],
        ['Sao Tome and Principe', 'ST', '_Africa', 'São Tomé and Príncipe'],
        ['Tajikistan', 'TJ', '_Asia'],
        ['Tanzania', 'TZ', '_Africa'],
        ['Thailand', 'TH', '_Asia'],
        ['Timor-Leste', 'TL', '_Asia'],
        ['Togo', 'TG', '_Africa'],
        ['Tonga', 'TO', '_Oceania'],
        ['Trinidad and Tobago', 'TT', '_North America'],
        ['Tunisia', 'TN', '_Africa'],
        ['Turkey', 'TR', '_Europe'],
        ['Turkmenistan', 'TM', '_Asia'],
        ['Tuvalu', 'TV', '_Oceania'],
        ['Uganda', 'UG', '_Africa'],
        ['Ukraine', 'UA', '_Europe'],
        ['United Arab Emirates', 'AE', '_Asia'],
        ['United Kingdom', 'GB', '_Europe'],
        ['USA', 'US', '_North America', 'United States'],
        ['Uruguay', 'UY', '_South America'],
        ['Uzbekistan', 'UZ', '_Asia'],
        ['Vanuatu', 'VU', '_Oceania'],
        ['Vatican City', 'VA', '_Europe'],
        ['Venezuela', 'VE', '_South America'],
        ['Vietnam', 'VN', '_Asia'],
        ['Yemen', 'YE', '_Asia'],
        ['Zambia', 'ZM', '_Africa'],
        ['Zimbabwe', 'ZW', '_Africa'],
    ];

    const continents = CONTINENTS.map(([id, name]) => ({ id, name }));
    const countries = COUNTRIES.map(([id, iso2, continent, name]) => ({
        id, iso2, continent, name: name || id,
    }));

    const byId = new Map(countries.map(c => [c.id, c]));
    const byIso2 = new Map(countries.map(c => [c.iso2, c]));
    const continentById = new Map(continents.map(c => [c.id, c]));

    window.WcaCountries = {
        continents,
        countries,
        /** WCA country id ("Portugal") -> { id, iso2, continent, name } */
        get: id => byId.get(id) || null,
        /** Continent id ("_Europe") -> { id, name } */
        continent: id => continentById.get(id) || null,
        /** Display name for any region id, including "world". */
        name: id => {
            if (!id || id === 'world') return 'World';
            return (byId.get(id) || continentById.get(id) || {}).name || id;
        },
        /** ISO2 for a country region id, or '' for world/continents. */
        iso2: id => (byId.get(id) || {}).iso2 || '',
        /**
         * Country name for an ISO2 code ("PT" -> "Portugal").
         *
         * The forward direction is what the records view needs; this is
         * for alt text, where a screen reader announcing "P T" instead of
         * "Portugal" is the difference between a flag that says something
         * and one that reads as noise.
         */
        nameForIso2: code => {
            const c = String(code || '').toUpperCase();
            return (byIso2.get(c) || {}).name || '';
        },
        /** ISO2 ("PT") -> { id, iso2, continent, name }, or null. */
        byIso2: code => byIso2.get(String(code || '').toUpperCase()) || null,
        /**
         * The file name a region's generated data is published under
         * (data/sor/<key>-single.json, data/records/<key>.json): "world",
         * a continent slug ("north-america") or a lower-case ISO2 ("pt").
         * Shared with scripts/build_wca_data.js so the generator and the
         * page cannot disagree on where a region lives.
         */
        fileKey: id => {
            if (!id || id === 'world') return 'world';
            if (id.startsWith('_')) return id.slice(1).toLowerCase().replace(/[^a-z0-9]+/g, '-');
            const c = byId.get(id);
            return c && c.iso2 ? c.iso2.toLowerCase() : '';
        },
    };
})();
