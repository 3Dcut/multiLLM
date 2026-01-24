// Voting Logic Module
// Depends on VotePatterns

let VotePatternsRef;
if (typeof VotePatterns !== 'undefined') {
  VotePatternsRef = VotePatterns;
} else if (typeof require !== 'undefined') {
  try {
    VotePatternsRef = require('./vote-patterns.js');
  } catch (e) {
    console.error('Could not load VotePatterns:', e);
  }
}

const VotingLogic = {
  strategies: {
    pattern: (text) => {
      const start = text.substring(0, 200).toLowerCase();
      const isJa = VotePatternsRef.jaPatterns.some(p => p.test(start));
      const isNein = VotePatternsRef.neinPatterns.some(p => p.test(start));
      if (isJa && !isNein) return 'ja';
      if (isNein && !isJa) return 'nein';
      return 'unklar';
    },

    first: (text) => {
      const start = text.substring(0, 150).toLowerCase();
      const jaMatch = start.match(/(?:^|[.!?]\s*)(ja|yes|jawohl|genau|absolut|definitiv)[\s\.,!\-–:;,\n\r]/i);
      const neinMatch = start.match(/(?:^|[.!?]\s*)(nein|no|nicht|keineswegs|niemals)[\s\.,!\-–:;,\n\r]/i);
      if (!jaMatch && !neinMatch) return 'unklar';
      if (jaMatch && !neinMatch) return 'ja';
      if (neinMatch && !jaMatch) return 'nein';
      return jaMatch.index < neinMatch.index ? 'ja' : 'nein';
    },

    count: (text) => {
      const start = text.substring(0, 200).toLowerCase();
      const jaCount = (start.match(/\b(ja|yes|jawohl)\b/gi) || []).length;
      const neinCount = (start.match(/\b(nein|no|nicht)\b/gi) || []).length;
      if (jaCount === 0 && neinCount === 0) return 'unklar';
      if (jaCount > neinCount) return 'ja';
      if (neinCount > jaCount) return 'nein';
      return 'unklar';
    },

    weighted: (text) => {
      const start = text.substring(0, 250).toLowerCase();
      let jaScore = 0, neinScore = 0;

      const getWeight = (pos) => {
        const before = text.substring(Math.max(0, pos - 5), pos);
        const isAfterSentence = /[.!?\n]\s*$/.test(before) || pos < 3;
        if (isAfterSentence && pos < 50) return 10;
        if (pos < 50) return 5;
        if (pos < 150) return 2;
        return 1;
      };

      const jaWordsRegex = new RegExp('\\b(' + VotePatternsRef.jaWords.join('|') + ')\\b', 'gi');
      const neinWordsRegex = new RegExp('\\b(' + VotePatternsRef.neinWords.join('|') + ')\\b', 'gi');

      let match;
      while ((match = jaWordsRegex.exec(start)) !== null) jaScore += getWeight(match.index);
      while ((match = neinWordsRegex.exec(start)) !== null) neinScore += getWeight(match.index);

      if (jaScore === 0 && neinScore === 0) return 'unklar';
      if (jaScore >= 5 && jaScore > neinScore) return 'ja';
      if (neinScore >= 5 && neinScore > jaScore) return 'nein';
      return 'unklar';
    }
  },

  detectVote: function(text, strategy) {
    if (!VotePatternsRef) return 'unklar';

    const cleanedText = VotePatternsRef.cleanText(text);
    const lowerText = cleanedText.toLowerCase();

    if (VotePatternsRef.isMeta(lowerText) || VotePatternsRef.isUnclear(lowerText)) {
      return 'unklar';
    }

    if (strategy === 'weighted') {
      const patternResult = this.strategies.pattern(lowerText);
      if (patternResult !== 'unklar') return patternResult;
      return this.strategies.weighted(lowerText);
    }

    return this.strategies[strategy]?.(lowerText) || 'unklar';
  }
};

// Export for Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = VotingLogic;
}
