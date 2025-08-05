const express = require('express');
const router = express.Router();
const storyController = require('../controllers/storyController');

// Start a new story
router.post('/start', storyController.startStory);

// Continue an existing story
router.post('/:storyId/continue', storyController.continueStory);

// Get all stories for a user
router.get('/user/:userId', storyController.getUserStories);

// Get specific story details
router.get('/:storyId', storyController.getStory);

// Update story status
router.patch('/:storyId/status', storyController.updateStoryStatus);

module.exports = router;