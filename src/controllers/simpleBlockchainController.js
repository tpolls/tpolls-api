const simpleTonService = require('../services/simpleTonService');
const AiGeneratedPoll = require('../models/AiGeneratedPoll');
const BlockchainPoll = require('../models/BlockchainPoll');
const BlockchainVote = require('../models/BlockchainVote');

/**
 * Simple Blockchain Controller
 * Handles operations with the new simplified TON contract
 * Contract only stores: poll creator, poll ID, and vote results
 */
class SimpleBlockchainController {

  /**
   * Initialize Simple TON service connection
   */
  async initializeTonService(req, res) {
    try {
      const success = await simpleTonService.init();
      
      if (success) {
        const status = await simpleTonService.getContractStatus();
        res.json({
          success: true,
          message: 'Simple TON service initialized successfully',
          contractStatus: status
        });
      } else {
        res.status(500).json({
          success: false,
          message: 'Failed to initialize Simple TON service'
        });
      }
    } catch (error) {
      console.error('Error initializing Simple TON service:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to initialize Simple TON service',
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
   * Create poll transaction (returns transaction payload for frontend)
   */
  async createPollTransaction(req, res) {
    try {
      const { optionCount, createdBy } = req.body;
      
      if (!optionCount || optionCount < 2 || optionCount > 10) {
        return res.status(400).json({
          success: false,
          message: 'Option count must be between 2 and 10'
        });
      }

      // Get next poll ID from contract
      const nextPollId = await simpleTonService.getNextPollId();

      // Create transaction payload
      const transactionData = await simpleTonService.createPoll(optionCount);
      
      res.json({
        success: true,
        message: 'Poll creation transaction prepared',
        nextPollId,
        transactionData
      });

    } catch (error) {
      console.error('Error creating poll transaction:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create poll transaction',
        error: error.message
      });
    }
  }

  /**
   * Store poll metadata after successful blockchain creation
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
      
      if (!blockchainPollId || !transactionHash) {
        return res.status(400).json({
          success: false,
          message: 'Blockchain poll ID and transaction hash are required'
        });
      }

      // Store basic blockchain poll record for tracking
      const blockchainPoll = new BlockchainPoll({
        blockchainPollId,
        contractAddress: contractAddress || simpleTonService.contractAddress,
        registrationTxHash: transactionHash,
        creator: createdBy,
        optionCount: pollData?.optionCount || 2,
        startTime: new Date(),
        endTime: pollData?.endTime ? new Date(pollData.endTime) : new Date(Date.now() + 7 * 24 * 3600 * 1000), // 7 days default
        isActive: true,
        totalVotes: 0,
        syncStatus: 'synced'
      });

      await blockchainPoll.save();

      // If AI data is provided, link it to the blockchain poll
      let aiPollRecord = null;
      if (aiData) {
        try {
          // Update existing AI poll or create new one
          aiPollRecord = await AiGeneratedPoll.findByIdAndUpdate(
            aiData._id || aiData.id,
            { 
              blockchainPollId: blockchainPollId,
              status: 'registered'
            },
            { new: true, upsert: false }
          );

          // If no existing AI poll found, create a new record
          if (!aiPollRecord) {
            aiPollRecord = new AiGeneratedPoll({
              subject: aiData.subject || pollData?.title || 'Blockchain Poll',
              description: aiData.description || pollData?.description || '',
              category: aiData.category || 'other',
              options: aiData.options || [],
              rewardPerResponse: aiData.rewardPerResponse || '0',
              durationDays: aiData.durationDays || 7,
              maxResponses: aiData.maxResponses || 1000,
              targetFund: aiData.targetFund || '0',
              originalPrompt: aiData.originalPrompt || 'Created via blockchain',
              blockchainPollId: blockchainPollId,
              status: 'registered'
            });

            await aiPollRecord.save();
          }
        } catch (aiError) {
          console.warn('Failed to save/update AI poll record:', aiError);
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
   * Get poll data (combines blockchain data with metadata)
   */
  async getPoll(req, res) {
    try {
      const { pollId } = req.params;
      
      if (!pollId || isNaN(pollId)) {
        return res.status(400).json({
          success: false,
          message: 'Valid poll ID is required'
        });
      }

      const blockchainPollId = parseInt(pollId);
      
      // Get poll data from blockchain
      const blockchainPoll = await simpleTonService.getPoll(blockchainPollId);
      
      if (!blockchainPoll) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found on blockchain'
        });
      }

      // Get metadata from database
      const mongoMetadata = await BlockchainPoll.findOne({ blockchainPollId });
      const aiPollData = await AiGeneratedPoll.findOne({ blockchainPollId });

      // Get poll results
      const results = await simpleTonService.getPollResults(blockchainPollId);

      res.json({
        success: true,
        poll: {
          // Core blockchain data
          id: blockchainPoll.id,
          creator: blockchainPoll.creator.toString(),
          totalVotes: blockchainPoll.totalVotes,
          isActive: blockchainPoll.isActive,
          optionCount: blockchainPoll.optionCount,
          
          // Enhanced metadata (from MongoDB)
          title: aiPollData?.subject || `Poll ${blockchainPoll.id}`,
          description: aiPollData?.description || 'No description available',
          options: aiPollData?.options || Array.from({ length: blockchainPoll.optionCount }, (_, i) => `Option ${i + 1}`),
          category: aiPollData?.category || 'general',
          
          // Timestamps (from MongoDB metadata)
          startTime: mongoMetadata?.startTime || new Date(),
          endTime: mongoMetadata?.endTime || new Date(),
          
          // Results from blockchain
          results: results?.results || []
        },
        metadata: {
          mongoRecord: mongoMetadata?._id,
          aiRecord: aiPollData?._id,
          hasAiData: !!aiPollData
        }
      });

    } catch (error) {
      console.error('Error getting poll:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get poll',
        error: error.message
      });
    }
  }

  /**
   * Get all active polls
   */
  async getActivePolls(req, res) {
    try {
      // Get active polls from blockchain with better error handling
      let blockchainPolls = [];
      
      try {
        blockchainPolls = await simpleTonService.getActivePolls();
        console.log(`Found ${blockchainPolls.length} active polls on blockchain`);
      } catch (blockchainError) {
        console.error('Error fetching polls from blockchain:', blockchainError);
        // Continue with empty array - we'll still check for metadata-only polls
      }
      
      // Also get polls from database that might not be on blockchain yet
      const aiPolls = await AiGeneratedPoll.find({ status: 'registered' });
      const mongoPolls = await BlockchainPoll.find({ isActive: true });
      
      // Combine and enhance polls
      const allPollIds = new Set([
        ...blockchainPolls.map(p => p.id),
        ...aiPolls.map(p => p.blockchainPollId).filter(id => id),
        ...mongoPolls.map(p => p.blockchainPollId).filter(id => id)
      ]);
      
      const enhancedPolls = await Promise.all(
        Array.from(allPollIds).map(async (pollId) => {
          const blockchainPoll = blockchainPolls.find(p => p.id === pollId);
          const aiData = await AiGeneratedPoll.findOne({ blockchainPollId: pollId });
          const mongoData = await BlockchainPoll.findOne({ blockchainPollId: pollId });
          
          return {
            id: pollId,
            creator: blockchainPoll?.creator?.toString() || mongoData?.creator || 'Unknown',
            totalVotes: blockchainPoll?.totalVotes || 0,
            isActive: blockchainPoll?.isActive ?? mongoData?.isActive ?? true,
            optionCount: blockchainPoll?.optionCount || aiData?.options?.length || 2,
            
            // Enhanced metadata
            title: aiData?.subject || `Poll ${pollId}`,
            description: aiData?.description || 'No description',
            options: aiData?.options || [],
            category: aiData?.category || 'general',
            
            // Metadata flags
            hasAiData: !!aiData,
            hasMetadata: !!mongoData,
            onBlockchain: !!blockchainPoll
          };
        })
      );

      res.json({
        success: true,
        polls: enhancedPolls,
        count: enhancedPolls.length,
        debug: {
          blockchainPolls: blockchainPolls.length,
          aiPolls: aiPolls.length,
          mongoPolls: mongoPolls.length
        }
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
   * Create vote transaction
   */
  async createVoteTransaction(req, res) {
    try {
      const { pollId, optionIndex, voterAddress } = req.body;
      
      if (!pollId || optionIndex === undefined || !voterAddress) {
        return res.status(400).json({
          success: false,
          message: 'Poll ID, option index, and voter address are required'
        });
      }

      const blockchainPollId = parseInt(pollId);
      if (isNaN(blockchainPollId)) {
        return res.status(400).json({
          success: false,
          message: 'Invalid poll ID: must be a number'
        });
      }

      // Check if poll exists
      const poll = await simpleTonService.getPoll(blockchainPollId);
      if (!poll) {
        return res.status(404).json({
          success: false,
          message: 'Poll not found'
        });
      }

      if (!poll.isActive) {
        return res.status(400).json({
          success: false,
          message: 'Poll is not active'
        });
      }

      // Validate option index
      if (optionIndex < 0 || optionIndex >= poll.optionCount) {
        return res.status(400).json({
          success: false,
          message: `Invalid option index. Must be between 0 and ${poll.optionCount - 1}`
        });
      }

      // Check if user has already voted (from blockchain)
      const hasVoted = await simpleTonService.hasUserVoted(voterAddress, blockchainPollId);
      if (hasVoted) {
        return res.status(400).json({
          success: false,
          message: 'User has already voted on this poll'
        });
      }

      // Create vote transaction
      const transactionData = await simpleTonService.createVoteTransaction(blockchainPollId, optionIndex);
      
      // Create vote record for tracking
      const voteId = `${blockchainPollId}_${voterAddress}_${Date.now()}`;
      const blockchainVote = new BlockchainVote({
        voteId,
        blockchainPollId,
        voterAddress,
        selectedOptionId: optionIndex,
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
        transactionData
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
      vote.status = 'submitted';
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
   * Get poll results with vote breakdown
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
      
      // Get results from blockchain
      const blockchainResults = await simpleTonService.getPollResults(blockchainPollId);
      
      if (!blockchainResults) {
        return res.status(404).json({
          success: false,
          message: 'Poll results not found'
        });
      }

      // Get metadata for option labels
      const aiPollData = await AiGeneratedPoll.findOne({ blockchainPollId });
      
      // Enhance results with option labels
      const enhancedResults = blockchainResults.results.map((result, index) => ({
        optionIndex: result.optionIndex,
        optionText: aiPollData?.options?.[index] || `Option ${index + 1}`,
        voteCount: result.voteCount,
        percentage: blockchainResults.totalVotes > 0 
          ? ((result.voteCount / blockchainResults.totalVotes) * 100).toFixed(1)
          : '0.0'
      }));

      res.json({
        success: true,
        pollId: blockchainPollId,
        totalVotes: blockchainResults.totalVotes,
        isActive: blockchainResults.isActive,
        results: enhancedResults,
        metadata: {
          hasOptionLabels: !!aiPollData?.options,
          pollTitle: aiPollData?.subject || `Poll ${blockchainPollId}`
        }
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
   * Get contract statistics
   */
  async getContractStats(req, res) {
    try {
      const totalPolls = await simpleTonService.getTotalPolls();
      const nextPollId = await simpleTonService.getNextPollId();
      const activePolls = await simpleTonService.getActivePolls();
      
      res.json({
        success: true,
        stats: {
          totalPolls,
          nextPollId,
          activePolls: activePolls.length,
          contractAddress: simpleTonService.contractAddress
        }
      });

    } catch (error) {
      console.error('Error getting contract stats:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to get contract stats',
        error: error.message
      });
    }
  }
}

module.exports = new SimpleBlockchainController();