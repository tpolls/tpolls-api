const mongoose = require('mongoose');

/**
 * BlockchainPoll Model
 * Represents polls that have been registered on the TON blockchain
 */
const blockchainPollSchema = new mongoose.Schema({
  // Blockchain identifiers
  blockchainPollId: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  
  contractAddress: {
    type: String,
    required: true
  },
  
  // Transaction data
  registrationTxHash: {
    type: String,
    required: false // May not be available immediately
  },
  
  registrationBlockHeight: {
    type: Number,
    required: false
  },
  
  // Core poll data (synced from blockchain)
  creator: {
    type: String,
    required: true
  },
  
  optionCount: {
    type: Number,
    required: true,
    min: 2,
    max: 10
  },
  
  startTime: {
    type: Date,
    required: true
  },
  
  endTime: {
    type: Date,
    required: true
  },
  
  isActive: {
    type: Boolean,
    default: true
  },
  
  // Vote and funding data
  totalVotes: {
    type: Number,
    default: 0,
    min: 0
  },
  
  rewardPerVote: {
    type: Number,
    required: true,
    min: 0
  },
  
  totalFunding: {
    type: String, // Store as string to preserve precision
    required: true
  },
  
  remainingFunds: {
    type: String,
    required: false
  },
  
  // Sync status
  lastSyncedAt: {
    type: Date,
    default: Date.now
  },
  
  syncStatus: {
    type: String,
    enum: ['synced', 'pending_sync', 'sync_failed'],
    default: 'synced'
  },
  
  syncErrors: [{
    error: String,
    timestamp: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Metadata
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
  collection: 'blockchain_polls'
});

// Indexes for efficient querying
blockchainPollSchema.index({ creator: 1 });
blockchainPollSchema.index({ isActive: 1 });
blockchainPollSchema.index({ endTime: 1 });
blockchainPollSchema.index({ syncStatus: 1 });
blockchainPollSchema.index({ lastSyncedAt: 1 });

// Methods
blockchainPollSchema.methods.isExpired = function() {
  return new Date() > this.endTime;
};

blockchainPollSchema.methods.getDaysRemaining = function() {
  const now = new Date();
  const remaining = this.endTime - now;
  return Math.max(0, Math.ceil(remaining / (1000 * 60 * 60 * 24)));
};

blockchainPollSchema.methods.addSyncError = function(error) {
  this.syncErrors.push({
    error: error.toString(),
    timestamp: new Date()
  });
  
  // Keep only last 10 errors
  if (this.syncErrors.length > 10) {
    this.syncErrors = this.syncErrors.slice(-10);
  }
  
  this.syncStatus = 'sync_failed';
  this.updatedAt = new Date();
};

blockchainPollSchema.methods.markSynced = function() {
  this.syncStatus = 'synced';
  this.lastSyncedAt = new Date();
  this.updatedAt = new Date();
};

// Static methods
blockchainPollSchema.statics.findActivePolls = function() {
  return this.find({
    isActive: true,
    endTime: { $gt: new Date() }
  }).sort({ createdAt: -1 });
};

blockchainPollSchema.statics.findByCreator = function(creatorAddress) {
  return this.find({ creator: creatorAddress }).sort({ createdAt: -1 });
};

blockchainPollSchema.statics.findPendingSync = function() {
  return this.find({
    syncStatus: { $in: ['pending_sync', 'sync_failed'] }
  }).sort({ lastSyncedAt: 1 });
};

module.exports = mongoose.model('BlockchainPoll', blockchainPollSchema);