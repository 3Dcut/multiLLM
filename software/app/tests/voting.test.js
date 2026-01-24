const VotingLogic = require('../../src/renderer/utils/voting.js');

describe('VotingLogic', () => {
  describe('detectVote', () => {

    // === Pattern Strategy Tests ===
    test('should detect "ja" with pattern strategy', () => {
      expect(VotingLogic.detectVote('Ja, das stimmt.', 'pattern')).toBe('ja');
      expect(VotingLogic.detectVote('Yes absolutely.', 'pattern')).toBe('ja');
      expect(VotingLogic.detectVote('Absolut richtig.', 'pattern')).toBe('ja');
    });

    test('should detect "nein" with pattern strategy', () => {
      expect(VotingLogic.detectVote('Nein, das ist falsch.', 'pattern')).toBe('nein');
      expect(VotingLogic.detectVote('No, incorrect.', 'pattern')).toBe('nein');
      expect(VotingLogic.detectVote('Keineswegs.', 'pattern')).toBe('nein');
    });

    test('should return "unklar" if unsure with pattern strategy', () => {
      expect(VotingLogic.detectVote('Das weiß ich nicht genau.', 'pattern')).toBe('unklar');
      expect(VotingLogic.detectVote('Vielleicht ja, vielleicht nein.', 'pattern')).toBe('unklar');
    });

    // === First Strategy Tests ===
    test('should detect first occurrence of ja/nein', () => {
      expect(VotingLogic.detectVote('Ja, aber nein.', 'first')).toBe('ja');
      expect(VotingLogic.detectVote('Nein, obwohl ja.', 'first')).toBe('nein');
    });

    // === Count Strategy Tests ===
    test('should count occurrences', () => {
      expect(VotingLogic.detectVote('Ja ja ja. Nein.', 'count')).toBe('ja');
      expect(VotingLogic.detectVote('Nein nein. Ja.', 'count')).toBe('nein');
      expect(VotingLogic.detectVote('Ja. Nein.', 'count')).toBe('unklar'); // Tie
    });

    // === Weighted Strategy Tests ===
    test('should use weighted strategy (default)', () => {
      // "Ja" at the beginning should weight more
      expect(VotingLogic.detectVote('Ja. Das ist ein langer Text mit nein später.', 'weighted')).toBe('ja');

      // "Nein" at the beginning
      expect(VotingLogic.detectVote('Nein. Auch wenn da ja steht.', 'weighted')).toBe('nein');
    });

    // === Unclear / Meta Tests ===
    test('should detect unclear responses', () => {
      expect(VotingLogic.detectVote('Das kommt darauf an.', 'weighted')).toBe('unklar');
      expect(VotingLogic.detectVote('Ich bin mir nicht sicher.', 'weighted')).toBe('unklar');
      expect(VotingLogic.detectVote('Könntest du das präzisieren?', 'weighted')).toBe('unklar');
    });

    test('should detect meta responses as unklar', () => {
      expect(VotingLogic.detectVote('Hier ist ein Vergleich der Antworten.', 'weighted')).toBe('unklar');
      expect(VotingLogic.detectVote('Platz 1: ...', 'weighted')).toBe('unklar');
    });

    test('should handle clean text (remove emojis)', () => {
      expect(VotingLogic.detectVote('✅ Ja, das stimmt.', 'pattern')).toBe('ja');
      expect(VotingLogic.detectVote('❌ Nein, falsch.', 'pattern')).toBe('nein');
      expect(VotingLogic.detectVote('💡 Das hängt davon ab.', 'weighted')).toBe('unklar');
    });
  });
});
