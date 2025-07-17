const express = require('express');
const blockchainController = require('../controllers/blockchainController');

const router = express.Router();

/**
 * Blockchain Routes
 * All routes for TON blockchain integration
 */

// Service management routes
router.post('/init', blockchainController.initializeTonService);
router.get('/status', blockchainController.getContractStatus);
router.get('/sync-status', blockchainController.getSyncStatus);
router.post('/sync', blockchainController.triggerSync);

// Poll registration routes
router.post('/polls/register', blockchainController.registerPollOnBlockchain);
router.post('/polls/confirm-registration', blockchainController.confirmPollRegistration);
router.get('/polls/active', blockchainController.getActivePolls);
router.get('/polls/:pollId', blockchainController.getBlockchainPoll);
router.get('/polls/:pollId/results', blockchainController.getPollResults);

// Voting routes
router.post('/votes/create-transaction', blockchainController.createVoteTransaction);
router.post('/votes/confirm', blockchainController.confirmVote);

module.exports = router;