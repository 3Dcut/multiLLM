// LLM MultiChat - Vote Detection Patterns
// Separate Datei für einfachere Wartung

const VotePatterns = {
  // Zeichen die am Anfang ignoriert werden (Emojis, Symbole, Whitespace)
  prefixCleanup: /^[\s\u200B\u00A0❌✅✓✗☑☒▶►•●○◆◇■□▪▫★☆→←↑↓✔✖❎❓❗⚠️🔴🟢🟡⭐💡📌🎯✨💫🔥👍👎]+/u,
  
  // === JA Patterns ===
  jaPatterns: [
    // Direkt am Anfang
    /^ja[\s\.,!\-–:;,\n\r]/i,
    /^yes[\s\.,!\-–:;,\n\r]/i,
    /^jawohl[\s\.,!\-–:;,\n\r]/i,
    /^absolut[\s\.,!\-–:;,\n\r]/i,
    /^definitiv[\s\.,!\-–:;,\n\r]/i,
    /^genau[\s\.,!\-–:;,\n\r]/i,
    /^sicher[\s\.,!\-–:;,\n\r]/i,
    /^selbstverst[aä]ndlich[\s\.,!\-–:;,\n\r]/i,
    
    // Nach kurzem Prefix (Kurzantwort:, Antwort:, etc.)
    /^.{0,30}:\s*ja[\s\.,!\-–:;,\n\r]/i,
    /^.{0,30}:\s*yes[\s\.,!\-–:;,\n\r]/i,
    
    // Fett/Formatiert
    /^\*\*ja\*\*/i,
    /^\*\*yes\*\*/i,
    /^__ja__/i,
    
    // Mit Doppelpunkt am Ende (Ja:)
    /^ja:/i,
    /^yes:/i,
  ],
  
  // === NEIN Patterns ===
  neinPatterns: [
    // Direkt am Anfang
    /^nein[\s\.,!\-–:;,\n\r]/i,
    /^no[\s\.,!\-–:;,\n\r]/i,
    /^nicht[\s\.,!\-–:;,\n\r]/i,
    /^keineswegs[\s\.,!\-–:;,\n\r]/i,
    /^niemals[\s\.,!\-–:;,\n\r]/i,
    /^auf keinen fall/i,
    /^leider nein/i,
    /^leider nicht/i,
    
    // Nach kurzem Prefix
    /^.{0,30}:\s*nein[\s\.,!\-–:;,\n\r]/i,
    /^.{0,30}:\s*no[\s\.,!\-–:;,\n\r]/i,
    /^.{0,30}:\s*nicht[\s\.,!\-–:;,\n\r]/i,
    
    // Fett/Formatiert
    /^\*\*nein\*\*/i,
    /^\*\*no\*\*/i,
    /^__nein__/i,
    
    // Mit Doppelpunkt am Ende
    /^nein:/i,
    /^no:/i,
  ],
  
  // === UNKLAR Patterns (Rückfragen, Unsicherheit) ===
  unclearPatterns: [
    /^k[oö]nntest du/i,
    /^k[oö]nnten sie/i,
    /^was meinst du/i,
    /^was meinen sie/i,
    /^worauf bezieht/i,
    /^ich verstehe nicht/i,
    /^ich bin mir nicht sicher/i,
    /^das h[aä]ngt davon ab/i,
    /^das kommt darauf an/i,
    /^es kommt darauf an/i,
    /^bitte pr[aä]zisieren/i,
    /^kannst du genauer/i,
    /^k[oö]nnen sie genauer/i,
    /^was genau meinst/i,
    /^ich brauche mehr/i,
    /^mehr kontext/i,
    /^um .{0,30} zu beantworten/i,
    /^diese frage/i,
    /^sowohl .{0,20} als auch/i,
    /^einerseits .{0,30} andererseits/i,
    /^jein/i,
    /^vielleicht/i,
    /^m[oö]glicherweise/i,
    /^unter umst[aä]nden/i,
    /^teils.{0,5}teils/i,
  ],
  
  // === Meta-Patterns (Bewertungen, Vergleiche - ignorieren) ===
  metaPatterns: [
    /rangliste/i,
    /ranking/i,
    /bewertung/i,
    /vergleich/i,
    /^1\.\s/,
    /^#1/,
    /platz\s*\d/i,
    /beste antwort/i,
    /qualit[aä]t/i,
    /alle antworten/i,
    /beide antworten/i,
  ],
  
  // Wörter für gewichtete Erkennung
  jaWords: ['ja', 'yes', 'jawohl', 'genau', 'richtig', 'korrekt', 'stimmt', 'absolut', 'definitiv', 'sicher', 'natürlich'],
  neinWords: ['nein', 'no', 'nicht', 'falsch', 'incorrect', 'wrong', 'keineswegs', 'niemals'],
};

// Hilfsfunktion: Text für Analyse vorbereiten
VotePatterns.cleanText = function(text) {
  // Prefix-Emojis/Symbole entfernen
  let cleaned = text.replace(this.prefixCleanup, '');
  // Mehrfache Leerzeichen normalisieren
  cleaned = cleaned.replace(/\s+/g, ' ').trim();
  return cleaned;
};

// Hilfsfunktion: Prüfen ob es eine Meta-Antwort ist
VotePatterns.isMeta = function(text) {
  const start = text.substring(0, 100).toLowerCase();
  return this.metaPatterns.some(p => p.test(start));
};

// Hilfsfunktion: Prüfen ob es eine Rückfrage ist
VotePatterns.isUnclear = function(text) {
  const start = text.substring(0, 150).toLowerCase();
  return this.unclearPatterns.some(p => p.test(start));
};

// Export für Node.js (falls benötigt)
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VotePatterns;
}
