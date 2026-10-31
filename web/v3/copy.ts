// Maintained DE/EN source text. Other locales deliberately use English source, visibly labelled in the UI.
import { languages } from './i18n.ts';
export const copy = {
  allocation_title: [
    'Verteilung der Testeinzahlungen',
    'Test deposit allocation',
  ],
  allocation_test_account: [
    'Gemeinsames lokales Testkonto · inklusive Initialfinanzierung · wertlose dUSD. Keine persönlichen Guthaben.',
    'Shared local test account · includes initial funding · worthless dUSD. No personal balances.',
  ],
  allocation_explanation: [
    'Kumulierte bestätigte Einzahlungen je Bündnis, keine verbleibenden Guthaben. Einzelne NGO-Auszahlungen können diesen Einzahlungen nicht zugeordnet werden.',
    'Cumulative confirmed deposits per alliance, not remaining balances. Individual NGO payouts cannot be attributed to these deposits.',
  ],
  allocation_total: ['Insgesamt eingezahlt', 'Total deposited'],
  allocation_load_failed: [
    'Einzahlungen konnten nicht aktualisiert werden. Bitte erneut aktualisieren.',
    'Deposits could not be refreshed. Please try refreshing again.',
  ],
  allocation_index_required: [
    'Für die Verteilung wird ein aktueller, vollständiger bestätigter Index benötigt. Der Index ist veraltet oder nicht verfügbar. Bitte später aktualisieren.',
    'Allocation requires a current, complete confirmed index. The index is stale or unavailable. Please refresh later.',
  ],
  allocation_no_organizations: [
    'Noch keine Organisationen registriert.',
    'No organizations registered yet.',
  ],
  allocation_no_deposits: [
    'Noch keine bestätigten Testeinzahlungen.',
    'No confirmed test deposits yet.',
  ],
  allocation_rounding: [
    'Prozentwerte sind gerundet; ihre Summe kann von 100 % abweichen.',
    'Percentages are rounded; their sum may differ from 100%.',
  ],
  ngo_access: ['NGO-Zugang', 'NGO access'],
  sign_out: ['Abmelden', 'Sign out'],
  sign_out_to_public: [
    'Abmelden und zur Öffentlichkeit',
    'Sign out and return to public pages',
  ],
  session_checking: ['Sitzung wird geprüft …', 'Checking session …'],
  session_failed: [
    'Sitzung konnte nicht geprüft werden.',
    'Could not check session.',
  ],
  choose_ngo: ['NGO auswählen', 'Choose NGO'],
  blockchain_confirmed_local: [
    'Blockchain bestätigt · lokal',
    'Blockchain confirmed · local',
  ],
  stale_index: ['Veralteter Indexstand', 'Stale index'],
  confirmed_snapshot_unavailable: [
    'Bestätigter Stand nicht verfügbar',
    'Confirmed snapshot unavailable',
  ],
  confirmed_with_two_blocks_of_depth: [
    'Bestätigung mit zwei Blöcken Abstand',
    'Confirmed with two blocks of depth',
  ],
  fund_balance: ['Fondsvolumen', 'Fund balance'],
  fund_balance_2: ['Fondsbestand', 'Fund balance'],
  reserved: ['Reserviert', 'Reserved'],
  available: ['Frei', 'Available'],
  paid: ['Ausgezahlt', 'Paid'],
  shared_fund: ['Gemeinsamer Fonds', 'Shared fund'],
  a_local_synthetic_alliance_three_ngos_share: [
    'Ein lokales, synthetisches Bündnis: drei NGOs teilen einen Fonds für grundlegende Katastrophenhilfe.',
    'A local synthetic alliance: three NGOs share a fund for essential disaster relief.',
  ],
  synthetic_illustration: [
    'Synthetische Illustration',
    'Synthetic illustration',
  ],
  previous_image: ['Vorheriges Bild', 'Previous image'],
  next_image: ['Nächstes Bild', 'Next image'],
  resume: ['Fortsetzen', 'Resume'],
  pause: ['Pause', 'Pause'],
  previous_organizations: ['Organisationen zurück', 'Previous organizations'],
  next_organizations: ['Organisationen weiter', 'Next organizations'],
  test_account_deposits: [
    'Einzahlungen des Testkontos',
    'Test account deposits',
  ],
  shared_fund_activity: [
    'Aktivität des gemeinsamen Fonds',
    'Shared fund activity',
  ],
  refresh: ['Aktualisieren', 'Refresh'],
  loading: ['Lädt …', 'Loading …'],
  no_confirmed_activity_in_this_snapshot: [
    'Keine bestätigte Aktivität in diesem Datenstand.',
    'No confirmed activity in this snapshot.',
  ],
  load_more: ['Mehr laden', 'Load more'],
  saved_chain_and_review_statuses_are_shown: [
    'Gespeichert. Chain- und Prüfstatus sind unten getrennt ausgewiesen.',
    'Saved. Chain and review statuses are shown separately below.',
  ],
  skip_to_content: ['Zum Inhalt', 'Skip to content'],
  main_navigation: ['Hauptnavigation', 'Main navigation'],
  discover: ['Entdecken', 'Discover'],
  end_the_ngo_session_first: [
    'Zuerst NGO-Sitzung beenden',
    'End the NGO session first',
  ],
  test_donation: ['Testspende', 'Test donation'],
  settings_and_sign_in: ['Einstellungen', 'Settings'],
  new_interface_text_english_source: [
    'Neue Oberflächentexte: englischer Ausgangstext',
    'New interface text: English source',
  ],
  retry: ['Erneut laden', 'Retry'],
  test_donation_mined_index_confirmation_pending: [
    'Testspende gemined; Indexbestätigung steht aus',
    'Test donation mined; index confirmation pending',
  ],
  reviewers_now_work_outside_the_app_ngos: [
    'Prüfer arbeiten jetzt außerhalb der App. NGOs importieren Dokumente und signierte Freigaben.',
    'Reviewers now work outside the app. NGOs import documents and signed approvals.',
  ],
  page_not_found: ['Seite nicht gefunden', 'Page not found'],
  back_to_home: ['Zur Startseite', 'Back to home'],
  local_prototype_no_fiat_conversion_for_dusd: [
    'Lokaler Prototyp · keine Fiat-Umrechnung von dUSD',
    'Local prototype · no fiat conversion for dUSD',
  ],
  settings: ['Einstellungen', 'Settings'],
  ngo_sign_in: ['NGO-Anmeldung', 'NGO sign-in'],
  simulated_local_role_no_identity_verification: [
    'Simulierte lokale Rolle; keine Identitätsprüfung.',
    'Simulated local role; no identity verification.',
  ],
  sign_in_as_ngo: ['NGO anmelden', 'Sign in as NGO'],
  optional_wallet_connection: [
    'Optionale Wallet-Verbindung',
    'Optional wallet connection',
  ],
  address_display_only_this_wallet_is_neither: [
    'Nur Adressanzeige. Dieses Wallet ist weder Anmeldung noch Spendenkonto; Testspenden verwenden weiterhin das gemeinsame Testkonto.',
    'Address display only. This wallet is neither sign-in nor the donor account; test donations continue to use the shared test account.',
  ],
  no_browser_wallet_installed: [
    'Keine Browserwallet vorhanden',
    'No browser wallet installed',
  ],
  connect_wallet: ['Wallet verbinden', 'Connect wallet'],
  hide_address: ['Adresse ausblenden', 'Hide address'],
  shared_test_donor_account_up_to_1: [
    'Gemeinsames Testspenderkonto; maximal 1.000 wertlose dUSD je Spende. Keine persönlichen Spenden und keine Fiat-Umrechnung.',
    'Shared test donor account; up to 1,000 valueless dUSD per donation. No personal donations or fiat conversion.',
  ],
  confirm_test_donation: ['Testspende bestätigen', 'Confirm test donation'],
  start_application: ['Antrag starten', 'Start application'],
  close: ['Schließen', 'Close'],
  incident_need: ['Einsatz & Bedarf', 'Incident & need'],
  amount_preview: ['Betrag & Vorschau', 'Amount & preview'],
  confirm: ['Bestätigen', 'Confirm'],
  incident: ['Einsatz', 'Incident'],
  need_rationale_and_conflicts_of_interest: [
    'Bedarf, Begründung und Interessenkonflikte',
    'Need, rationale and conflicts of interest',
  ],
  material_change_for_a_follow_up: [
    'Wesentliche Änderung bei Folgeantrag',
    'Material change for a follow-up',
  ],
  conflicted_ngos_for_follow_up_voting: [
    'Befangene NGOs für Folgeabstimmung',
    'Conflicted NGOs for follow-up voting',
  ],
  none_declared: ['Keine angegeben', 'None declared'],
  synthetic_model_a_preview_reserves_no_funds: [
    'Synthetisches Modell. Eine Vorschau reserviert keine Mittel.',
    'Synthetic model. A preview reserves no funds.',
  ],
  requested_dusd: ['Beantragt / dUSD', 'Requested / dUSD'],
  capacity_dusd: ['Kapazität / dUSD', 'Capacity / dUSD'],
  external_funding_dusd: [
    'Externe Finanzierung / dUSD',
    'External funding / dUSD',
  ],
  non_binding_preview: ['Unverbindliche Vorschau', 'Non-binding preview'],
  manual_proposal_for_external_review: [
    'Manueller Vorschlag zur externen Prüfung',
    'Manual proposal for external review',
  ],
  synthetic_model_ceiling: [
    'Synthetische Modellobergrenze',
    'Synthetic model ceiling',
  ],
  remaining_claim_before_capacity_limit: [
    'Verbleibender Anspruch vor Kapazitätsgrenze',
    'Remaining claim before capacity limit',
  ],
  estimated_round_allocation: [
    'Voraussichtlicher Rundenanteil',
    'Estimated round allocation',
  ],
  already_paid_reserved: [
    'Bereits ausgezahlt / reserviert',
    'Already paid / reserved',
  ],
  requested: ['Beantragt', 'Requested'],
  uncertainty_reserve_20_for_unknown_coverage_cumulative: [
    'Unsicherheitsreserve: 20 % bei unbekannter Lage; kumulative Grenze: 90 % bei Konkurrenz oder Unsicherheit. Der endgültige Betrag wird extern freigegeben und kann kleiner sein.',
    'Uncertainty reserve: 20% for unknown coverage; cumulative ceiling: 90% with competing incidents or uncertainty. The final amount is approved externally and may be lower.',
  ],
  local_confirmation_the_server_uses_test_keys: [
    'Lokale Bestätigung: Der Server verwendet Testschlüssel. Kein Passwort und keine Browserwallet-Signatur erforderlich.',
    'Local confirmation: the server uses test keys. No password or browser-wallet signature is required.',
  ],
  ngo_is_blocked_from_further_payouts: [
    'NGO ist für weitere Auszahlungen gesperrt.',
    'NGO is blocked from further payouts.',
  ],
  back: ['Zurück', 'Back'],
  next: ['Weiter', 'Next'],
  calculate_preview: ['Vorschau berechnen', 'Calculate preview'],
  submit_application: ['Antrag verbindlich absenden', 'Submit application'],
  evidence_pending: ['Nachweis offen', 'Evidence pending'],
  receipt_confirmed_in_review: [
    'Eingangsattest bestätigt · in Prüfung',
    'Receipt confirmed · in review',
  ],
  use_accepted: ['Verwendung akzeptiert', 'Use accepted'],
  more_information_requested: ['Nachforderung', 'More information requested'],
  rejected: ['Abgelehnt', 'Rejected'],
  appeal_pending: ['Einspruch offen', 'Appeal pending'],
  resolved: ['Geklärt', 'Resolved'],
  payout: ['Auszahlung', 'Payout'],
  contract_state_index_confirmation_pending: [
    'Contractstand · Indexbestätigung ausstehend',
    'Contract state · index confirmation pending',
  ],
  overdue: ['Überfällig', 'Overdue'],
  final_evidence_due: ['Endnachweis fällig', 'Final evidence due'],
  interim_report_due: ['Zwischenbericht fällig', 'Interim report due'],
  saved: ['Gespeichert', 'Saved'],
  still_pending: ['Noch offen', 'Still pending'],
  document_saved_upload_alone_is_neither_a: [
    'Dokument gespeichert. Upload allein ist weder Eingangsattest noch Annahme.',
    'Document saved. Upload alone is neither a receipt attestation nor acceptance.',
  ],
  no_completed_expenditure_evidence_upload_yet: [
    'Noch kein vollständiger Ausgabennachweis gespeichert.',
    'No completed expenditure evidence upload yet.',
  ],
  document_type: ['Dokumentart', 'Document type'],
  expenditure_evidence: ['Ausgabennachweis', 'Expenditure evidence'],
  external_review_document: [
    'Externes Prüfdokument',
    'External review document',
  ],
  upload_synthetic_document: [
    'Synthetisches Dokument hochladen',
    'Upload synthetic document',
  ],
  maximum_2_mib_txt_starts_with_disasterdao: [
    'Maximal 2 MiB. TXT beginnt mit DISASTERDAO SYNTHETIC. Nur fiktive Inhalte; private Speicherung.',
    'Maximum 2 MiB. TXT starts with DISASTERDAO SYNTHETIC. Fictional contents only; private storage.',
  ],
  a_signed_receipt_must_be_anchored_within: [
    'Signiertes Eingangsattest muss innerhalb einer Stunde verankert werden und einen rechtzeitigen Eingang bestätigen. Ein später Prüfbericht setzt keine Frist zurück.',
    'A signed receipt must be anchored within one hour and attest timely receipt. A later review report does not reset any deadline.',
  ],
  external_review: ['Externes Prüfdokument', 'External review'],
  upload_incomplete: ['Upload unvollständig', 'Upload incomplete'],
  download: ['Herunterladen', 'Download'],
  submit_interim_report: [
    'Zwischenbericht einreichen',
    'Submit interim report',
  ],
  interim_report: ['Zwischenbericht', 'Interim report'],
  save: ['Speichern', 'Save'],
  appeal: ['Einspruch einlegen', 'Appeal'],
  submit_ngo_report_for_publication: [
    'NGO-Bericht zur Veröffentlichung einreichen',
    'Submit NGO report for publication',
  ],
  title: ['Titel', 'Title'],
  report: ['Bericht', 'Report'],
  provenance: ['Herkunft', 'Provenance'],
  usage_rights: ['Nutzungsrechte', 'Usage rights'],
  protection_checks: ['Schutzprüfung', 'Protection checks'],
  submit_for_external_approval: [
    'Zur externen Freigabe einreichen',
    'Submit for external approval',
  ],
  your_response_starts_here: [
    'Dein Einsatz beginnt hier.',
    'Your response starts here.',
  ],
  choose_a_simulated_ngo_in_settings_to: [
    'Über das Zahnrad eine simulierte NGO anmelden.',
    'Choose a simulated NGO in settings to sign in.',
  ],
  simulated_session: ['Simulierte Anmeldung', 'Simulated session'],
  member_of_disasterdao_relief_alliance: [
    'Mitglied der DisasterDAO Relief Alliance',
    'Member of DisasterDAO Relief Alliance',
  ],
  further_payouts_are_blocked_check_outstanding_evidence: [
    'Weitere Auszahlungen sind gesperrt. Offene Nachweise oder Klärungen prüfen.',
    'Further payouts are blocked. Check outstanding evidence and resolutions.',
  ],
  how_approval_works: ['So funktioniert die Freigabe', 'How approval works'],
  submit_application_2: ['Antrag absenden', 'Submit application'],
  import_external_approvals: [
    'Externe Freigaben importieren',
    'Import external approvals',
  ],
  claim_reservation: ['Reservierung abrufen', 'Claim reservation'],
  the_local_server_signs_ngo_transactions_with: [
    'Der lokale Server signiert NGO-Transaktionen mit Testschlüsseln. Prüfer geben außerhalb der App ihre eigenen Signaturen ab.',
    'The local server signs NGO transactions with test keys. Reviewers provide their own signatures outside the app.',
  ],
  outstanding_evidence: ['Offene Nachweise zuerst', 'Outstanding evidence'],
  no_outstanding_evidence: [
    'Keine offenen Nachweise.',
    'No outstanding evidence.',
  ],
  applications_and_reservations: [
    'Anträge und Reservierungen',
    'Applications and reservations',
  ],
  status: ['Status', 'Status'],
  export_approval_request: [
    'Prüfauftrag exportieren',
    'Export approval request',
  ],
  close_expired_follow_up: [
    'Abgelaufenen Folgeantrag schließen',
    'Close expired follow-up',
  ],
  claim_by: ['Abrufen bis', 'Claim by'],
  claim_payout: ['Auszahlung abrufen', 'Claim payout'],
  release_expired_reservation: [
    'Abgelaufene Reservierung freigeben',
    'Release expired reservation',
  ],
  external_signature_approvals: [
    'Externe Signaturfreigaben',
    'External signature approvals',
  ],
  upload_the_review_document_against_its_evidence: [
    'Prüfdokument beim betreffenden Nachweis hochladen. Die separate JSON-Datei enthält die Freigabesignaturen. Dokumente allein ändern keinen Prüfstatus.',
    'Upload the review document against its evidence record. The separate JSON file contains approval signatures. Documents alone do not change review status.',
  ],
  import_signature_file: ['Signaturdatei importieren', 'Import signature file'],
  signature_file_too_large: [
    'Signaturdatei zu groß',
    'Signature file too large',
  ],
  checking_signatures: ['Signaturen werden geprüft …', 'Checking signatures …'],
  transaction_mined_waiting_for_two_confirmation_blocks: [
    'Transaktion gemined; zwei Bestätigungsblöcke abwarten',
    'Transaction mined; waiting for two confirmation blocks',
  ],
  off_chain_approval_saved: [
    'Off-Chain-Freigabe gespeichert',
    'Off-chain approval saved',
  ],
  import_failed_success_has_not_been_confirmed: [
    'Import fehlgeschlagen; kein Erfolg bestätigt.',
    'Import failed; success has not been confirmed.',
  ],
  evidence: ['Nachweis', 'Evidence'],
  transaction_mined_check_chain_status: [
    'Transaktion gemined · Chain-Status beachten',
    'Transaction mined · check chain status',
  ],
  external_signatures_missing_or_not_yet_imported: [
    'Externe Signaturen fehlen oder noch nicht importiert',
    'External signatures missing or not yet imported',
  ],
  follow_ups_from_other_members: [
    'Folgeanträge anderer Mitglieder',
    'Follow-ups from other members',
  ],
  approve_as_ngo: ['Als NGO zustimmen', 'Approve as NGO'],
  other_ngos_in_the_fund: ['Andere NGOs im Fonds', 'Other NGOs in the fund'],
  the_fund_activity_below_shows_available_deposits: [
    'Die folgende Fondsaktivität zeigt verfügbare Ein- und Auszahlungen; private Belege anderer NGOs bleiben geschützt.',
    'The fund activity below shows available deposits and payouts; other NGOs’ private evidence remains protected.',
  ],
  completed_evidence: ['Abgeschlossene Nachweise', 'Completed evidence'],
  own_reports: ['Eigene Berichte', 'Own reports'],
  published_ngo_statement: [
    'Veröffentlicht · NGO-Aussage',
    'Published · NGO statement',
  ],
  external_publication_approval_pending: [
    'Externe Veröffentlichungsfreigabe fehlt',
    'External publication approval pending',
  ],
  make_relief_possible_together: [
    'Gemeinsam Hilfe möglich machen.',
    'Make relief possible, together.',
  ],
  discover_organizations_whose_ngos_share_a_relief: [
    'Entdecke Organisationen, deren NGOs einen gemeinsamen Hilfsfonds teilen.',
    'Discover organizations whose NGOs share a relief fund.',
  ],
  discover_organizations: [
    'Organisationen entdecken',
    'Discover organizations',
  ],
  not_yet_supported_by_the_test_account: [
    'Vom Testkonto noch nicht unterstützt',
    'Not yet supported by the test account',
  ],
  support_status_requires_a_current_complete_index: [
    'Der Unterstützungsstatus ist erst mit aktuellem, vollständigem Index bekannt.',
    'Support status requires a current, complete index.',
  ],
  there_are_no_further_organizations_to_show: [
    'Hier gibt es derzeit keine weiteren Organisationen.',
    'There are no further organizations to show.',
  ],
  organization_not_found: [
    'Organisation nicht gefunden',
    'Organization not found',
  ],
  organization_shared_fund: [
    'Organisation / gemeinsamer Fonds',
    'Organization / shared fund',
  ],
  three_synthetic_ngos_share_one_local_relief: [
    'Ein lokales, synthetisches Bündnis: drei NGOs teilen einen Fonds für grundlegende Katastrophenhilfe.',
    'Three synthetic NGOs share one local relief fund.',
  ],
  support_history_of_the_shared_test_account: [
    'Unterstützungsverlauf des gemeinsamen Testkontos',
    'Support history of the shared test account',
  ],
  includes_initial_funding_this_is_not_a: [
    'Enthält initiale Einzahlungen. Dies ist kein persönliches Portfolio.',
    'Includes initial funding. This is not a personal portfolio.',
  ],
  donations_go_into_the_shared_fund_ngo: [
    'Spenden fließen in den gemeinsamen Fonds. Auszahlungen an NGOs lassen sich keiner einzelnen Spende zuordnen.',
    'Donations go into the shared fund. NGO payouts cannot be attributed to an individual donation.',
  ],
  member_ngos: ['Mitglieds-NGOs', 'Member NGOs'],
  synthetic_operating_areas: [
    'Synthetische Einsatzgebiete',
    'Synthetic operating areas',
  ],
  published_ngo_reports: [
    'Veröffentlichte NGO-Berichte',
    'Published NGO reports',
  ],
  ngo_statements_about_synthetic_outcomes_no_independently: [
    'NGO-Aussagen über synthetische Ergebnisse; keine unabhängig belegte humanitäre Wirkung.',
    'NGO statements about synthetic outcomes; no independently established humanitarian impact.',
  ],
} as const;
export type UIKey = keyof typeof copy;
export const uiCatalog = Object.fromEntries(
  languages.map(([locale]) => [
    locale,
    Object.fromEntries(
      Object.entries(copy).map(([key, values]) => [
        key,
        values[locale === 'de' ? 0 : 1],
      ]),
    ),
  ]),
) as Record<string, Record<UIKey, string>>;
export const uiText = (locale: string, key: UIKey) =>
  uiCatalog[locale]?.[key] ?? uiCatalog.en![key];
