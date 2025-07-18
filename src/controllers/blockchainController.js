const simpleTonService = require('../services/simpleTonService');
const AiGeneratedPoll = require('../models/AiGeneratedPoll');
const BlockchainPoll = require('../models/BlockchainPoll');
const PollSync = require('../models/PollSync');
const BlockchainVote = require('../models/BlockchainVote');

/**
 * Blockchain Controller
 * Handles all blockchain-related operations for the TPolls platform
 */
class BlockchainController {
  /**
   * Initialize TON service connection
   */
  async initializeTonService(req, res) {
    try {
      const success = await simpleTonService.init();
      
      if (success) {
        const status = await simpleTonService.getContractStatus();
        res.json({
          success: true,
          message: 'TON service initialized successfully',
          contractStatus: status
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to initialize TON service'
        });
      }
    } catch (error) {
      console.error('Error initializing TON service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize TON service',
        error: error.message
      });
    }
  }

  /**
   * Get blockchain contract status
   */
  async getContractStatus(req, res) {
    try {
      const status = await simpleTonService.getContractStatus();
      res.json({
        success: true,
        status
      });
    } catch (error) {
      console.error('Error getting contract status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get contract status',
        error: error.message
      });
    }
  }

  /**
   * Store poll metadata after blockchain creation
   */
  async storePollMetadata(req, res) {
    try {
      const { 
        blockchainPollId, 
        transactionHash, 
        contractAddress, 
        aiData, 
        pollData, 
        createdBy 
      } = req.body;
      
      if (!blockchainPollId || !transactionHash || !pollData) {
        return res.status(400).json({
          success: false,
          message: 'Blockchain poll ID, transaction hash, and poll data are required'
        });
      }

      // Create blockchain poll record
      const blockchainPoll = new BlockchainPoll({
        blockchainPollId,
        contractAddress,
        registrationTxHash: transactionHash,
        creator: createdBy,
        optionCount: pollData.options?.length || 0,
        startTime: new Date(),
        endTime: new Date(Date.now() + (pollData.duration || 86400) * 1000),
        isActive: true,
        totalVotes: 0,
        rewardPerVote: parseFloat(pollData.rewardPerVote || '0.01') * 1000000000, // Convert to nanoTON
        totalFunding: pollData.totalFunding || '1.0',
        syncStatus: 'synced'
      });

      await blockchainPoll.save();

      // If AI data is provided, create a connection record
      let aiPollRecord = null;
      if (aiData) {
        try {
          aiPollRecord = new AiGeneratedPoll({
            subject: aiData.subject,
            description: aiData.description,
            category: aiData.category || 'other',
            options: aiData.options,
            rewardPerResponse: aiData.rewardPerResponse,
            durationDays: aiData.durationDays,
            maxResponses: aiData.maxResponses,
            targetFund: aiData.targetFund,
            fundingType: aiData.fundingType || 'self-funded',
            rewardDistribution: aiData.rewardDistribution || 'fixed',
            originalPrompt: aiData.originalPrompt || 'Created via blockchain',
            blockchainPollId: blockchainPollId,
            status: 'registered'
          });

          await aiPollRecord.save();
        } catch (aiError) {
          console.warn('Failed to save AI poll record:', aiError);
        }
      }

      res.json({
        success: true,
        message: 'Poll metadata stored successfully',
        blockchainPoll: blockchainPoll._id,
        aiPoll: aiPollRecord?._id,
        blockchainPollId
      });

    } catch (error) {
      console.error('Error storing poll metadata:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to store poll metadata',
        error: error.message
      });
    }
  }

  /**
   * Get poll data from blockchain
   */
  async getBlockchainPoll(req, res) {
    try {
      const { pollId } = req.params;
      
      if (!pollId || isNaN(pollId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid poll ID is required'
        });
      }

      const blockchainPollId = parseInt(pollId);
      
      // Try to get from database first
      let blockchainPoll = await BlockchainPoll.findOne({ blockchainPollId });
      
      // If not in database, fetch from blockchain
      if (!blockchainPoll) {
        const pollData = await simpleTonService.getPoll(blockchainPollId);
        
        // Save to database for caching
        blockchainPoll = new BlockchainPoll({
          blockchainPollId,
          contractAddress: simpleTonService.contractAddress,
          creator: pollData.creator,
          optionCount: pollData.optionCount,
          startTime: new Date(),
          endTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days default
          isActive: pollData.isActive,
          totalVotes: pollData.totalVotes,
          rewardPerVote: 0,
          totalFunding: '0.000 TON'
        });
        
        await blockchainPoll.save();
      }

      // Get corresponding AI poll data if available
      const pollSync = await PollSync.findByBlockchainPoll(blockchainPollId);
      let aiPollData = null;
      
      if (pollSync) {
        aiPollData = await AiGeneratedPoll.findById(pollSync.aiPollId);
      }

      res.json({
        success: true,
        blockchainPoll,
        aiPollData,
        syncInfo: pollSync
      });

    } catch (error) {
      console.error('Error getting blockchain poll:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get blockchain poll',
        error: error.message
      });
    }
  }

  /**
   * Get all active polls (combined blockchain and AI data)
   */
  async getActivePolls(req, res) {
    try {
      const { source = 'both' } = req.query; // 'blockchain', 'ai', or 'both'
      
      let polls = [];

      if (source === 'blockchain' || source === 'both') {
        // Get polls from blockchain
        const blockchainPolls = await simpleTonService.getActivePolls();
        console.log('blockchainPolls', blockchainPolls)
        
        // Enhance with AI data where available
        for (const blockchainPoll of blockchainPolls) {
          const pollSync = await PollSync.findByBlockchainPoll(blockchainPoll.id);
          let aiPollData = null;
          
          if (pollSync) {
            aiPollData = await AiGeneratedPoll.findById(pollSync.aiPollId);
          }

          polls.push({
            type: 'blockchain',
            id: blockchainPoll.id,
            blockchainData: blockchainPoll,
            aiData: aiPollData,
            syncInfo: pollSync
          });
        }
      }

      if (source === 'ai' || source === 'both') {
        // Get AI polls that haven't been registered yet
        const unregisteredAiPolls = await AiGeneratedPoll.find({
          status: { $ne: 'registered' }
        }).sort({ createdAt: -1 }).limit(10);

        for (const aiPoll of unregisteredAiPolls) {
          const pollSync = await PollSync.findByAiPoll(aiPoll._id);
          
          polls.push({
            type: 'ai',
            id: aiPoll._id,
            aiData: aiPoll,
            blockchainData: null,
            syncInfo: pollSync
          });
        }
      }

      res.json({
        success: true,
        polls,
        count: polls.length
      });

    } catch (error) {
      console.error('Error getting active polls:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get active polls',
        error: error.message
      });
    }
  }

  /**
   * Create vote transaction payload (simplified for blockchain poll IDs)
   */
  async createVoteTransaction(req, res) {
    try {
      const { pollId, optionId, voterAddress } = req.body;
      
      if (!pollId || optionId === undefined || !voterAddress) {
        return res.status(400).json({
          success: false,
          message: 'Poll ID, option ID, and voter address are required'
        });
      }

      // Validate that pollId is a number (blockchain poll ID)
      const blockchainPollId = parseInt(pollId);
      if (isNaN(blockchainPollId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid poll ID: must be a numeric blockchain poll ID'
        });
      }

      // Check if user has already voted on this poll
      const existingVote = await BlockchainVote.hasUserVoted(voterAddress, blockchainPollId);
      if (existingVote) {
        return res.status(400).json({
          success: false,
          message: 'User has already voted on this poll'
        });
      }

      // Create vote transaction payload
      const voteTransaction = await simpleTonService.createVoteTransaction(blockchainPollId, optionId);
      
      // Create vote record
      const voteId = `${blockchainPollId}_${voterAddress}_${Date.now()}`;
      const blockchainVote = new BlockchainVote({
        voteId,
        blockchainPollId,
        voterAddress,
        selectedOptionId: optionId,
        status: 'pending',
        submittedFrom: {
          userAgent: req.get('User-Agent'),
          ipAddress: req.ip,
          platform: req.body.platform || 'web'
        }
      });

      await blockchainVote.save();

      res.json({
        success: true,
        message: 'Vote transaction created',
        voteId: blockchainVote.voteId,
        transactionData: voteTransaction
      });

    } catch (error) {
      console.error('Error creating vote transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create vote transaction',
        error: error.message
      });
    }
  }

  /**
   * Confirm vote after transaction is sent
   */
  async confirmVote(req, res) {
    try {
      const { voteId, txHash } = req.body;
      
      if (!voteId || !txHash) {
        return res.status(400).json({
          success: false,
          message: 'Vote ID and transaction hash are required'
        });
      }

      const vote = await BlockchainVote.findOne({ voteId });
      if (!vote) {
        return res.status(404).json({
          success: false,
          message: 'Vote not found'
        });
      }

      // Update vote with transaction hash
      vote.txHash = txHash;
      vote.txTimestamp = new Date();
      vote.lastSyncedAt = new Date();
      await vote.save();

      res.json({
        success: true,
        message: 'Vote confirmation recorded',
        voteStatus: vote.status
      });

    } catch (error) {
      console.error('Error confirming vote:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to confirm vote',
        error: error.message
      });
    }
  }

  /**
   * Get poll results
   */
  async getPollResults(req, res) {
    try {
      const { pollId } = req.params;
      
      if (!pollId || isNaN(pollId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid poll ID is required'
        });
      }

      const blockchainPollId = parseInt(pollId);
      
      // Get results from database
      const results = await BlockchainVote.getPollResults(blockchainPollId);
      
      // Get poll info
      const pollSync = await PollSync.findByBlockchainPoll(blockchainPollId);
      let pollInfo = null;
      
      if (pollSync) {
        pollInfo = await AiGeneratedPoll.findById(pollSync.aiPollId);
      }

      res.json({
        success: true,
        pollId: blockchainPollId,
        results,
        pollInfo,
        totalVotes: results.reduce((sum, option) => sum + option.voteCount, 0)
      });

    } catch (error) {
      console.error('Error getting poll results:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get poll results',
        error: error.message
      });
    }
  }

  /**
   * Get synchronization status
   */
  async getSyncStatus(req, res) {
    try {
      // Get overall sync statistics
      const syncStats = await PollSync.getStats();
      
      // Get pending registrations
      const pendingRegistrations = await PollSync.findPendingRegistration();
      
      // Get pending syncs
      const pendingSyncs = await PollSync.findPendingSync();

      res.json({
        success: true,
        stats: syncStats[0] || { total: 0, statusCounts: [] },
        pendingRegistrations: pendingRegistrations.length,
        pendingSyncs: pendingSyncs.length,
        lastUpdated: new Date()
      });

    } catch (error) {
      console.error('Error getting sync status:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get sync status',
        error: error.message
      });
    }
  }

  /**
   * Manually trigger synchronization
   */
  async triggerSync(req, res) {
    try {
      const { type = 'all' } = req.body; // 'registration', 'vote_sync', or 'all'
      
      let results = {
        registrations: 0,
        syncs: 0,
        errors: []
      };

      if (type === 'registration' || type === 'all') {
        // Process pending registrations
        const pendingRegistrations = await PollSync.findPendingRegistration();
        results.registrations = pendingRegistrations.length;
        
        // Note: Actual processing would be done by background service
        console.log(`Found ${pendingRegistrations.length} pending registrations`);
      }

      if (type === 'vote_sync' || type === 'all') {
        // Process pending vote syncs
        const pendingVotes = await BlockchainVote.findPendingConfirmation();
        results.syncs = pendingVotes.length;
        
        // Note: Actual processing would be done by background service
        console.log(`Found ${pendingVotes.length} pending vote confirmations`);
      }

      res.json({
        success: true,
        message: 'Sync triggered successfully',
        results
      });

    } catch (error) {
      console.error('Error triggering sync:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to trigger sync',
        error: error.message
      });
    }
  }
}

module.exports = new BlockchainController();