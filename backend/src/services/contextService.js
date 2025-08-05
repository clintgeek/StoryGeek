const Story = require('../models/Story');

class ContextService {
  constructor() {
    this.summaryInterval = 8; // Generate summaries every 8 interactions
    this.maxContextLength = 4000; // Target context length in tokens
  }

  // Build intelligent context for AI
  async buildContext(story, userInput, currentInteraction = 0) {
    const context = {
      story: this.getStoryBasics(story),
      currentSituation: story.worldState.currentSituation,
      activeCharacters: await this.getActiveCharacters(story),
      recentEvents: await this.getRecentEvents(story),
      chapterSummaries: await this.getChapterSummaries(story),
      diceHistory: this.getRecentDiceResults(story),
      userInput: userInput
    };

    // Add specific context based on user input
    const specificContext = await this.getSpecificContext(story, userInput);
    if (specificContext) {
      context.specificDetails = specificContext;
    }

    return this.formatContext(context);
  }

  // Get story basics
  getStoryBasics(story) {
    return {
      title: story.title,
      genre: story.genre,
      currentChapter: story.worldState.currentChapter,
      setting: story.worldState.setting,
      mood: story.worldState.mood,
      weather: story.worldState.weather,
      timeOfDay: story.worldState.timeOfDay,
      tone: story.aiContext.storyTone,
      magicSystem: story.aiContext.magicSystem,
      technologyLevel: story.aiContext.technologyLevel
    };
  }

  // Get active characters (3-5 most relevant)
  async getActiveCharacters(story) {
    const activeChars = story.characters.filter(char => char.isActive);

    // Sort by relevance (recently mentioned, important to current situation)
    const relevantChars = activeChars.slice(0, 5);

    return relevantChars.map(char => ({
      name: char.name,
      description: char.description,
      personality: char.personality,
      currentState: char.currentState,
      isPlayer: char.isPlayer || false
    }));
  }

  // Get recent events (last 5-8)
  async getRecentEvents(story) {
    const recentEvents = story.events.slice(-8);

    return recentEvents.map(event => ({
      type: event.type,
      description: event.description,
      timestamp: event.timestamp,
      characters: event.characters?.map(char => char.name) || [],
      diceResults: event.diceResults || []
    }));
  }

  // Get chapter summaries
  async getChapterSummaries(story) {
    if (!story.chapterSummaries) {
      story.chapterSummaries = [];
    }

    return story.chapterSummaries.slice(-3); // Last 3 chapter summaries
  }

  // Get recent dice results
  getRecentDiceResults(story) {
    return story.diceResults.slice(-5).map(dice => ({
      diceType: dice.diceType,
      result: dice.result,
      interpretation: dice.interpretation,
      context: dice.context
    }));
  }

  // Get specific context based on user input
  async getSpecificContext(story, userInput) {
    const input = userInput.toLowerCase();

    // Check for character mentions
    const characterMentions = story.characters.filter(char =>
      input.includes(char.name.toLowerCase())
    );

    // Check for location mentions
    const locationMentions = story.locations.filter(loc =>
      input.includes(loc.name.toLowerCase())
    );

    // Check for item mentions
    const itemMentions = story.characters.flatMap(char =>
      char.inventory?.filter(item => input.includes(item.name.toLowerCase())) || []
    );

    const specificContext = {};

    if (characterMentions.length > 0) {
      specificContext.characters = characterMentions.map(char => ({
        name: char.name,
        description: char.description,
        personality: char.personality,
        background: char.background,
        currentState: char.currentState,
        relationships: char.relationships,
        inventory: char.inventory,
        skills: char.skills
      }));
    }

    if (locationMentions.length > 0) {
      specificContext.locations = locationMentions.map(loc => ({
        name: loc.name,
        description: loc.description,
        type: loc.type,
        atmosphere: loc.atmosphere,
        inhabitants: loc.inhabitants,
        items: loc.items,
        history: loc.history
      }));
    }

    if (itemMentions.length > 0) {
      specificContext.items = itemMentions;
    }

    return Object.keys(specificContext).length > 0 ? specificContext : null;
  }

  // Format context for AI consumption
  formatContext(context) {
    let formatted = `STORY CONTEXT:
Title: ${context.story.title}
Genre: ${context.story.genre}
Chapter: ${context.story.currentChapter}
Setting: ${context.story.setting}
Current Situation: ${context.story.currentSituation}
Mood: ${context.story.mood}
Weather: ${context.story.weather}
Time: ${context.story.timeOfDay}
Tone: ${context.story.tone}
Magic System: ${context.story.magicSystem}
Technology Level: ${context.story.technologyLevel}

ACTIVE CHARACTERS:
${context.activeCharacters.map(char =>
  `- ${char.name}: ${char.description}${char.personality ? ` (${char.personality})` : ''}${char.currentState ? ` - Currently: ${char.currentState}` : ''}`
).join('\n')}

RECENT EVENTS:
${context.recentEvents.map(event =>
  `- ${event.type}: ${event.description}`
).join('\n')}

CHAPTER SUMMARIES:
${context.chapterSummaries.map(summary =>
  `- Chapter ${summary.chapter}: ${summary.summary}`
).join('\n')}

DICE HISTORY:
${context.diceHistory.map(dice =>
  `- ${dice.diceType}: ${dice.result} (${dice.interpretation})`
).join('\n')}`;

    if (context.specificDetails) {
      if (context.specificDetails.characters) {
        formatted += `\n\nSPECIFIC CHARACTER DETAILS:\n`;
        context.specificDetails.characters.forEach(char => {
          formatted += `- ${char.name}: ${char.description}\n`;
          if (char.background) formatted += `  Background: ${char.background}\n`;
          if (char.relationships?.length > 0) {
            formatted += `  Relationships: ${char.relationships.map(rel => `${rel.relationshipType} with ${rel.description}`).join(', ')}\n`;
          }
          if (char.inventory?.length > 0) {
            formatted += `  Inventory: ${char.inventory.map(item => item.name).join(', ')}\n`;
          }
        });
      }

      if (context.specificDetails.locations) {
        formatted += `\n\nSPECIFIC LOCATION DETAILS:\n`;
        context.specificDetails.locations.forEach(loc => {
          formatted += `- ${loc.name}: ${loc.description}\n`;
          if (loc.atmosphere) formatted += `  Atmosphere: ${loc.atmosphere}\n`;
          if (loc.history) formatted += `  History: ${loc.history}\n`;
        });
      }
    }

    formatted += `\n\nUSER INPUT: ${context.userInput}

RESPONSE FORMAT:
1. Brief narrative continuation (2-3 sentences)
2. Present 2-3 choices to the player
3. Ask for any additional details they want to add

Keep responses under 200 words. Focus on advancing the story naturally.`;

    return formatted;
  }

  // Generate chapter summary
  async generateChapterSummary(story, chapterNumber) {
    const chapterEvents = story.events.filter(event =>
      event.chapter === chapterNumber
    );

    if (chapterEvents.length === 0) return null;

    const summary = {
      chapter: chapterNumber,
      summary: `Chapter ${chapterNumber} involved ${chapterEvents.length} key events. `,
      keyEvents: chapterEvents.map(event => event.description),
      characters: [...new Set(chapterEvents.flatMap(event =>
        event.characters?.map(char => char.name) || []
      ))],
      locations: [...new Set(chapterEvents.flatMap(event =>
        event.locations?.map(loc => loc.name) || []
      ))],
      timestamp: new Date()
    };

    // Create a brief summary
    const eventTypes = chapterEvents.map(event => event.type);
    const uniqueTypes = [...new Set(eventTypes)];

    summary.summary += `The story featured ${uniqueTypes.join(', ')} events. `;

    if (summary.characters.length > 0) {
      summary.summary += `Key characters included: ${summary.characters.join(', ')}. `;
    }

    if (summary.locations.length > 0) {
      summary.summary += `Locations visited: ${summary.locations.join(', ')}.`;
    }

    return summary;
  }

  // Check if we need to generate a new summary
  shouldGenerateSummary(story) {
    const totalInteractions = story.stats.totalInteractions;
    return totalInteractions > 0 && totalInteractions % this.summaryInterval === 0;
  }

  // Query MongoDB for specific details
  async queryStoryDetails(storyId, query) {
    const story = await Story.findById(storyId);
    if (!story) return null;

    const queryLower = query.toLowerCase();

    // Search characters
    const characters = story.characters.filter(char =>
      char.name.toLowerCase().includes(queryLower) ||
      char.description.toLowerCase().includes(queryLower)
    );

    // Search locations
    const locations = story.locations.filter(loc =>
      loc.name.toLowerCase().includes(queryLower) ||
      loc.description.toLowerCase().includes(queryLower)
    );

    // Search events
    const events = story.events.filter(event =>
      event.description.toLowerCase().includes(queryLower)
    );

    return {
      characters,
      locations,
      events
    };
  }

  // Get character info for /char command
  async getCharacterInfo(storyId, characterName) {
    const story = await Story.findById(storyId);
    if (!story) return null;

    const character = story.characters.find(char =>
      char.name.toLowerCase() === characterName.toLowerCase()
    );

    if (!character) return null;

    return {
      name: character.name,
      description: character.description,
      personality: character.personality,
      appearance: character.appearance,
      background: character.background,
      currentState: character.currentState,
      relationships: character.relationships,
      inventory: character.inventory,
      skills: character.skills,
      isActive: character.isActive
    };
  }

  // Estimate context token count
  estimateTokenCount(context) {
    // Rough estimation: 1 token ≈ 4 characters
    return Math.ceil(context.length / 4);
  }

  // Optimize context if too long
  optimizeContext(context, maxTokens = this.maxContextLength) {
    const currentTokens = this.estimateTokenCount(context);

    if (currentTokens <= maxTokens) {
      return context;
    }

    // Reduce context by prioritizing recent information
    // This is a simplified version - in practice, you'd want more sophisticated logic
    const lines = context.split('\n');
    const priorityLines = lines.filter(line =>
      line.includes('USER INPUT:') ||
      line.includes('CURRENT SITUATION:') ||
      line.includes('ACTIVE CHARACTERS:') ||
      line.includes('RECENT EVENTS:')
    );

    return priorityLines.join('\n');
  }
}

module.exports = new ContextService();