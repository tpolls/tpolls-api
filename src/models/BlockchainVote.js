const mongoose = require('mongoose');

/**
 * BlockchainVote Model
 * Tracks votes that have been submitted to the TON blockchain
 */
const blockchainVoteSchema = new mongoose.Schema({
  // Vote identification
  voteId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  
  // Poll reference
  blockchainPollId: {
    type: Number,
    required: true,
    index: true
  },
  
  pollSyncId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'PollSync',
    required: false
  },
  
  // Voter information
  voterAddress: {
    type: String,
    required: true,
    index: true
  },
  
  // Vote details
  selectedOptionId: {
    type: Number,
    required: true,
    min: 0
  },
  
  // Blockchain transaction data
  txHash: {
    type: String,
    required: false, // May not be available immediately
    index: true
  },
  
  blockHeight: {
    type: Number,
    required: false
  },
  
  txTimestamp: {
    type: Date,
    required: false
  },
  
  gasUsed: {
    type: String, // Store as string to preserve precision
    required: false
  },
  
  gasFee: {
    type: String, // Store as string to preserve precision
    required: false
  },
  
  // Vote status
  status: {
    type: String,
    enum: [
      'pending',        // Vote submitted but not confirmed
      'confirmed',      // Vote confirmed on blockchain
      'counted',        // Vote counted in poll results
      'rewarded',       // Voter has received reward
      'failed',         // Vote transaction failed
      'invalid'         // Vote deemed invalid
    ],
    default: 'pending',
    index: true
  },
  
  // Confirmation data
  confirmations: {
    type: Number,
    default: 0
  },
  
  requiredConfirmations: {
    type: Number,
    default: 3
  },
  
  confirmedAt: {
    type: Date,
    required: false
  },
  
  // Reward information
  rewardAmount: {
    type: String, // Store as string to preserve precision
    required: false
  },
  
  rewardTxHash: {
    type: String,
    required: false
  },
  
  rewardClaimedAt: {
    type: Date,
    required: false
  },
  
  // Validation
  isValid: {
    type: Boolean,
    default: true
  },
  
  validationErrors: [{
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
  submittedFrom: {
    userAgent: String,
    ipAddress: String,
    platform: String
  },
  
  // Sync status
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  
  syncErrors: [{
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Timestamps
  createdAt: {
    type: Date,
    default: Date.now
  },
  
  updatedAt: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true,
  collection: 'blockchain_votes'
});

// Compound indexes for efficient querying
blockchainVoteSchema.index({ blockchainPollId: 1, voterAddress: 1 }, { unique: true });
blockchainVoteSchema.index({ status: 1, confirmedAt: 1 });
blockchainVoteSchema.index({ voterAddress: 1, createdAt: -1 });
blockchainVoteSchema.index({ txHash: 1 });
blockchainVoteSchema.index({ blockHeight: 1 });

// Virtual fields
blockchainVoteSchema.virtual('isConfirmed').get(function() {
  return this.confirmations >= this.requiredConfirmations && this.status === 'confirmed';
});

blockchainVoteSchema.virtual('isPending').get(function() {
  return this.status === 'pending' && this.confirmations < this.requiredConfirmations;
});

blockchainVoteSchema.virtual('hasReward').get(function() {
  return this.rewardAmount && parseFloat(this.rewardAmount) > 0;
});

blockchainVoteSchema.virtual('isRewarded').get(function() {
  return this.status === 'rewarded' && this.rewardClaimedAt;
});

// Instance methods
blockchainVoteSchema.methods.addValidationError = function(error) {
  this.validationErrors.push({
    error: error.toString(),
    timestamp: new Date()
  });
  
  // Keep only last 5 errors
  if (this.validationErrors.length > 5) {
    this.validationErrors = this.validationErrors.slice(-5);
  }
  
  this.isValid = false;
  this.status = 'invalid';
  this.updatedAt = new Date();
};

blockchainVoteSchema.methods.addSyncError = function(error) {
  this.syncErrors.push({
    error: error.toString(),
    timestamp: new Date()
  });
  
  // Keep only last 5 errors
  if (this.syncErrors.length > 5) {
    this.syncErrors = this.syncErrors.slice(-5);
  }
  
  this.updatedAt = new Date();
};

blockchainVoteSchema.methods.updateConfirmations = function(blockHeight, currentBlockHeight) {
  if (blockHeight && currentBlockHeight) {
    this.blockHeight = blockHeight;
    this.confirmations = Math.max(0, currentBlockHeight - blockHeight + 1);
    
    if (this.isConfirmed && this.status === 'pending') {
      this.status = 'confirmed';
      this.confirmedAt = new Date();
    }
  }
  this.lastSyncedAt = new Date();
  this.updatedAt = new Date();
};

blockchainVoteSchema.methods.markCounted = function() {
  if (this.status === 'confirmed') {
    this.status = 'counted';
    this.updatedAt = new Date();
  }
};

blockchainVoteSchema.methods.markRewarded = function(rewardAmount, rewardTxHash) {
  this.rewardAmount = rewardAmount;
  this.rewardTxHash = rewardTxHash;
  this.rewardClaimedAt = new Date();
  this.status = 'rewarded';
  this.updatedAt = new Date();
};

blockchainVoteSchema.methods.markFailed = function(error) {
  this.status = 'failed';
  this.addSyncError(error);
  this.updatedAt = new Date();
};

// Static methods
blockchainVoteSchema.statics.findByPoll = function(blockchainPollId) {
  return this.find({ blockchainPollId }).sort({ createdAt: -1 });
};

blockchainVoteSchema.statics.findByVoter = function(voterAddress) {
  return this.find({ voterAddress }).sort({ createdAt: -1 });
};

blockchainVoteSchema.statics.findPendingConfirmation = function() {
  return this.find({
    status: 'pending',
    txHash: { $exists: true, $ne: null },
    confirmations: { $lt: 3 }
  }).sort({ createdAt: 1 });
};

blockchainVoteSchema.statics.findConfirmedVotes = function() {
  return this.find({
    status: 'confirmed',
    confirmations: { $gte: 3 }
  }).sort({ confirmedAt: -1 });
};

blockchainVoteSchema.statics.getVoteStats = function(blockchainPollId) {
  const match = blockchainPollId ? { blockchainPollId } : {};
  
  return this.aggregate([
    { $match: match },
    {
      $group: {
        _id: {
          pollId: '$blockchainPollId',
          optionId: '$selectedOptionId',
          status: '$status'
        },
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: {
          pollId: '$_id.pollId',
          optionId: '$_id.optionId'
        },
        totalVotes: { $sum: '$count' },
        statusBreakdown: {
          $push: {
            status: '$_id.status',
            count: '$count'
          }
        }
      }
    },
    {
      $sort: {
        '_id.pollId': 1,
        '_id.optionId': 1
      }
    }
  ]);
};

blockchainVoteSchema.statics.hasUserVoted = function(voterAddress, blockchainPollId) {
  return this.findOne({
    voterAddress,
    blockchainPollId,
    status: { $in: ['pending', 'confirmed', 'counted', 'rewarded'] }
  });
};

blockchainVoteSchema.statics.getPollResults = function(blockchainPollId) {
  return this.aggregate([
    {
      $match: {
        blockchainPollId,
        status: { $in: ['confirmed', 'counted', 'rewarded'] }
      }
    },
    {
      $group: {
        _id: '$selectedOptionId',
        voteCount: { $sum: 1 },
        voters: { $push: '$voterAddress' }
      }
    },
    {
      $sort: { '_id': 1 }
    }
  ]);
};

module.exports = mongoose.model('BlockchainVote', blockchainVoteSchema);