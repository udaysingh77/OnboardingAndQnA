-- ===================================================================
-- App_Language_Lookup - IPRS's real language reference table (confirmed against mraai_uat, 218
-- rows: the ISO 639-1 list plus a block of North-East Indian regional languages IPRS added
-- themselves - Nyishi, Adi, Khasi, Garo, Mizo, Nagamese and others that have no ISO 639-1 code).
--
-- WHY MIRRORED HERE (unlike App_Accounts, which never gets prod's actual member rows copied in):
-- this is static reference data, not member data - 218 languages, unlikely to change, and this
-- app needs it to resolve the "mother tongue" chat answer to IPRS's own LanguageId rather than
-- guessing one. See src/modules/registration/services/languageLookup.service.js.
--
-- Not in the original scripts/mra_cleaned.sql dump - discovered later while adding the mother
-- tongue question to the flow. App_Accounts.LanguageId is genuinely a foreign key into this table
-- in prod, even though this schema (imported from a dump of App_Accounts alone) can't express
-- that relationship without the table existing to point at.
--
-- Apply with:
--   sqlcmd -S tcp:localhost,1433 -U iprs_app -P iprs_app -C -d Dreamsoft_UAT -i scripts/add-language-lookup-table.sql
--
-- Then hand-add AppLanguageLookup to prisma/schema.prisma and run `npx prisma generate` ONLY.
-- Do NOT run `prisma db push` - see CLAUDE.md/AGENTS.md. This script is idempotent: the CREATE is
-- skipped if the table exists, and the data load is skipped if the table already has rows.
-- ===================================================================

SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO

IF NOT EXISTS (SELECT 1 FROM sys.tables WHERE name = 'App_Language_Lookup')
BEGIN
    CREATE TABLE dbo.App_Language_Lookup (
        LanguageId     BIGINT IDENTITY(1,1) NOT NULL
                       CONSTRAINT PK_App_Language_Lookup PRIMARY KEY,
        LanguageFamily NVARCHAR(200) NULL,
        LanguageName   NVARCHAR(200) NULL,
        NativeName     NVARCHAR(100) NULL,
        LanguageCode   NVARCHAR(100) NULL,
        LanguageDesc   NVARCHAR(MAX) NULL
    );
    PRINT 'Created App_Language_Lookup';
END
ELSE
    PRINT 'App_Language_Lookup already exists, skipping';
GO

-- Data load, skipped if already populated (re-running this script after the first apply is safe).
IF NOT EXISTS (SELECT 1 FROM dbo.App_Language_Lookup)
BEGIN
    SET IDENTITY_INSERT dbo.App_Language_Lookup ON;

    INSERT INTO dbo.App_Language_Lookup (LanguageId, LanguageFamily, LanguageName, NativeName, LanguageCode, LanguageDesc)
    VALUES
      (1, N'Northwest Caucasian', N'Abkhazian', N'аҧсуа бызшәа, аҧсшәа', N'ab', N'also known as Abkhaz'),
      (2, N'Afro-Asiatic', N'Afar', N'Afaraf', N'aa', N''),
      (3, N'Indo-European', N'Afrikaans', N'Afrikaans', N'af', N''),
      (4, N'Niger–Congo', N'Akan', N'Akan', N'ak', N'macrolanguage, Twi is tw/twi, Fanti is fat'),
      (5, N'Indo-European', N'Albanian', N'Shqip', N'sq', N'macrolanguage, called "Albanian Phylozone" in 639-6'),
      (6, N'Afro-Asiatic', N'Amharic', N'አማርኛ', N'am', N''),
      (7, N'Afro-Asiatic', N'Arabic', N'العربية', N'ar', N'macrolanguage, Standard Arabic is arb'),
      (8, N'Indo-European', N'Aragonese', N'aragonés', N'an', N''),
      (9, N'Indo-European', N'Armenian', N'Հայերեն', N'hy', N'ISO 639-3 code hye is for Eastern Armenian, hyw is for Western Armenian, and xcl is for Classical Armenian'),
      (10, N'Indo-European', N'Assamese', N'অসমীয়া', N'as', N''),
      (11, N'Northeast Caucasian', N'Avaric', N'авар мацӀ, магӀарул мацӀ', N'av', N'also known as Avar'),
      (12, N'Indo-European', N'Avestan', N'avesta', N'ae', N'ancient'),
      (13, N'Aymaran', N'Aymara', N'aymar aru', N'ay', N'macrolanguage'),
      (14, N'Turkic', N'Azerbaijani', N'azərbaycan dili, تۆرکجه', N'az', N'macrolanguage also known as Azeri,'),
      (15, N'Niger–Congo', N'Bambara', N'bamanankan', N'bm', N''),
      (16, N'Turkic', N'Bashkir', N'башҡорт теле', N'ba', N''),
      (17, N'Language isolate', N'Basque', N'euskara, euskera', N'eu', N''),
      (18, N'Indo-European', N'Belarusian', N'беларуская мова', N'be', N''),
      (19, N'Indo-European', N'Bengali', N'বাংলা', N'bn', N'also known as Bangla'),
      (20, N'Creole', N'Bislama', N'Bislama', N'bi', N'Language formed from English and Vanuatuan languages, with some French influence.'),
      (21, N'Indo-European', N'Bosnian', N'bosanski jezik', N'bs', N''),
      (22, N'Indo-European', N'Breton', N'brezhoneg', N'br', N''),
      (23, N'Indo-European', N'Bulgarian', N'български език', N'bg', N''),
      (24, N'Sino-Tibetan', N'Burmese', N'ဗမာစာ', N'my', N'also known as Myanmar'),
      (25, N'Indo-European', N'Catalan, Valencian', N'català, valencià', N'ca', N''),
      (26, N'Austronesian', N'Chamorro', N'Chamoru', N'ch', N''),
      (27, N'Northeast Caucasian', N'Chechen', N'нохчийн мотт', N'ce', N''),
      (28, N'Niger–Congo', N'Chichewa, Chewa, Nyanja', N'chiCheŵa, chinyanja', N'ny', N''),
      (29, N'Sino-Tibetan', N'Chinese', N'中文 (Zhōngwén), 汉语, 漢語', N'zh', N'macrolanguage'),
      (30, N'Turkic', N'Chuvash', N'чӑваш чӗлхи', N'cv', N''),
      (31, N'Indo-European', N'Cornish', N'Kernewek', N'kw', N''),
      (32, N'Indo-European', N'Corsican', N'corsu, lingua corsa', N'co', N''),
      (33, N'Algonquian', N'Cree', N'ᓀᐦᐃᔭᐍᐏᐣ', N'cr', N'macrolanguage'),
      (34, N'Indo-European', N'Croatian', N'hrvatski jezik', N'hr', N''),
      (35, N'Indo-European', N'Czech', N'čeština, český jazyk', N'cs', N''),
      (36, N'Indo-European', N'Danish', N'dansk', N'da', N''),
      (37, N'Indo-European', N'Divehi, Dhivehi, Maldivian', N'ދިވެހި', N'dv', N''),
      (38, N'Indo-European', N'Dutch, Flemish', N'Nederlands, Vlaams', N'nl', N'Flemish is not to be confused with the closely related West Flemish which is referred to as Vlaams (Dutch for "Flemish") in ISO 639-3 and has the ISO 639-3 code vls'),
      (39, N'Sino-Tibetan', N'Dzongkha', N'རྫོང་ཁ', N'dz', N''),
      (40, N'Indo-European', N'English', N'English', N'en', N''),
      (41, N'Constructed', N'Esperanto', N'Esperanto', N'eo', N'constructed, initially by L.L. Zamenhof in 1887'),
      (42, N'Uralic', N'Estonian', N'eesti, eesti keel', N'et', N'macrolanguage'),
      (43, N'Niger–Congo', N'Ewe', N'Eʋegbe', N'ee', N''),
      (44, N'Indo-European', N'Faroese', N'føroyskt', N'fo', N''),
      (45, N'Austronesian', N'Fijian', N'vosa Vakaviti', N'fj', N''),
      (46, N'Uralic', N'Finnish', N'suomi, suomen kieli', N'fi', N''),
      (47, N'Indo-European', N'French', N'français', N'fr', N''),
      (48, N'Niger–Congo', N'Fulah', N'Fulfulde, Pulaar, Pular', N'ff', N'macrolanguage, also known as Fula'),
      (49, N'Indo-European', N'Galician', N'Galego', N'gl', N''),
      (50, N'Kartvelian', N'Georgian', N'ქართული', N'ka', N''),
      (51, N'Indo-European', N'German', N'Deutsch', N'de', N''),
      (52, N'Indo-European', N'Greek, Modern (1453–)', N'ελληνικά', N'el', N'for Ancient Greek, use the ISO 639-3 code grc'),
      (53, N'Tupian', N'Guarani', N'Avañe''ẽ', N'gn', N'macrolanguage'),
      (54, N'Indo-European', N'Gujarati', N'ગુજરાતી', N'gu', N''),
      (55, N'Creole', N'Haitian, Haitian Creole', N'Kreyòl ayisyen', N'ht', N''),
      (56, N'Afro-Asiatic', N'Hausa', N'(Hausa) هَوُسَ', N'ha', N''),
      (57, N'Afro-Asiatic', N'Hebrew', N'עברית', N'he', N'Modern Hebrew. Code changed in 1989 from original ISO 639:1988, iw.[1]'),
      (58, N'Niger–Congo', N'Herero', N'Otjiherero', N'hz', N''),
      (59, N'Indo-European', N'Hindi', N'हिन्दी, हिंदी', N'hi', N''),
      (60, N'Austronesian', N'Hiri Motu', N'Hiri Motu', N'ho', N''),
      (61, N'Uralic', N'Hungarian', N'magyar', N'hu', N''),
      (62, N'Constructed', N'Interlingua (International Auxiliary Language Association)', N'Interlingua', N'ia', N'constructed by the International Auxiliary Language Association'),
      (63, N'Austronesian', N'Indonesian', N'Bahasa Indonesia', N'id', N'covered by macrolanguage ms/msa. Changed in 1989 from original ISO 639:1988, in.[1]'),
      (64, N'Constructed', N'Interlingue, Occidental', N'(originally:) Occidental, (after WWII:) Interlingue', N'ie', N'constructed by Edgar de Wahl, first published in 1922'),
      (65, N'Indo-European', N'Irish', N'Gaeilge', N'ga', N''),
      (66, N'Niger–Congo', N'Igbo', N'Asụsụ Igbo', N'ig', N''),
      (67, N'Eskimo–Aleut', N'Inupiaq', N'Iñupiaq, Iñupiatun', N'ik', N'macrolanguage'),
      (68, N'Constructed', N'Ido', N'Ido', N'io', N'constructed by De Beaufront, 1907, as variation of Esperanto'),
      (69, N'Indo-European', N'Icelandic', N'Íslenska', N'is', N''),
      (70, N'Indo-European', N'Italian', N'Italiano', N'it', N''),
      (71, N'Eskimo–Aleut', N'Inuktitut', N'ᐃᓄᒃᑎᑐᑦ', N'iu', N'macrolanguage'),
      (72, N'Japonic', N'Japanese', N'日本語 (にほんご)', N'ja', N''),
      (73, N'Austronesian', N'Javanese', N'ꦧꦱꦗꦮ, Basa Jawa', N'jv', N''),
      (74, N'Eskimo–Aleut', N'Kalaallisut, Greenlandic', N'kalaallisut, kalaallit oqaasii', N'kl', N''),
      (75, N'Dravidian', N'Kannada', N'ಕನ್ನಡ', N'kn', N''),
      (76, N'Nilo-Saharan', N'Kanuri', N'Kanuri', N'kr', N'macrolanguage'),
      (77, N'Indo-European', N'Kashmiri', N'कॉशुर, کٲشُر‎', N'ks', N''),
      (78, N'Turkic', N'Kazakh', N'қазақ тілі', N'kk', N''),
      (79, N'Austroasiatic', N'Central Khmer', N'ខ្មែរ, ខេមរភាសា, ភាសាខ្មែរ', N'km', N'also known as Khmer or Cambodian'),
      (80, N'Niger–Congo', N'Kikuyu, Gikuyu', N'Gĩkũyũ', N'ki', N''),
      (81, N'Niger–Congo', N'Kinyarwanda', N'Ikinyarwanda', N'rw', N''),
      (82, N'Turkic', N'Kirghiz, Kyrgyz', N'Кыргызча, Кыргыз тили', N'ky', N''),
      (83, N'Uralic', N'Komi', N'коми кыв', N'kv', N'macrolanguage'),
      (84, N'Niger–Congo', N'Kongo', N'Kikongo', N'kg', N'macrolanguage'),
      (85, N'Koreanic', N'Korean', N'한국어', N'ko', N''),
      (86, N'Indo-European', N'Kurdish', N'Kurdî, کوردی‎', N'ku', N'macrolanguage'),
      (87, N'Niger–Congo', N'Kuanyama, Kwanyama', N'Kuanyama', N'kj', N''),
      (88, N'Indo-European', N'Latin', N'latine, lingua latina', N'la', N'ancient'),
      (89, N'Indo-European', N'Luxembourgish, Letzeburgesch', N'Lëtzebuergesch', N'lb', N''),
      (90, N'Niger–Congo', N'Ganda', N'Luganda', N'lg', N''),
      (91, N'Indo-European', N'Limburgan, Limburger, Limburgish', N'Limburgs', N'li', N''),
      (92, N'Niger–Congo', N'Lingala', N'Lingála', N'ln', N''),
      (93, N'Tai–Kadai', N'Lao', N'ພາສາລາວ', N'lo', N''),
      (94, N'Indo-European', N'Lithuanian', N'lietuvių kalba', N'lt', N''),
      (95, N'Niger–Congo', N'Luba-Katanga', N'Kiluba', N'lu', N'also known as Luba-Shaba'),
      (96, N'Indo-European', N'Latvian', N'latviešu valoda', N'lv', N'macrolanguage'),
      (97, N'Indo-European', N'Manx', N'Gaelg, Gailck', N'gv', N''),
      (98, N'Indo-European', N'Macedonian', N'македонски јазик', N'mk', N''),
      (99, N'Austronesian', N'Malagasy', N'fiteny malagasy', N'mg', N'macrolanguage'),
      (100, N'Austronesian', N'Malay', N'Bahasa Melayu, بهاس ملايو‎', N'ms', N'macrolanguage, Standard Malay is zsm, Indonesian is id/ind'),
      (101, N'Dravidian', N'Malayalam', N'മലയാളം', N'ml', N''),
      (102, N'Afro-Asiatic', N'Maltese', N'Malti', N'mt', N''),
      (103, N'Austronesian', N'Maori', N'te reo Māori', N'mi', N'also known as Māori'),
      (104, N'Indo-European', N'Marathi', N'मराठी', N'mr', N'also known as Marāṭhī'),
      (105, N'Austronesian', N'Marshallese', N'Kajin M̧ajeļ', N'mh', N''),
      (106, N'Mongolic', N'Mongolian', N'Монгол хэл', N'mn', N'macrolanguage'),
      (107, N'Austronesian', N'Nauru', N'Dorerin Naoero', N'na', N'also known as Nauruan'),
      (108, N'Dené–Yeniseian', N'Navajo, Navaho', N'Diné bizaad', N'nv', N''),
      (109, N'Niger–Congo', N'North Ndebele', N'isiNdebele', N'nd', N'also known as Northern Ndebele'),
      (110, N'Indo-European', N'Nepali', N'नेपाली', N'ne', N'macrolanguage'),
      (111, N'Niger–Congo', N'Ndonga', N'Owambo', N'ng', N''),
      (112, N'Indo-European', N'Norwegian Bokmål', N'Norsk Bokmål', N'nb', N'covered by macrolanguage no/nor'),
      (113, N'Indo-European', N'Norwegian Nynorsk', N'Norsk Nynorsk', N'nn', N'covered by macrolanguage no/nor'),
      (114, N'Indo-European', N'Norwegian', N'Norsk', N'no', N'macrolanguage, Bokmål is nb/nob, Nynorsk is nn/nno'),
      (115, N'Sino-Tibetan', N'Sichuan Yi, Nuosu', N'ꆈꌠ꒿ Nuosuhxop', N'ii', N'standard form of the Yi languages'),
      (116, N'Niger–Congo', N'South Ndebele', N'isiNdebele', N'nr', N'also known as Southern Ndebele'),
      (117, N'Indo-European', N'Occitan', N'occitan, lenga d''òc', N'oc', N''),
      (118, N'Algonquian', N'Ojibwa', N'ᐊᓂᔑᓈᐯᒧᐎᓐ', N'oj', N'macrolanguage, also known as Ojibwe'),
      (119, N'Indo-European', N'Church Slavic, Old Slavonic, Church Slavonic, Old Bulgarian, Old Church Slavonic', N'ѩзыкъ словѣньскъ', N'cu', N'ancient, in use by the Eastern Orthodox Church'),
      (120, N'Afro-Asiatic', N'Oromo', N'Afaan Oromoo', N'om', N'macrolanguage'),
      (121, N'Indo-European', N'Oriya', N'ଓଡ଼ିଆ', N'or', N'macrolanguage, also known as Odia'),
      (122, N'Indo-European', N'Ossetian, Ossetic', N'ирон ӕвзаг', N'os', N''),
      (123, N'Indo-European', N'Punjabi, Panjabi', N'ਪੰਜਾਬੀ, پنجابی‎', N'pa', N''),
      (124, N'Indo-European', N'Pali', N'पालि, पाळि', N'pi', N'ancient, also known as Pāli'),
      (125, N'Indo-European', N'Persian', N'فارسی', N'fa', N'macrolanguage, also known as Farsi'),
      (126, N'Indo-European', N'Polish', N'język polski, polszczyzna', N'pl', N''),
      (127, N'Indo-European', N'Pashto, Pushto', N'پښتو', N'ps', N'macrolanguage'),
      (128, N'Indo-European', N'Portuguese', N'Português', N'pt', N''),
      (129, N'Quechuan', N'Quechua', N'Runa Simi, Kichwa', N'qu', N'macrolanguage'),
      (130, N'Indo-European', N'Romansh', N'Rumantsch Grischun', N'rm', N''),
      (131, N'Niger–Congo', N'Rundi', N'Ikirundi', N'rn', N'also known as Kirundi'),
      (132, N'Indo-European', N'Romanian, Moldavian, Moldovan', N'Română, Moldovenească', N'ro', N'the identifiers mo and mol for Moldavian are deprecated. They will not be assigned to different items, and recordings using these identifiers will not be invalid.'),
      (133, N'Indo-European', N'Russian', N'русский', N'ru', N''),
      (134, N'Indo-European', N'Sanskrit', N'संस्कृतम्, 𑌸𑌂𑌸𑍍𑌕𑍃𑌤𑌮𑍍', N'sa', N'ancient'),
      (135, N'Indo-European', N'Sardinian', N'sardu', N'sc', N'macrolanguage'),
      (136, N'Indo-European', N'Sindhi', N'सिंधी, سنڌي‎', N'sd', N''),
      (137, N'Uralic', N'Northern Sami', N'Davvisámegiella', N'se', N''),
      (138, N'Austronesian', N'Samoan', N'gagana fa''a Samoa', N'sm', N''),
      (139, N'Creole', N'Sango', N'yângâ tî sängö', N'sg', N''),
      (140, N'Indo-European', N'Serbian', N'српски језик', N'sr', N'the ISO 639-2/T code srp deprecated the ISO 639-2/B code scc[2]'),
      (141, N'Indo-European', N'Gaelic, Scottish Gaelic', N'Gàidhlig', N'gd', N''),
      (142, N'Niger–Congo', N'Shona', N'chiShona', N'sn', N''),
      (143, N'Indo-European', N'Sinhala, Sinhalese', N'සිංහල', N'si', N''),
      (144, N'Indo-European', N'Slovak', N'Slovenčina, Slovenský jazyk', N'sk', N''),
      (145, N'Indo-European', N'Slovenian', N'Slovenski jezik, Slovenščina', N'sl', N'also known as Slovene'),
      (146, N'Afro-Asiatic', N'Somali', N'Soomaaliga, af Soomaali', N'so', N''),
      (147, N'Niger–Congo', N'Southern Sotho', N'Sesotho', N'st', N''),
      (148, N'Indo-European', N'Spanish, Castilian', N'Español', N'es', N''),
      (149, N'Austronesian', N'Sundanese', N'Basa Sunda', N'su', N''),
      (150, N'Niger–Congo', N'Swahili', N'Kiswahili', N'sw', N'macrolanguage'),
      (151, N'Niger–Congo', N'Swati', N'SiSwati', N'ss', N'also known as Swazi'),
      (152, N'Indo-European', N'Swedish', N'Svenska', N'sv', N''),
      (153, N'Dravidian', N'Tamil', N'தமிழ்', N'ta', N''),
      (154, N'Dravidian', N'Telugu', N'తెలుగు', N'te', N''),
      (155, N'Indo-European', N'Tajik', N'тоҷикӣ, toçikī, تاجیکی‎', N'tg', N''),
      (156, N'Tai–Kadai', N'Thai', N'ไทย', N'th', N''),
      (157, N'Afro-Asiatic', N'Tigrinya', N'ትግርኛ', N'ti', N''),
      (158, N'Sino-Tibetan', N'Tibetan', N'བོད་ཡིག', N'bo', N'also known as Standard Tibetan'),
      (159, N'Turkic', N'Turkmen', N'Türkmençe, Türkmen dili', N'tk', N''),
      (160, N'Austronesian', N'Tagalog', N'Wikang Tagalog', N'tl', N'note: Filipino (Pilipino) has the code fil'),
      (161, N'Niger–Congo', N'Tswana', N'Setswana', N'tn', N''),
      (162, N'Austronesian', N'Tonga (Tonga Islands)', N'Faka Tonga', N'to', N'also known as Tongan'),
      (163, N'Turkic', N'Turkish', N'Türkçe', N'tr', N''),
      (164, N'Niger–Congo', N'Tsonga', N'Xitsonga', N'ts', N''),
      (165, N'Turkic', N'Tatar', N'татар теле, tatar tele', N'tt', N''),
      (166, N'Niger–Congo', N'Twi', N'Twi', N'tw', N'covered by macrolanguage ak/aka'),
      (167, N'Austronesian', N'Tahitian', N'Reo Tahiti', N'ty', N'one of the Reo Mā`ohi (languages of French Polynesia)[3]'),
      (168, N'Turkic', N'Uighur, Uyghur', N'ئۇيغۇرچە‎, Uyghurche', N'ug', N''),
      (169, N'Indo-European', N'Ukrainian', N'Українська', N'uk', N''),
      (170, N'Indo-European', N'Urdu', N'اردو', N'ur', N''),
      (171, N'Turkic', N'Uzbek', N'Oʻzbek, Ўзбек, أۇزبېك‎', N'uz', N'macrolanguage'),
      (172, N'Niger–Congo', N'Venda', N'Tshivenḓa', N've', N''),
      (173, N'Austroasiatic', N'Vietnamese', N'Tiếng Việt', N'vi', N''),
      (174, N'Constructed', N'Volapük', N'Volapük', N'vo', N'constructed'),
      (175, N'Indo-European', N'Walloon', N'Walon', N'wa', N''),
      (176, N'Indo-European', N'Welsh', N'Cymraeg', N'cy', N''),
      (177, N'Niger–Congo', N'Wolof', N'Wollof', N'wo', N''),
      (178, N'Indo-European', N'Western Frisian', N'Frysk', N'fy', N'also known as Frisian'),
      (179, N'Niger–Congo', N'Xhosa', N'isiXhosa', N'xh', N''),
      (180, N'Indo-European', N'Yiddish', N'ייִדיש', N'yi', N'macrolanguage. Changed in 1989 from original ISO 639:1988, ji.[1]'),
      (181, N'Niger–Congo', N'Yoruba', N'Yorùbá', N'yo', N''),
      (182, N'Tai–Kadai', N'Zhuang, Chuang', N'Saɯ cueŋƅ, Saw cuengh', N'za', N'macrolanguage'),
      (183, N'Niger–Congo', N'Zulu', N'isiZulu', N'zu', N''),
      (184, N'Indo-European', N'Nyishi', N'Nyishi', N'apn', NULL),
      (185, N'Indo-European', N'Adi', N'Adi', N'apa', NULL),
      (186, N'Indo-European', N'Apatani', N'Apatani', N'apap', NULL),
      (187, N'Indo-European', N'Monpa', N'Monpa', N'apm', NULL),
      (188, N'Indo-European', N'Tagin', N'Tagin', N'apt', NULL),
      (189, N'Indo-European', N'Galo', N'Galo', N'apg', NULL),
      (190, N'Indo-European', N'Mishmi', N'Mishmi', N'apmi', NULL),
      (191, N'Indo-European', N'Nocte', N'Nocte', N'apno', NULL),
      (192, N'Indo-European', N'Wancho', N'Wancho', N'apw', NULL),
      (193, N'Indo-European', N'Manipuri (Meitei)', N'Manipuri (Meitei)', N'mme', NULL),
      (194, N'Indo-European', N'Tangkhul', N'Tangkhul', N'mnt', NULL),
      (195, N'Indo-European', N'Hmar', N'Hmar', N'mnh', NULL),
      (196, N'Indo-European', N'Thadou', N'Thadou', N'mnth', NULL),
      (197, N'Indo-European', N'Kabui (Rongmei)', N'Kabui (Rongmei)', N'mnkr', NULL),
      (198, N'Indo-European', N'Khasi', N'Khasi', N'mgk', NULL),
      (199, N'Indo-European', N'Garo', N'Garo', N'mgg', NULL),
      (200, N'Indo-European', N'Jaintia (Pnar)', N'Jaintia (Pnar)', N'mgjp', NULL),
      (201, N'Indo-European', N'Mizo (Lushai)', N'Mizo (Lushai)', N'mzm', NULL),
      (202, N'Indo-European', N'Hmar(Mizoram)', N'Hmar(Mizoram)', N'mzh', NULL),
      (203, N'Indo-European', N'Mara', N'Mara', N'mzma', NULL),
      (204, N'Indo-European', N'Paite', N'Paite', N'mzp', NULL),
      (205, N'Indo-European', N'Nagamese', N'Nagamese', N'ngn', NULL),
      (206, N'Indo-European', N'Angami', N'Angami', N'nga', NULL),
      (207, N'Indo-European', N'Sumi', N'Sumi', N'ngs', NULL),
      (208, N'Indo-European', N'Lotha', N'Lotha', N'ngl', NULL),
      (209, N'Indo-European', N'Chakhesang', N'Chakhesang', N'ngc', NULL),
      (210, N'Indo-European', N'Konyak', N'Konyak', N'ngk', NULL),
      (211, N'Indo-European', N'Chang', N'Chang', N'ngc', NULL),
      (212, N'Indo-European', N'Tenyidie', N'Tenyidie', N'ngt', NULL),
      (213, N'Indo-European', N'Kokborok', N'Kokborok', N'tpk', NULL),
      (214, N'Indo-European', N'Bengali(Tripura)', N'Bengali(Tripura)', N'tpb', NULL),
      (215, N'Indo-European', N'Reang', N'Reang', N'tpr', NULL),
      (216, N'Indo-European', N'Chakma', N'Chakma', N'tpc', NULL),
      (217, N'Indo-European', N'Halam', N'Halam', N'tph', NULL),
      (218, N'Indo-European', N'Mog', N'Mog', N'tpm', NULL);

    SET IDENTITY_INSERT dbo.App_Language_Lookup OFF;
    PRINT 'Loaded 218 rows into App_Language_Lookup';
END
ELSE
    PRINT 'App_Language_Lookup already has data, skipping load';
GO

-- Every lookup is "find this language by its name". Case-insensitive by default under SQL Server's
-- standard collation, which is what the free-text chat answer needs.
IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = 'IX_App_Language_Lookup_LanguageName'
      AND object_id = OBJECT_ID('dbo.App_Language_Lookup')
)
BEGIN
    CREATE INDEX IX_App_Language_Lookup_LanguageName ON dbo.App_Language_Lookup (LanguageName);
    PRINT 'Created IX_App_Language_Lookup_LanguageName';
END
ELSE
    PRINT 'IX_App_Language_Lookup_LanguageName already exists, skipping';
GO
