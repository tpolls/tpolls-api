const cron = require('node-cron');
const tonService = require('./tonService');
const config = require('../config/config');
const AiGeneratedPoll = require('../models/AiGeneratedPoll');
const BlockchainPoll = require('../models/BlockchainPoll');
const PollSync = require('../models/PollSync');
const BlockchainVote = require('../models/BlockchainVote');

/**
 * Blockchain Synchronization Service
 * Handles automatic synchronization between TON blockchain and MongoDB
 */
class BlockchainSyncService {
  constructor() {
    this.isRunning = false;
    this.syncTasks = [];
    this.lastSyncTime = null;
    this.syncStats = {
      pollsProcessed: 0,
      votesProcessed: 0,
      errors: 0,
      lastRun: null
    };
  }

  /**
   * Start the synchronization service
   */
  start() {
    console.log('Starting Blockchain Sync Service...');
    
    // Schedule sync tasks based on configuration
    const intervalMinutes = config.sync.intervalMinutes;
    const cronExpression = `*/${intervalMinutes} * * * *`;
    
    // Main sync task
    const syncTask = cron.schedule(cronExpression, async () => {
      if (!this.isRunning) {
        await this.runFullSync();
      }
    }, {
      scheduled: false
    });

    // Vote confirmation task (runs more frequently)
    const voteConfirmTask = cron.schedule('*/2 * * * *', async () => {
      if (!this.isRunning) {
        await this.syncVoteConfirmations();
      }
    }, {
      scheduled: false
    });

    this.syncTasks = [syncTask, voteConfirmTask];
    
    // Start all tasks
    this.syncTasks.forEach(task => task.start());
    
    console.log(`Blockchain sync service started with ${intervalMinutes} minute intervals`);
  }

  /**
   * Stop the synchronization service
   */
  stop() {
    console.log('Stopping Blockchain Sync Service...');
    this.syncTasks.forEach(task => task.stop());
    this.syncTasks = [];
    console.log('Blockchain sync service stopped');
  }

  /**
   * Run a full synchronization cycle
   */
  async runFullSync() {
    if (this.isRunning) {
      console.log('Sync already running, skipping...');
      return;
    }

    this.isRunning = true;
    const startTime = Date.now();
    
    try {
      console.log('Starting full blockchain synchronization...');
      
      // Initialize stats for this run
      const runStats = {
        pollsProcessed: 0,
        votesProcessed: 0,
        errors: 0
      };

      // 1. Process pending poll registrations
      await this.processPendingRegistrations(runStats);
      
      // 2. Sync blockchain polls to database
      await this.syncBlockchainPolls(runStats);
      
      // 3. Sync vote confirmations
      await this.syncVoteConfirmations(runStats);
      
      // 4. Update poll statuses
      await this.updatePollStatuses(runStats);

      // Update overall stats
      this.syncStats.pollsProcessed += runStats.pollsProcessed;
      this.syncStats.votesProcessed += runStats.votesProcessed;
      this.syncStats.errors += runStats.errors;
      this.syncStats.lastRun = new Date();
      this.lastSyncTime = Date.now();

      const duration = Date.now() - startTime;
      console.log(`Full sync completed in ${duration}ms:`, runStats);

    } catch (error) {
      console.error('Error during full sync:', error);
      this.syncStats.errors++;
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Process pending poll registrations
   */
  async processPendingRegistrations(stats) {
    try {
      const pendingRegistrations = await PollSync.findPendingRegistration();
      console.log(`Processing ${pendingRegistrations.length} pending registrations`);

      for (const pollSync of pendingRegistrations) {
        try {
          // Check if we should retry this registration
          if (!pollSync.canRetry) {
            continue;
          }

          const aiPoll = pollSync.aiPollId;
          if (!aiPoll) {
            pollSync.addError('validation', 'AI poll not found');
            await pollSync.save();
            continue;
          }

          console.log(`Processing registration for AI poll: ${aiPoll._id}`);

          // Increment attempt counter
          pollSync.incrementAttempt();
          await pollSync.save();
          
          stats.pollsProcessed++;

        } catch (error) {
          console.error(`Error processing registration for poll ${pollSync._id}:`, error);
          pollSync.addError('registration', error.message);
          await pollSync.save();
          stats.errors++;
        }
      }

    } catch (error) {
      console.error('Error processing pending registrations:', error);
      stats.errors++;
    }
  }

  /**
   * Sync blockchain polls to database
   */
  async syncBlockchainPolls(stats) {
    try {
      // Get active polls from blockchain
      const activePolls = await tonService.getActivePolls();
      console.log(`Syncing ${activePolls.length} active polls from blockchain`);

      for (const pollData of activePolls) {
        try {
          const blockchainPollId = pollData.blockchainPollId || pollData.id;
          
          // Check if poll exists in database
          let blockchainPoll = await BlockchainPoll.findOne({ blockchainPollId });
          
          if (!blockchainPoll) {
            // Create new blockchain poll record
            blockchainPoll = new BlockchainPoll({
              blockchainPollId,
              contractAddress: tonService.contractAddress,
              creator: pollData.creator,
              optionCount: pollData.optionCount,
              startTime: new Date(pollData.startTime * 1000),
              endTime: new Date(pollData.endTime * 1000),
              isActive: pollData.isActive,
              totalVotes: pollData.totalVotes,
              rewardPerVote: pollData.rewardPerVote,
              totalFunding: pollData.fundData?.totalFunds || '0.000 TON'
            });
          } else {
            // Update existing record
            blockchainPoll.totalVotes = pollData.totalVotes;
            blockchainPoll.isActive = pollData.isActive;
            blockchainPoll.lastSyncedAt = new Date();
          }

          await blockchainPoll.save();
          blockchainPoll.markSynced();
          await blockchainPoll.save();
          
          stats.pollsProcessed++;

        } catch (error) {
          console.error(`Error syncing poll ${pollData.blockchainPollId}:`, error);
          stats.errors++;
        }
      }

    } catch (error) {
      console.error('Error syncing blockchain polls:', error);
      stats.errors++;
    }
  }

  /**
   * Sync vote confirmations from blockchain
   */
  async syncVoteConfirmations(stats) {
    try {
      const pendingVotes = await BlockchainVote.findPendingConfirmation();
      console.log(`Checking confirmations for ${pendingVotes.length} pending votes`);

      for (const vote of pendingVotes) {
        try {
          if (!vote.txHash) {
            continue;
          }

          // TODO: Implement actual blockchain transaction checking
          // For now, simulate confirmation after 2 minutes
          const age = Date.now() - vote.createdAt.getTime();
          if (age > 120000) { // 2 minutes
            vote.updateConfirmations(12345, 12348); // Mock block heights
            
            if (vote.isConfirmed) {
              vote.markCounted();
            }
            
            await vote.save();
            stats.votesProcessed++;
          }

        } catch (error) {
          console.error(`Error checking vote confirmation ${vote.voteId}:`, error);
          vote.addSyncError(error.message);
          await vote.save();
          stats.errors++;
        }
      }

    } catch (error) {
      console.error('Error syncing vote confirmations:', error);
      stats.errors++;
    }
  }

  /**
   * Update poll statuses based on end times
   */
  async updatePollStatuses(stats) {
    try {
      const now = new Date();
      
      // Mark expired polls as inactive
      const expiredPolls = await BlockchainPoll.find({
        isActive: true,
        endTime: { $lt: now }
      });

      for (const poll of expiredPolls) {
        poll.isActive = false;
        poll.lastSyncedAt = now;
        await poll.save();
        stats.pollsProcessed++;
      }

      if (expiredPolls.length > 0) {
        console.log(`Marked ${expiredPolls.length} polls as expired`);
      }

    } catch (error) {
      console.error('Error updating poll statuses:', error);
      stats.errors++;
    }
  }

  /**
   * Get sync service statistics
   */
  getStats() {
    return {
      ...this.syncStats,
      isRunning: this.isRunning,
      lastSyncDuration: this.lastSyncTime ? Date.now() - this.lastSyncTime : null,
      uptime: Date.now() - (this.syncStats.lastRun || Date.now())
    };
  }

  /**
   * Force a specific poll to sync
   */
  async forcePollSync(blockchainPollId) {
    try {
      console.log(`Force syncing poll ${blockchainPollId}`);
      
      const pollData = await tonService.getPollFromBlockchain(blockchainPollId);
      
      let blockchainPoll = await BlockchainPoll.findOne({ blockchainPollId });
      
      if (!blockchainPoll) {
        blockchainPoll = new BlockchainPoll({
          blockchainPollId,
          contractAddress: tonService.contractAddress,
          creator: pollData.creator,
          optionCount: pollData.optionCount,
          startTime: new Date(pollData.startTime * 1000),
          endTime: new Date(pollData.endTime * 1000),
          isActive: pollData.isActive,
          totalVotes: pollData.totalVotes,
          rewardPerVote: pollData.rewardPerVote,
          totalFunding: pollData.fundData?.totalFunds || '0.000 TON'
        });
      } else {
        blockchainPoll.totalVotes = pollData.totalVotes;
        blockchainPoll.isActive = pollData.isActive;
        blockchainPoll.lastSyncedAt = new Date();
      }

      await blockchainPoll.save();
      blockchainPoll.markSynced();
      await blockchainPoll.save();
      
      return blockchainPoll;

    } catch (error) {
      console.error(`Error force syncing poll ${blockchainPollId}:`, error);
      throw error;
    }
  }

  /**
   * Check if service is healthy
   */
  isHealthy() {
    const now = Date.now();
    const lastRunAge = this.syncStats.lastRun ? now - this.syncStats.lastRun.getTime() : null;
    const maxAge = config.sync.intervalMinutes * 60 * 1000 * 2; // 2x interval
    
    return {
      healthy: !lastRunAge || lastRunAge < maxAge,
      lastRunAge,
      maxAge,
      errorRate: this.syncStats.errors / Math.max(1, this.syncStats.pollsProcessed + this.syncStats.votesProcessed)
    };
  }
}

// Export singleton instance
const syncService = new BlockchainSyncService();
module.exports = syncService;