/**
 * Google Proofreader API Implementation
 * Based on the specification in README.md
 */

// Availability states
const AIAvailability = {
  UNAVAILABLE: 'unavailable',
  DOWNLOADABLE: 'downloadable', 
  DOWNLOADING: 'downloading',
  AVAILABLE: 'available'
};

// Correction types enum
const CorrectionType = {
  SPELLING: 'spelling',
  PUNCTUATION: 'punctuation',
  CAPITALIZATION: 'capitalization',
  PREPOSITION: 'preposition',
  MISSING_WORDS: 'missing-words',
  GRAMMAR: 'grammar'
};

class Proofreader {
  constructor(options = {}) {
    this.includeCorrectionTypes = options.includeCorrectionTypes || false;
    this.includeCorrectionExplanations = options.includeCorrectionExplanations || false;
    this.correctionExplanationLanguage = options.correctionExplanationLanguage || 'en';
    this.expectedInputLanguages = options.expectedInputLanguages || ['en'];
    this.apiEndpoint = options.apiEndpoint || '/api/proofreader/proofread';
  }

  static async create(options = {}) {
    // Simulate download progress if needed
    if (options.monitor) {
      const monitor = options.monitor;
      // Simulate download events
      setTimeout(() => {
        const event = new CustomEvent('downloadprogress', { detail: { loaded: 1.0 } });
        if (monitor.dispatchEvent) monitor.dispatchEvent(event);
        else if (monitor.addEventListener) {
          // Trigger progress events
          for (let i = 0; i <= 100; i += 10) {
            setTimeout(() => {
              const progressEvent = new CustomEvent('downloadprogress', { 
                detail: { loaded: i / 100 } 
              });
              monitor.dispatchEvent(progressEvent);
            }, i * 10);
          }
        }
      }, 100);
    }

    // Check if signal is aborted
    if (options.signal?.aborted) {
      throw new DOMException('Operation was aborted', 'AbortError');
    }

    return new Proofreader(options);
  }

  static async availability(options = {}) {
    // In a real implementation, this would check system capabilities
    // For now, assume it's always available
    return AIAvailability.AVAILABLE;
  }

  async proofread(input, options = {}) {
    if (options.signal?.aborted) {
      throw new DOMException('Operation was aborted', 'AbortError');
    }

    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: input,
          includeCorrectionTypes: this.includeCorrectionTypes,
          includeCorrectionExplanations: this.includeCorrectionExplanations,
          correctionExplanationLanguage: this.correctionExplanationLanguage,
          expectedInputLanguages: this.expectedInputLanguages
        }),
        signal: options.signal
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      return {
        correctedInput: data.correctedInput || data.improved_text || input,
        corrections: this._processCorrections(data.corrections || data.suggestions || [], input)
      };
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new DOMException('Operation was aborted', 'AbortError');
      }
      throw error;
    }
  }

  async *proofreadStreaming(input, options = {}) {
    // For streaming, we'll simulate streaming corrections
    const result = await this.proofread(input, options);
    
    // Yield corrections one by one to simulate streaming
    for (const correction of result.corrections) {
      yield {
        correctedInput: result.correctedInput,
        corrections: [correction]
      };
      // Add small delay to simulate streaming
      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }

  _processCorrections(suggestions, originalText) {
    return suggestions.map((suggestion, index) => {
      // Find the position of the error in the original text
      let startIndex = originalText.indexOf(suggestion.original);
      if (startIndex === -1) startIndex = 0;
      const endIndex = startIndex + (suggestion.original?.length || 0);

      const correction = {
        startIndex,
        endIndex,
        correction: suggestion.suggested || suggestion.correction || ''
      };

      // Add type if requested
      if (this.includeCorrectionTypes) {
        correction.type = this._mapCorrectionType(suggestion.type);
      }

      // Add explanation if requested
      if (this.includeCorrectionExplanations) {
        correction.explanation = suggestion.explanation || 'Grammatical improvement suggested';
      }

      return correction;
    });
  }

  _mapCorrectionType(type) {
    const typeMap = {
      'grammar': CorrectionType.GRAMMAR,
      'spelling': CorrectionType.SPELLING,
      'punctuation': CorrectionType.PUNCTUATION,
      'capitalization': CorrectionType.CAPITALIZATION,
      'preposition': CorrectionType.PREPOSITION,
      'missing-words': CorrectionType.MISSING_WORDS
    };
    
    return typeMap[type] || CorrectionType.GRAMMAR;
  }

  destroy() {
    // Clean up resources
    this._destroyed = true;
  }
}

// Export for use in browsers and Node.js
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Proofreader, CorrectionType, AIAvailability };
} else if (typeof window !== 'undefined') {
  window.Proofreader = Proofreader;
  window.CorrectionType = CorrectionType;
  window.AIAvailability = AIAvailability;
}