/*
  Editorial refinements for short public UI strings created by the 2026-08-21
  translation backfill. These entity types had no SQ rows before that run.
  Source-value guards ensure the correction applies to the intended English copy.
*/
SET XACT_ABORT ON;
BEGIN TRANSACTION;

DECLARE @R TABLE(EntityType nvarchar(50), Label nvarchar(200), Field nvarchar(200), Source nvarchar(max), Target nvarchar(max));

INSERT @R VALUES
(N'PageContent',N'about/intro',N'content.eyebrow',N'About PITF',N'Rreth PITF'),
(N'PageContent',N'about/intro',N'content.title',N'A Stage for Dialogue — A Festival for Everyone',N'Një skenë për dialog — një festival për të gjithë'),
(N'PageContent',N'about/intro',N'content.paragraphs[0]',N'The Prishtina International Theatre Festival ‘Burbuqe Berisha’ (PITF) is Kosovo''s leading theatre festival and one of the most important cultural events in the region.',N'Prishtina International Theatre Festival ‘Burbuqe Berisha’ (PITF) është festivali kryesor i teatrit në Kosovë dhe një nga ngjarjet më të rëndësishme kulturore në rajon.'),
(N'PageContent',N'about/intro',N'content.paragraphs[1]',N'Since its establishment, PITF has been dedicated to promoting contemporary theatre, encouraging artistic freedom, and building connections between artists and audiences from around the world.',N'Që nga themelimi, PITF i është përkushtuar promovimit të teatrit bashkëkohor, nxitjes së lirisë artistike dhe krijimit të lidhjeve mes artistëve dhe publikut nga e gjithë bota.'),
(N'PageContent',N'about/mission',N'content.title',N'Theatre as a space for Change',N'Teatri si hapësirë për ndryshim'),
(N'PageContent',N'about/mission',N'content.text',N'We believe in theatre as a space for dialogue, reflection and change. PITF brings compelling stories to life, inspires new perspectives and creates a meeting point for cultures.',N'Ne besojmë në teatrin si hapësirë për dialog, reflektim dhe ndryshim. PITF sjell në jetë histori të fuqishme, frymëzon këndvështrime të reja dhe krijon një pikëtakim mes kulturave.'),
(N'PageContent',N'about/statistics',N'content.items[0].label',N'Editions',N'Edicione'),
(N'PageContent',N'about/statistics',N'content.items[0].text',N'A decade of theatre and cultural exchange.',N'Një dekadë teatër dhe shkëmbim kulturor.'),
(N'PageContent',N'about/statistics',N'content.items[1].label',N'Countries',N'Vende'),
(N'PageContent',N'about/statistics',N'content.items[1].text',N'Artists and companies from around the world.',N'Artistë dhe kompani nga e gjithë bota.'),
(N'PageContent',N'about/statistics',N'content.items[2].label',N'Performances',N'Shfaqje'),
(N'PageContent',N'about/statistics',N'content.items[2].text',N'Across main stage, off programs and special events.',N'Në skenën kryesore, programet shoqëruese dhe ngjarjet e veçanta.'),
(N'PageContent',N'about/statistics',N'content.items[3].label',N'Audience members',N'Shikues'),
(N'PageContent',N'about/statistics',N'content.items[3].text',N'Uniting audiences through the power of live performance.',N'Duke bashkuar publikun përmes fuqisë së shfaqjes së drejtpërdrejtë.'),
(N'PageContent',N'about/team',N'content.intro',N'Behind every edition is a passionate team that works year-round to bring the best of contemporary theatre to Prishtina.',N'Pas çdo edicioni qëndron një ekip i përkushtuar që punon gjatë gjithë vitit për të sjellë në Prishtinë më të mirën e teatrit bashkëkohor.'),
(N'PageContent',N'about/team',N'content.people[1].role',N'Festival Director',N'Drejtor i Festivalit'),
(N'PageContent',N'about/team',N'content.people[2].role',N'Art Image Director',N'Drejtor i Art Image'),
(N'PageContent',N'about/team',N'content.people[3].role',N'Artistic Director of PITF',N'Drejtoreshë Artistike e PITF'),
(N'PageContent',N'about/team',N'content.people[4].role',N'AAB Theatre ‘Faruk Begolli’ Organizer',N'Organizator i Teatrit AAB ‘Faruk Begolli’'),
(N'PageContent',N'about/team',N'content.people[5].role',N'PR & Communication Director',N'Drejtoreshë e PR-it dhe Komunikimit'),
(N'PageContent',N'contact/main',N'content.title',N'Contact',N'Kontakt'),
(N'PageContent',N'editions/hero',N'content.kicker',N'10 Editions',N'10 Edicione'),
(N'PageContent',N'editions/hero',N'content.title',N'One Evolving Stage',N'Një skenë në zhvillim'),
(N'PageContent',N'editions/hero',N'content.text',N'From its first edition in 2017 to its tenth anniversary in 2026, PITF has brought together artists, audiences and stories from across borders.',N'Nga edicioni i parë më 2017 deri te përvjetori i dhjetë më 2026, PITF ka bashkuar artistë, publik dhe histori përtej kufijve.'),
(N'PageContent',N'global/newsletter',N'content.kicker',N'Join the journey',N'Bashkohu me rrugëtimin'),
(N'PageContent',N'global/newsletter',N'content.title',N'Be Part of The Theatre',N'Bëhu pjesë e teatrit'),
(N'PageContent',N'global/newsletter',N'content.text',N'Stay updated with the latest news, programs and announcements.',N'Qëndro i informuar me lajmet, programet dhe njoftimet më të fundit.'),
(N'PageContent',N'home/about',N'content.kicker',N'About PITF',N'Rreth PITF'),
(N'PageContent',N'home/about',N'content.title',N'A stage for dialogue. A festival for everyone.',N'Një skenë për dialog. Një festival për të gjithë.'),
(N'PageContent',N'home/about',N'content.paragraphs[0]',N'The International Theater Festival ‘Prishtina International Theater Festival’ was established in the premises of AAB Theater ‘Faruk Begolli’ in June 2017. This theater operates within the AAB College in Pristina.',N'Festivali Ndërkombëtar i Teatrit ‘Prishtina International Theater Festival’ u themelua në hapësirat e Teatrit AAB ‘Faruk Begolli’ në qershor 2017. Ky teatër vepron në kuadër të Kolegjit AAB në Prishtinë.'),
(N'PageContent',N'home/about',N'content.paragraphs[1]',N'The first edition of this festival was held with the motto: ‘Don’t ask what your country can do for you — ask what you can do for your country…’ We are aiming to make this festival a traditional and original event.',N'Edicioni i parë i këtij festivali u mbajt me moton: ‘Mos pyet çfarë mund të bëjë vendi yt për ty — pyet çfarë mund të bësh ti për vendin tënd…’ Synojmë që ky festival të bëhet një ngjarje tradicionale dhe origjinale.'),
(N'PageContent',N'home/hero',N'content.titleParts[0]',N'Prishtina',N'Prishtina'),
(N'PageContent',N'home/hero',N'content.titleParts[1]',N'International',N'Ndërkombëtar'),
(N'PageContent',N'home/hero',N'content.titleParts[2]',N'Theatre Festival',N'Festivali i Teatrit'),
(N'PageContent',N'home/hero',N'content.description',N'A meeting place for diverse voices, captivating performances, workshops and dialogue.',N'Një vendtakim për zëra të ndryshëm, shfaqje mbresëlënëse, punëtori dhe dialog.'),
(N'PageContent',N'home/latest-edition',N'content.title',N'Edition of PITF',N'Edicioni i PITF'),
(N'PageContent',N'home/latest-edition',N'content.text',N'The Prishtina International Theatre Festival celebrates its 10th edition in 2026, honouring a decade of bold stories, fearless artists, and deep connections across borders.',N'Prishtina International Theatre Festival feston edicionin e tij të 10-të në vitin 2026, duke nderuar një dekadë historish të guximshme, artistësh të patrembur dhe lidhjesh të thella përtej kufijve.'),
(N'PageContent',N'news/hero',N'content.text',N'Festival stories, announcements and highlights from every PITF edition.',N'Histori nga festivali, njoftime dhe momente të veçanta nga çdo edicion i PITF.'),
(N'HomepageSection',N'editions',N'configuration.title',N'All PITF Editions',N'Të gjitha edicionet e PITF'),
(N'HomepageSection',N'featured-program',N'configuration.linkText',N'View full program',N'Shiko programin e plotë'),
(N'HomepageSection',N'sponsors',N'configuration.kicker',N'Sponsors',N'Sponsorët'),
(N'HomepageSection',N'sponsors',N'configuration.text',N'PITF is organized by passionate individuals and institutions committed to the development and promotion of contemporary theatre in Kosovo and beyond.',N'PITF organizohet nga individë të përkushtuar dhe institucione të angazhuara në zhvillimin dhe promovimin e teatrit bashkëkohor në Kosovo dhe më gjerë.'),
(N'HomepageSection',N'sponsors',N'configuration.title',N'Together for the art',N'Së bashku për artin'),
(N'NavigationItem',N'about',N'label',N'About',N'Rreth nesh'),
(N'NavigationItem',N'contact',N'label',N'Contact',N'Kontakt'),
(N'NavigationItem',N'editions',N'label',N'Editions',N'Edicionet'),
(N'NavigationItem',N'home',N'label',N'Home',N'Ballina'),
(N'NavigationItem',N'news',N'label',N'News',N'Lajme'),
(N'Edition',N'edition-1',N'title',N'1st Edition',N'Edicioni i parë'),
(N'Edition',N'edition-2',N'title',N'2nd Edition',N'Edicioni i dytë'),
(N'Edition',N'edition-3',N'title',N'3rd Edition',N'Edicioni i tretë'),
(N'Edition',N'edition-4',N'title',N'4th Edition',N'Edicioni i katërt'),
(N'Edition',N'edition-5',N'title',N'5th Edition',N'Edicioni i pestë'),
(N'Edition',N'edition-6',N'title',N'6th Edition',N'Edicioni i gjashtë'),
(N'Edition',N'edition-7',N'title',N'7th Edition',N'Edicioni i shtatë'),
(N'Edition',N'edition-8',N'title',N'8th Edition',N'Edicioni i tetë'),
(N'Edition',N'edition-9',N'title',N'9th Edition',N'Edicioni i nëntë'),
(N'Edition',N'edition-10',N'title',N'10th Edition',N'Edicioni i dhjetë'),
(N'Edition',N'edition-10',N'description',N'A milestone edition. A decade of theatre.',N'Një edicion historik. Një dekadë teatri.'),
(N'SiteSetting',N'footer.copyright',N'value',N'© 2026 Prishtina International Theatre Festival. All rights reserved.',N'© 2026 Prishtina International Theatre Festival. Të gjitha të drejtat e rezervuara.');

DECLARE @Changed int = 0;

UPDATE sq SET Value=r.Target
FROM @R r
JOIN PageContents x ON r.EntityType=N'PageContent' AND CONCAT(x.PageKey,N'/',x.SectionKey)=r.Label
JOIN Translations en ON en.EntityType=N'PageContent' AND en.EntityId=x.Id AND en.LanguageCode=N'en' AND en.Field=r.Field
JOIN Translations sq ON sq.EntityType=N'PageContent' AND sq.EntityId=x.Id AND sq.LanguageCode=N'sq' AND sq.Field=r.Field;
SET @Changed += @@ROWCOUNT;

UPDATE sq SET Value=r.Target
FROM @R r
JOIN HomepageSections x ON r.EntityType=N'HomepageSection' AND x.[Key]=r.Label
JOIN Translations en ON en.EntityType=N'HomepageSection' AND en.EntityId=x.Id AND en.LanguageCode=N'en' AND en.Field=r.Field AND en.Value=r.Source
JOIN Translations sq ON sq.EntityType=N'HomepageSection' AND sq.EntityId=x.Id AND sq.LanguageCode=N'sq' AND sq.Field=r.Field;
SET @Changed += @@ROWCOUNT;

UPDATE sq SET Value=r.Target
FROM @R r
JOIN NavigationItems x ON r.EntityType=N'NavigationItem' AND x.[Key]=r.Label
JOIN Translations en ON en.EntityType=N'NavigationItem' AND en.EntityId=x.Id AND en.LanguageCode=N'en' AND en.Field=r.Field AND en.Value=r.Source
JOIN Translations sq ON sq.EntityType=N'NavigationItem' AND sq.EntityId=x.Id AND sq.LanguageCode=N'sq' AND sq.Field=r.Field;
SET @Changed += @@ROWCOUNT;

UPDATE sq SET Value=r.Target
FROM @R r
JOIN Editions x ON r.EntityType=N'Edition' AND x.Slug=r.Label
JOIN Translations en ON en.EntityType=N'Edition' AND en.EntityId=x.Id AND en.LanguageCode=N'en' AND en.Field=r.Field AND en.Value=r.Source
JOIN Translations sq ON sq.EntityType=N'Edition' AND sq.EntityId=x.Id AND sq.LanguageCode=N'sq' AND sq.Field=r.Field;
SET @Changed += @@ROWCOUNT;

UPDATE sq SET Value=r.Target
FROM @R r
JOIN SiteSettings x ON r.EntityType=N'SiteSetting' AND x.[Key]=r.Label
JOIN Translations en ON en.EntityType=N'SiteSetting' AND en.EntityId=x.Id AND en.LanguageCode=N'en' AND en.Field=r.Field AND en.Value=r.Source
JOIN Translations sq ON sq.EntityType=N'SiteSetting' AND sq.EntityId=x.Id AND sq.LanguageCode=N'sq' AND sq.Field=r.Field;
SET @Changed += @@ROWCOUNT;

-- NCHAR avoids code-page ambiguity for the copyright symbol when sqlcmd reads this file.
UPDATE sq SET Value=NCHAR(169) + N' 2026 Prishtina International Theatre Festival. Të gjitha të drejtat e rezervuara.'
FROM SiteSettings x
JOIN Translations en ON en.EntityType=N'SiteSetting' AND en.EntityId=x.Id AND en.LanguageCode=N'en' AND en.Field=N'value'
JOIN Translations sq ON sq.EntityType=N'SiteSetting' AND sq.EntityId=x.Id AND sq.LanguageCode=N'sq' AND sq.Field=N'value'
WHERE x.[Key]=N'footer.copyright' AND en.Value LIKE N'%All rights reserved.';
SET @Changed += @@ROWCOUNT;

-- Preserve the play title, hashtag and artist name in the PITF 2018 schedule.
UPDATE t SET Value=N'19.00 Performance "HollySh*t", AAB Theatre, Kosovo' + NCHAR(13) + NCHAR(10) + NCHAR(13) + NCHAR(10)
    + N'20.30 #PITF2018 Awards Ceremony' + NCHAR(13) + NCHAR(10) + NCHAR(13) + NCHAR(10)
    + N'20.45 Afterparty - Jehona Lumi' + NCHAR(13) + NCHAR(10) + NCHAR(13) + NCHAR(10) + N'Welcome!'
FROM Translations t
WHERE t.LanguageCode=N'en' AND t.Field=N'body'
  AND t.EntityType IN (N'News',N'FestivalActivity')
  AND t.EntityId IN (CONVERT(uniqueidentifier,N'C03B1B8E-4287-4782-90EA-7923BCBECA6A'),
                     CONVERT(uniqueidentifier,N'52D5B930-E112-467A-87E6-83ADA0CFFDAF'));
SET @Changed += @@ROWCOUNT;

COMMIT;
SELECT @Changed AS EditorialRefinementsApplied;
