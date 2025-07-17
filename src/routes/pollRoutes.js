const express = require('express');
const router = express.Router();
const pollController = require('../controllers/pollController');

/**
 * @route POST /api/poll-options
 * @desc Generate options for a poll question
 * @access Public
 */
router.post('/poll-options', pollController.generateOptions);

/**
 * @route POST /api/poll-ai
 * @desc Generate a poll preview using AI based on a user prompt
 * @access Public
 */
router.post('/poll-ai', pollController.generateAIPollPreview);

/**
 * @route POST /api/poll-ai-regen
 * @desc Regenerate an AI-generated poll based on user feedback
 * @access Public
 */
router.post('/poll-ai-regen', pollController.handleAIRegeneratePollAction);

module.exports = router;
