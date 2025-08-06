const Story = require('../models/Story');
const aiService = require('../services/aiService');
const contextService = require('../services/contextService');
const diceService = require('../services/diceService');
const tagService = require('../services/tagService');
const characterService = require('../services/characterService');

class StoryController {
  // Start a new story with /start command
  async startStory(req, res) {
    try {
      const { userId, prompt, title, genre, description } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Story prompt is required' });
      }

      // Generate initial story setup with AI
      const setupPrompt = `
        A player wants to start a new story with the following prompt:
        "${prompt}"

        Genre: ${genre || 'Fantasy'}
        Title: ${title || 'Untitled Story'}

        Please help set up this story by asking clarifying questions about:
        1. Tone and atmosphere
        2. Level of violence/gore
        3. Magic system (if fantasy)
        4. Technology level
        5. Main character details
        6. Starting location
        7. Any specific story elements they want to include

        Ask 3-5 specific questions to help establish the world and story direction.
        Be conversational and helpful.
      `;

      const aiResponse = await aiService.generateStoryResponse(
        { title: title || 'Untitled', genre: genre || 'Fantasy' },
        setupPrompt
      );

      // Create initial story structure
      const story = new Story({
        userId,
        title: title || 'Untitled Story',
        genre: genre || 'Fantasy',
        description: description || '',
        worldState: {
          setting: 'To be determined',
          currentSituation: 'Story setup in progress',
          mood: 'neutral',
          weather: 'clear',
          timeOfDay: 'morning'
        },
        aiContext: {
          lastPrompt: setupPrompt,
          worldRules: '',
          storyTone: 'adventure',
          magicSystem: '',
          technologyLevel: 'medieval'
        },
        status: 'setup',
        stats: {
          totalInteractions: 0,
          totalDiceRolls: 0,

          lastActive: new Date()
        }
      });

      await story.save();

      res.json({
        storyId: story._id,
        aiResponse: aiResponse.content,
        setupQuestions: aiResponse.content,
        cost: aiResponse.cost
      });

    } catch (error) {
      console.error('Error starting story:', error);
      res.status(500).json({ error: 'Failed to start story' });
    }
  }

  // Handle special commands like /char, /info, /timeout, /checkpoint, /back
  async handleSpecialCommand(req, res, story, userInput) {
    const command = userInput.toLowerCase().trim();

    if (command.startsWith('/checkpoint')) {
      // Create a checkpoint
      const checkpoint = {
        id: Date.now().toString(),
        timestamp: new Date(),
        events: [...story.events],
        worldState: { ...story.worldState },
        characters: [...story.characters],
        locations: [...story.locations],
        description: userInput.replace('/checkpoint', '').trim() || 'Checkpoint'
      };

      if (!story.checkpoints) {
        story.checkpoints = [];
      }
      story.checkpoints.push(checkpoint);
      await story.save();

      return res.json({
        type: 'checkpoint_created',
        checkpoint: checkpoint,
        message: `Checkpoint "${checkpoint.description}" created.`
      });
    }

    if (command.startsWith('/back')) {
      // Go back to a checkpoint
      const checkpointId = userInput.replace('/back', '').trim();

      if (!story.checkpoints || story.checkpoints.length === 0) {
        return res.json({
          type: 'error',
          message: 'No checkpoints available. Use /checkpoint to create one.'
        });
      }

      let targetCheckpoint;
      if (checkpointId) {
        // Find specific checkpoint by ID or description
        targetCheckpoint = story.checkpoints.find(cp =>
          cp.id === checkpointId ||
          cp.description.toLowerCase().includes(checkpointId.toLowerCase())
        );
      } else {
        // Use the most recent checkpoint
        targetCheckpoint = story.checkpoints[story.checkpoints.length - 1];
      }

      if (!targetCheckpoint) {
        return res.json({
          type: 'error',
          message: 'Checkpoint not found. Available checkpoints: ' +
            story.checkpoints.map(cp => `${cp.description} (${cp.id})`).join(', ')
        });
      }

      // Restore story state
      story.events = [...targetCheckpoint.events];
      story.worldState = { ...targetCheckpoint.worldState };
      story.characters = [...targetCheckpoint.characters];
      story.locations = [...targetCheckpoint.locations];
      story.stats.lastActive = new Date();
      await story.save();

      return res.json({
        type: 'checkpoint_restored',
        checkpoint: targetCheckpoint,
        message: `Restored to checkpoint "${targetCheckpoint.description}".`
      });
    }

    if (command.startsWith('/list-checkpoints')) {
      // List all checkpoints
      if (!story.checkpoints || story.checkpoints.length === 0) {
        return res.json({
          type: 'error',
          message: 'No checkpoints available. Use /checkpoint to create one.'
        });
      }

      return res.json({
        type: 'checkpoint_list',
        checkpoints: story.checkpoints.map(cp => ({
          id: cp.id,
          description: cp.description,
          timestamp: cp.timestamp,
          eventCount: cp.events.length
        }))
      });
    }

    if (command.startsWith('/char')) {
      // Get character info
      const characterName = command.replace('/char', '').trim();
      if (!characterName) {
        const characters = await characterService.getCharacterContext(story._id);
        return res.json({
          type: 'character_list',
          characters: characters
        });
      }

      const character = await characterService.getCharacterInfo(story._id, characterName);

      if (!character) {
        return res.json({
          type: 'error',
          message: `Character "${characterName}" not found.`
        });
      }

      return res.json({
        type: 'character_info',
        character: character
      });
    }

    if (command.startsWith('/info')) {
      // Get location or item info
      const searchTerm = command.replace('/info', '').trim();
      if (!searchTerm) {
        return res.json({
          type: 'error',
          message: 'Please specify what to search for: /info [location/item name]'
        });
      }

      // Search in locations
      const location = story.locations.find(loc =>
        loc.name.toLowerCase().includes(searchTerm.toLowerCase())
      );

      if (location) {
        return res.json({
          type: 'location_info',
          location: location
        });
      }

      return res.json({
        type: 'error',
        message: `No information found for "${searchTerm}".`
      });
    }

    if (command.startsWith('/timeout')) {
      // Meta-discussion without affecting story
      return res.json({
        type: 'timeout',
        message: 'Time-out called. This is a meta-discussion that won\'t affect the story. What would you like to discuss?'
      });
    }



    if (command.startsWith('/end')) {
      // End the story
      story.status = 'completed';
      story.stats.lastActive = new Date();
      await story.save();

      return res.json({
        type: 'story_ended',
        message: 'Story has been marked as completed.'
      });
    }

    if (command === '/reset-scene') {
      // Reset the current situation to break out of deadlocks
      story.worldState.currentSituation = 'The situation has shifted. You find yourself in a new moment, the previous tension having dissipated.';
      await story.save();
      return res.json({
        type: 'scene_reset',
        message: 'Scene has been reset. The situation has changed.',
        story: story
      });
    }

    return res.json({
      type: 'error',
      message: 'Unknown command. Available commands: /char, /info, /timeout, /end'
    });
  }

  // Continue story with user input
  async continueStory(req, res) {
    try {
      const { storyId } = req.params;
      const { userInput, diceRoll } = req.body;

      console.log('continueStory called with:', { storyId, userInput, diceRoll });

      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      console.log('Story found, status:', story.status);

      // Handle special commands
      if (userInput.startsWith('/')) {
        console.log('Handling special command:', userInput);
        const command = userInput.toLowerCase().trim();
        console.log('Normalized command:', command);

        if (command.startsWith('/checkpoint')) {
          // Create a checkpoint
          const checkpoint = {
            id: Date.now().toString(),
            timestamp: new Date(),
            events: [...story.events],
            worldState: { ...story.worldState },
            characters: [...story.characters],
            locations: [...story.locations],
            description: userInput.replace('/checkpoint', '').trim() || 'Checkpoint'
          };

          if (!story.checkpoints) {
            story.checkpoints = [];
          }
          story.checkpoints.push(checkpoint);
          await story.save();

          return res.json({
            type: 'checkpoint_created',
            checkpoint: checkpoint,
            message: `Checkpoint "${checkpoint.description}" created.`
          });
        }

        if (command.startsWith('/back')) {
          // Go back to a checkpoint
          const checkpointId = userInput.replace('/back', '').trim();

          if (!story.checkpoints || story.checkpoints.length === 0) {
            return res.json({
              type: 'error',
              message: 'No checkpoints available. Use /checkpoint to create one.'
            });
          }

          let targetCheckpoint;
          if (checkpointId) {
            // Find specific checkpoint by ID or description
            targetCheckpoint = story.checkpoints.find(cp =>
              cp.id === checkpointId ||
              cp.description.toLowerCase().includes(checkpointId.toLowerCase())
            );
          } else {
            // Use the most recent checkpoint
            targetCheckpoint = story.checkpoints[story.checkpoints.length - 1];
          }

          if (!targetCheckpoint) {
            return res.json({
              type: 'error',
              message: 'Checkpoint not found. Available checkpoints: ' +
                story.checkpoints.map(cp => `${cp.description} (${cp.id})`).join(', ')
            });
          }

          // Restore story state
          story.events = [...targetCheckpoint.events];
          story.worldState = { ...targetCheckpoint.worldState };
          story.characters = [...targetCheckpoint.characters];
          story.locations = [...targetCheckpoint.locations];
          story.stats.lastActive = new Date();
          await story.save();

          return res.json({
            type: 'checkpoint_restored',
            checkpoint: targetCheckpoint,
            message: `Restored to checkpoint "${targetCheckpoint.description}".`
          });
        }

        if (command.startsWith('/list-checkpoints')) {
          // List all checkpoints
          if (!story.checkpoints || story.checkpoints.length === 0) {
            return res.json({
              type: 'error',
              message: 'No checkpoints available. Use /checkpoint to create one.'
            });
          }

          return res.json({
            type: 'checkpoint_list',
            checkpoints: story.checkpoints.map(cp => ({
              id: cp.id,
              description: cp.description,
              timestamp: cp.timestamp,
              eventCount: cp.events.length
            }))
          });
        }

        if (command.startsWith('/char')) {
          // Get character info
          const characterName = command.replace('/char', '').trim();
          if (!characterName) {
            const characters = await characterService.getCharacterContext(story._id);
            return res.json({
              type: 'character_list',
              characters: characters
            });
          }

          const character = await characterService.getCharacterInfo(story._id, characterName);

          if (!character) {
            return res.json({
              type: 'error',
              message: `Character "${characterName}" not found.`
            });
          }

          return res.json({
            type: 'character_info',
            character: character
          });
        }

        if (command.startsWith('/info')) {
          // Get location or item info
          const searchTerm = command.replace('/info', '').trim();
          if (!searchTerm) {
            return res.json({
              type: 'error',
              message: 'Please specify what to search for: /info [location/item name]'
            });
          }

          // Search in locations
          const location = story.locations.find(loc =>
            loc.name.toLowerCase().includes(searchTerm.toLowerCase())
          );

          if (location) {
            return res.json({
              type: 'location_info',
              location: location
            });
          }

          return res.json({
            type: 'error',
            message: `No information found for "${searchTerm}".`
          });
        }

        if (command.startsWith('/timeout')) {
          // Meta-discussion without affecting story
          return res.json({
            type: 'timeout',
            message: 'Time-out called. This is a meta-discussion that won\'t affect the story. What would you like to discuss?'
          });
        }



        if (command.startsWith('/end')) {
          // End the story
          story.status = 'completed';
          story.stats.lastActive = new Date();
          await story.save();

          return res.json({
            type: 'story_ended',
            message: 'Story has been marked as completed.'
          });
        }

        if (command === '/reset-scene') {
          console.log('Executing /reset-scene command');
          // Reset the current situation to break out of deadlocks
          story.worldState.currentSituation = 'The situation has shifted. You find yourself in a new moment, the previous tension having dissipated.';

          // Generate a new AI response for the reset scene
          console.log('Generating new AI response for reset scene...');
          const aiResponse = await aiService.generateStoryResponse(story, 'Continue the story from this new situation', null);

          // Add the AI response as an event
          const newEvent = {
            type: 'narrative',
            description: aiResponse.content,
            timestamp: new Date(),
            diceResults: []
          };

          story.events.push(newEvent);
          story.stats.totalInteractions++;
          story.stats.lastActive = new Date();

          await story.save();
          console.log('Scene reset completed with new AI response');

          return res.json({
            type: 'scene_reset',
            message: 'Scene has been reset. The situation has changed.',
            aiResponse: aiResponse.content,
            story: story
          });
        }

        return res.json({
          type: 'error',
          message: 'Unknown command. Available commands: /char, /info, /timeout, /end'
        });
      }

      // Handle setup phase
      if (story.status === 'setup') {
        console.log('Handling setup phase');
        try {
          // Generate AI response for setup questions
          const aiResponse = await aiService.generateStoryResponse(story, userInput);

          // Update story with setup response
          const newEvent = {
            type: 'narrative',
            description: aiResponse.content,
            timestamp: new Date()
          };

          story.events.push(newEvent);
          story.stats.totalInteractions++;
          story.stats.lastActive = new Date();

          // Check if setup is complete (AI indicates story can begin)
          const setupComplete = aiResponse.content.toLowerCase().includes('let\'s begin') ||
                               aiResponse.content.toLowerCase().includes('story begins') ||
                               aiResponse.content.toLowerCase().includes('adventure starts') ||
                               aiResponse.content.toLowerCase().includes('let\'s start the story');

          if (setupComplete) {
            story.status = 'active';
            story.worldState.currentSituation = 'Story has begun';
          }

          await story.save();

          return res.json({
            aiResponse: aiResponse.content,
            status: story.status
          });
        } catch (error) {
          console.error('Error in setup phase:', error);
          return res.status(500).json({ error: 'Failed to process setup' });
        }
      }

      console.log('Handling regular story continuation');

                  // Check if user input needs a dice roll
      let diceResult = null;
      const diceKeywords = [
        'attack', 'fight', 'combat', 'battle', 'hit', 'strike',
        'persuade', 'convince', 'negotiate', 'bargain', 'bribe',
        'stealth', 'sneak', 'hide', 'conceal',
        'investigate', 'search', 'examine', 'inspect', 'open', 'take', 'grab', 'collect',
        'survive', 'navigate', 'find', 'locate',
        'repair', 'fix', 'craft', 'build',
        'climb', 'jump', 'run', 'escape',
        'lockpick', 'hack', 'disable',
        'heal', 'treat', 'cure',
        'cast', 'spell', 'magic',
        'shoot', 'aim', 'fire',
        'enter', 'approach', 'go to', 'walk to', 'move to'
      ];

      const input = userInput.toLowerCase();
      const needsRoll = diceKeywords.some(keyword => input.includes(keyword));

      if (needsRoll) {
        console.log('Dice roll needed for:', userInput);

        // Determine situation type
        let situation = 'investigation'; // Default to investigation for most actions
        if (input.includes('attack') || input.includes('fight') || input.includes('combat')) {
          situation = 'combat';
        } else if (input.includes('persuade') || input.includes('convince') || input.includes('negotiate')) {
          situation = 'persuasion';
        } else if (input.includes('stealth') || input.includes('sneak') || input.includes('hide')) {
          situation = 'stealth';
        } else if (input.includes('investigate') || input.includes('search') || input.includes('examine') || input.includes('open') || input.includes('take') || input.includes('grab') || input.includes('collect')) {
          situation = 'investigation';
        } else if (input.includes('survive') || input.includes('navigate') || input.includes('find') || input.includes('locate')) {
          situation = 'survival';
        }

        diceResult = diceService.rollForSituation(situation);
        console.log('Dice result:', diceResult);

        // Store dice result in story
        story.diceResults.push(diceResult);
        story.stats.totalDiceRolls++;
      }

      // Store user's input as an event first
      const userEvent = {
        type: 'dialogue',
        description: `Player chose: ${userInput}`,
        timestamp: new Date(),
        diceResults: diceResult ? [diceResult] : []
      };
      story.events.push(userEvent);

      // Generate AI response with optimized context and dice result
      console.log('Building optimized context...');
      const context = await contextService.buildContext(story, userInput, diceResult);
      console.log('Generating AI response...');
      const aiResponse = await aiService.generateStoryResponse(story, userInput, diceResult);

      // Extract and save tags from AI response
      const tags = tagService.extractTags(aiResponse.content, storyId, 'narrative');
      await tagService.saveTags(storyId, tags);

      // Extract and save characters from AI response
      const characters = characterService.extractCharacters(aiResponse.content, storyId);
      await characterService.saveCharacters(storyId, characters);

      console.log('AI response received, updating story...');

      // Update story with AI response event
      const newEvent = {
        type: 'narrative',
        description: aiResponse.content,
        timestamp: new Date(),
        diceResults: []
      };

      story.events.push(newEvent);
      story.stats.totalInteractions++;
      story.stats.lastActive = new Date();

      // Simple situation update
      story.worldState.currentSituation = 'Story continues...';

      console.log('Saving story...');
      console.log('Events count before save:', story.events.length);
      console.log('Last event:', story.events[story.events.length - 1]);

      await story.save();
      console.log('Story saved successfully');

      // Verify the save worked by reloading the story
      const savedStory = await Story.findById(story._id);
      console.log('Events count after save:', savedStory.events.length);
      console.log('Last saved event:', savedStory.events[savedStory.events.length - 1]);
      console.log('Sending response...');

      res.json({
        aiResponse: aiResponse.content,
        diceResult: diceResult,
        currentChapter: story.worldState.currentChapter
      });

    } catch (error) {
      console.error('Error continuing story:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({ error: 'Failed to continue story' });
    }
  }

  // Determine if user input needs a dice roll
  needsDiceRoll = (userInput) => {
    const diceKeywords = [
      'attack', 'fight', 'combat', 'battle', 'hit', 'strike',
      'persuade', 'convince', 'negotiate', 'bargain', 'bribe',
      'stealth', 'sneak', 'hide', 'conceal',
      'investigate', 'search', 'examine', 'inspect',
      'survive', 'navigate', 'find', 'locate',
      'repair', 'fix', 'craft', 'build',
      'climb', 'jump', 'run', 'escape',
      'lockpick', 'hack', 'disable',
      'heal', 'treat', 'cure',
      'cast', 'spell', 'magic',
      'shoot', 'aim', 'fire'
    ];

    const input = userInput.toLowerCase();
    return diceKeywords.some(keyword => input.includes(keyword));
  }

  // Determine the type of situation for dice rolling
  determineSituation = (userInput) => {
    const input = userInput.toLowerCase();

    if (input.includes('attack') || input.includes('fight') || input.includes('combat')) {
      return 'combat';
    } else if (input.includes('persuade') || input.includes('convince') || input.includes('negotiate')) {
      return 'social';
    } else if (input.includes('stealth') || input.includes('sneak') || input.includes('hide')) {
      return 'stealth';
    } else if (input.includes('investigate') || input.includes('search') || input.includes('examine')) {
      return 'investigation';
    } else if (input.includes('repair') || input.includes('fix') || input.includes('craft')) {
      return 'technical';
    } else if (input.includes('heal') || input.includes('treat') || input.includes('cure')) {
      return 'medical';
    } else if (input.includes('cast') || input.includes('spell') || input.includes('magic')) {
      return 'magical';
    } else {
      return 'general';
    }
  }

  // Extract current situation from AI response
  extractCurrentSituation(aiResponse) {
    // Simple extraction - take the first sentence or first 100 characters
    const firstSentence = aiResponse.split('.')[0];
    return firstSentence.length > 100 ? firstSentence.substring(0, 100) + '...' : firstSentence;
  }

  // Test endpoint to debug issues
  async testEndpoint(req, res) {
    try {
      console.log('Test endpoint called');

      // Test basic functionality
      console.log('Testing Story model...');
      const testStory = await Story.findById('6892311348766ff4a2c3c6c1');
      console.log('Story found:', !!testStory);

      console.log('Testing contextService...');
      const context = await contextService.buildContext(testStory, 'test');
      console.log('Context built successfully');

      console.log('Testing aiService...');
      const aiResponse = await aiService.generateStoryResponse(testStory, 'test');
      console.log('AI response generated successfully');

      res.json({
        status: 'All tests passed',
        storyFound: !!testStory,
        contextLength: context.length,
        aiResponseLength: aiResponse.content.length
      });

    } catch (error) {
      console.error('Test endpoint error:', error);
      console.error('Error stack:', error.stack);
      res.status(500).json({
        error: 'Test failed',
        message: error.message,
        stack: error.stack
      });
    }
  }

  // Get all stories for a user
  async getUserStories(req, res) {
    try {
      const { userId } = req.params;

      const stories = await Story.find({ userId })
        .select('title genre status stats worldState createdAt updatedAt')
        .sort({ updatedAt: -1 });

      res.json(stories);
    } catch (error) {
      console.error('Error getting user stories:', error);
      res.status(500).json({ error: 'Failed to get stories' });
    }
  }

  // Get specific story details
  async getStory(req, res) {
    try {
      const { storyId } = req.params;

      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      res.json(story);
    } catch (error) {
      console.error('Error getting story:', error);
      res.status(500).json({ error: 'Failed to get story' });
    }
  }

  // Update story status
  async updateStoryStatus(req, res) {
    try {
      const { storyId } = req.params;
      const { status } = req.body;

      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      story.status = status;
      await story.save();

      res.json({ message: 'Story status updated', status });
    } catch (error) {
      console.error('Error updating story status:', error);
      res.status(500).json({ error: 'Failed to update story status' });
    }
  }

  // Get story summary
  async getStorySummary(req, res) {
    try {
      const { storyId } = req.params;

      const story = await Story.findById(storyId);
      if (!story) {
        return res.status(404).json({ error: 'Story not found' });
      }

      // Combine all summaries into a comprehensive story summary
      const allSummaries = story.storySummaries.map(summary =>
        summary.summary
      ).join('\n\n');

      const currentSituation = story.worldState.currentSituation;
      const totalInteractions = story.stats.totalInteractions;

      // Extract all keywords and important details
      const allKeywords = {
        characters: [],
        locations: [],
        items: [],
        concepts: [],
        events: []
      };

      const allImportantDetails = [];

      for (const summary of story.storySummaries) {
        // Combine keywords
        for (const [category, keywords] of Object.entries(summary.keywords)) {
          allKeywords[category] = [...new Set([...allKeywords[category], ...keywords])];
        }

        // Combine important details
        allImportantDetails.push(...summary.importantDetails);
      }

      // Sort important details by relevance
      allImportantDetails.sort((a, b) => {
        const relevanceOrder = { high: 3, medium: 2, low: 1 };
        return relevanceOrder[b.relevance] - relevanceOrder[a.relevance];
      });

      res.json({
        title: story.title,
        genre: story.genre,
        currentSituation,
        totalInteractions,
        summary: allSummaries || 'No summaries available yet.',
        keywords: allKeywords,
        importantDetails: allImportantDetails,
        lastUpdated: story.updatedAt
      });

    } catch (error) {
      console.error('Error getting story summary:', error);
      res.status(500).json({ error: 'Failed to get story summary' });
    }
  }
}

module.exports = new StoryController();