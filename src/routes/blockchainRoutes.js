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

// Poll routes (blockchain-first approach)
router.post('/polls/store-metadata', blockchainController.storePollMetadata);
router.get('/polls/active', blockchainController.getActivePolls);
router.get('/polls/:pollId', blockchainController.getBlockchainPoll);
router.get('/polls/:pollId/results', blockchainController.getPollResults);

// Voting routes
router.post('/votes/create-transaction', blockchainController.createVoteTransaction);
router.post('/votes/confirm', blockchainController.confirmVote);

module.exports = router;