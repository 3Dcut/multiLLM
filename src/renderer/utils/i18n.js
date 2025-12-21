// LLM MultiChat - Internationalisierung (i18n)
// Unterstützte Sprachen: de, en, nl

const I18N = {
  // Aktuelle Sprache
  currentLang: 'de',
  
  // Verfügbare Sprachen mit Flaggen
  languages: {
    de: { name: 'Deutsch', flag: '🇩🇪' },
    en: { name: 'English', flag: '🇬🇧' },
    nl: { name: 'Nederlands', flag: '🇳🇱' }
  },
  
  // Übersetzungen
  translations: {
    // ============================================
    // UI - Allgemein
    // ============================================
    de: {
      // Prompt-Eingabe
      promptPlaceholder: 'Prompt eingeben... (Strg+Enter zum Senden)',
      
      // Tooltips
      tooltipPasteImage: 'Bild aus Zwischenablage einfügen (Strg+Shift+V)',
      tooltipSend: 'Senden (Strg+Enter)',
      tooltipGrid: 'Raster',
      tooltipHorizontal: 'Horizontal',
      tooltipVertical: 'Vertikal',
      tooltipVote: 'Ja/Nein Abstimmung auswerten',
      tooltipCompareAll: 'Alle KIs vergleichen lassen',
      tooltipSessionBack: 'Vorherige Session',
      tooltipSessionForward: 'Nächste Session',
      tooltipRefresh: 'Neue Sitzung starten',
      tooltipLanguage: 'Sprache wechseln',
      
      // Buttons
      btnVote: '🗳️ Vote',
      btnCompare: '⚖️ Vergleichen',
      btnVoteLoading: '⏳ Prüfe...',
      btnCompareLoading: '⏳ Sammle...',
      
      // Header-Buttons
      tooltipMute: 'Nächste Nachricht überspringen',
      tooltipFocus: 'Nur dieses Fenster anzeigen',
      tooltipUnfocus: 'Alle Fenster anzeigen',
      tooltipCopy: 'Letzte Antwort kopieren',
      tooltipCrossCompare: 'Andere Antworten hier vergleichen lassen',
      tooltipReload: 'Neu laden',
      
      // Status
      statusLoading: 'Lade Konfiguration...',
      statusError: 'Fehler beim Laden der Konfiguration',
      
      // Meldungen
      msgNoActiveService: 'Mindestens ein Service muss aktiviert sein (alle sind stummgeschaltet)!',
      msgCopied: 'Kopiert!',
      msgNoResponse: 'Keine Antwort gefunden',
      msgSessionPrev: 'Vorherige Session',
      msgSessionNext: 'Nächste Session',
      msgSessionCurrent: 'Aktuelle Session',
      msgNoSessionPrev: 'Keine vorherige Session',
      msgMinServices: 'Mindestens 2 Services müssen Antworten haben.',
      msgNoImage: 'Kein Bild in der Zwischenablage gefunden!',
      msgClipboardError: 'Fehler beim Zugriff auf die Zwischenablage',
      msgCopyFailed: 'Kopieren fehlgeschlagen',
      msgNoResponseFrom: 'Keine Antwort von {service} gefunden.',
      
      // Vote-Ergebnisse
      voteYes: 'Ja',
      voteNo: 'Nein',
      voteUnclear: 'Unklar',
      voteResult: 'Ergebnis',
      voteNoResponses: 'Keine Antworten erkannt',
      voteMajorityYes: 'MEHRHEIT: JA',
      voteMajorityNo: 'MEHRHEIT: NEIN',
      voteTie: 'UNENTSCHIEDEN',
      voteUnclearResult: 'UNKLAR',
      
      // Vergleichs-Prompt
      comparePrompt: `Vergleiche die folgenden Antworten verschiedener KI-Assistenten auf dieselbe Frage.
Bewerte jede Antwort nach: Korrektheit, Vollständigkeit, Klarheit.
Erstelle eine Rangliste und erkläre kurz die Stärken/Schwächen.

Die Antworten:

`,
      compareAnswerPrefix: '=== Antwort von',
      
      // Cross-Compare Prompt
      crossComparePrompt: `Hier sind Antworten anderer KI-Assistenten auf die gleiche Frage.
Vergleiche sie mit deiner eigenen Antwort. Was sind die Unterschiede?
Welche Antwort ist am besten und warum?

`,
    },
    
    // ============================================
    // English
    // ============================================
    en: {
      promptPlaceholder: 'Enter prompt... (Ctrl+Enter to send)',
      
      tooltipPasteImage: 'Paste image from clipboard (Ctrl+Shift+V)',
      tooltipSend: 'Send (Ctrl+Enter)',
      tooltipGrid: 'Grid',
      tooltipHorizontal: 'Horizontal',
      tooltipVertical: 'Vertical',
      tooltipVote: 'Evaluate Yes/No vote',
      tooltipCompareAll: 'Compare all AI responses',
      tooltipSessionBack: 'Previous session',
      tooltipSessionForward: 'Next session',
      tooltipRefresh: 'Start new session',
      tooltipLanguage: 'Change language',
      
      btnVote: '🗳️ Vote',
      btnCompare: '⚖️ Compare',
      btnVoteLoading: '⏳ Checking...',
      btnCompareLoading: '⏳ Collecting...',
      
      tooltipMute: 'Skip next message',
      tooltipFocus: 'Show only this window',
      tooltipUnfocus: 'Show all windows',
      tooltipCopy: 'Copy last response',
      tooltipCrossCompare: 'Compare other responses here',
      tooltipReload: 'Reload',
      
      statusLoading: 'Loading configuration...',
      statusError: 'Error loading configuration',
      
      msgNoActiveService: 'At least one service must be active (all are muted)!',
      msgCopied: 'Copied!',
      msgNoResponse: 'No response found',
      msgSessionPrev: 'Previous session',
      msgSessionNext: 'Next session',
      msgSessionCurrent: 'Current session',
      msgNoSessionPrev: 'No previous session',
      msgMinServices: 'At least 2 services must have responses.',
      msgNoImage: 'No image found in clipboard!',
      msgClipboardError: 'Error accessing clipboard',
      msgCopyFailed: 'Copy failed',
      msgNoResponseFrom: 'No response from {service} found.',
      
      voteYes: 'Yes',
      voteNo: 'No',
      voteUnclear: 'Unclear',
      voteResult: 'Result',
      voteNoResponses: 'No responses detected',
      voteMajorityYes: 'MAJORITY: YES',
      voteMajorityNo: 'MAJORITY: NO',
      voteTie: 'TIE',
      voteUnclearResult: 'UNCLEAR',
      
      comparePrompt: `Compare the following responses from different AI assistants to the same question.
Rate each response by: Correctness, Completeness, Clarity.
Create a ranking and briefly explain the strengths/weaknesses.

The responses:

`,
      compareAnswerPrefix: '=== Response from',
      
      crossComparePrompt: `Here are responses from other AI assistants to the same question.
Compare them with your own response. What are the differences?
Which response is best and why?

`,
    },
    
    // ============================================
    // Nederlands
    // ============================================
    nl: {
      promptPlaceholder: 'Voer prompt in... (Ctrl+Enter om te verzenden)',
      
      tooltipPasteImage: 'Afbeelding plakken uit klembord (Ctrl+Shift+V)',
      tooltipSend: 'Verzenden (Ctrl+Enter)',
      tooltipGrid: 'Raster',
      tooltipHorizontal: 'Horizontaal',
      tooltipVertical: 'Verticaal',
      tooltipVote: 'Ja/Nee stemming evalueren',
      tooltipCompareAll: 'Alle AI-antwoorden vergelijken',
      tooltipSessionBack: 'Vorige sessie',
      tooltipSessionForward: 'Volgende sessie',
      tooltipRefresh: 'Nieuwe sessie starten',
      tooltipLanguage: 'Taal wijzigen',
      
      btnVote: '🗳️ Stem',
      btnCompare: '⚖️ Vergelijken',
      btnVoteLoading: '⏳ Controleren...',
      btnCompareLoading: '⏳ Verzamelen...',
      
      tooltipMute: 'Volgende bericht overslaan',
      tooltipFocus: 'Alleen dit venster tonen',
      tooltipUnfocus: 'Alle vensters tonen',
      tooltipCopy: 'Laatste antwoord kopiëren',
      tooltipCrossCompare: 'Andere antwoorden hier vergelijken',
      tooltipReload: 'Herladen',
      
      statusLoading: 'Configuratie laden...',
      statusError: 'Fout bij laden van configuratie',
      
      msgNoActiveService: 'Minimaal één service moet actief zijn (alle zijn gedempt)!',
      msgCopied: 'Gekopieerd!',
      msgNoResponse: 'Geen antwoord gevonden',
      msgSessionPrev: 'Vorige sessie',
      msgSessionNext: 'Volgende sessie',
      msgSessionCurrent: 'Huidige sessie',
      msgNoSessionPrev: 'Geen vorige sessie',
      msgMinServices: 'Minimaal 2 services moeten antwoorden hebben.',
      msgNoImage: 'Geen afbeelding gevonden in klembord!',
      msgClipboardError: 'Fout bij toegang tot klembord',
      msgCopyFailed: 'Kopiëren mislukt',
      msgNoResponseFrom: 'Geen antwoord van {service} gevonden.',
      
      voteYes: 'Ja',
      voteNo: 'Nee',
      voteUnclear: 'Onduidelijk',
      voteResult: 'Resultaat',
      voteNoResponses: 'Geen antwoorden gedetecteerd',
      voteMajorityYes: 'MEERDERHEID: JA',
      voteMajorityNo: 'MEERDERHEID: NEE',
      voteTie: 'GELIJKSPEL',
      voteUnclearResult: 'ONDUIDELIJK',
      
      comparePrompt: `Vergelijk de volgende antwoorden van verschillende AI-assistenten op dezelfde vraag.
Beoordeel elk antwoord op: Correctheid, Volledigheid, Duidelijkheid.
Maak een ranglijst en leg kort de sterke/zwakke punten uit.

De antwoorden:

`,
      compareAnswerPrefix: '=== Antwoord van',
      
      crossComparePrompt: `Hier zijn antwoorden van andere AI-assistenten op dezelfde vraag.
Vergelijk ze met je eigen antwoord. Wat zijn de verschillen?
Welk antwoord is het beste en waarom?

`,
    }
  },
  
  // ============================================
  // Methoden
  // ============================================
  
  // Sprache setzen
  setLanguage(lang) {
    if (this.translations[lang]) {
      this.currentLang = lang;
      return true;
    }
    return false;
  },
  
  // Übersetzung holen
  t(key) {
    const trans = this.translations[this.currentLang];
    return trans[key] || this.translations['en'][key] || key;
  },
  
  // Nächste Sprache (für Durchschalten)
  getNextLanguage() {
    const langs = Object.keys(this.languages);
    const currentIndex = langs.indexOf(this.currentLang);
    const nextIndex = (currentIndex + 1) % langs.length;
    return langs[nextIndex];
  },
  
  // Aktuelle Flagge
  getCurrentFlag() {
    return this.languages[this.currentLang].flag;
  },
  
  // Accept-Language Header für Webviews
  getAcceptLanguage() {
    const langMap = {
      de: 'de-DE,de;q=0.9,en;q=0.8',
      en: 'en-US,en;q=0.9',
      nl: 'nl-NL,nl;q=0.9,en;q=0.8'
    };
    return langMap[this.currentLang] || langMap['en'];
  },
  
  // Locale für Websites
  getLocale() {
    const localeMap = {
      de: 'de-DE',
      en: 'en-US',
      nl: 'nl-NL'
    };
    return localeMap[this.currentLang] || 'en-US';
  }
};

// Export
if (typeof module !== 'undefined' && module.exports) {
  module.exports = I18N;
}
