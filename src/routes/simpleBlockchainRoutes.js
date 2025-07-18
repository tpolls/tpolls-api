const express = require('express');
const simpleBlockchainController = require('../controllers/simpleBlockchainController');

const router = express.Router();

/**
 * Simple Blockchain Routes
 * Routes for the new simplified TON contract
 * Contract only stores: poll creator, poll ID, and vote results
 */

// Service management routes
router.post('/init', simpleBlockchainController.initializeTonService);
router.get('/status', simpleBlockchainController.getContractStatus);
router.get('/stats', simpleBlockchainController.getContractStats);

// Poll creation routes (blockchain-first)
router.post('/polls/create-transaction', simpleBlockchainController.createPollTransaction);
router.post('/polls/store-metadata', simpleBlockchainController.storePollMetadata);

// Poll data routes
router.get('/polls/active', simpleBlockchainController.getActivePolls);
router.get('/polls/:pollId', simpleBlockchainController.getPoll);
router.get('/polls/:pollId/results', simpleBlockchainController.getPollResults);

// Voting routes
router.post('/votes/create-transaction', simpleBlockchainController.createVoteTransaction);
router.post('/votes/confirm', simpleBlockchainController.confirmVote);

module.exports = router;