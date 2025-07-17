const mongoose = require('mongoose');

/**
 * PollSync Model
 * Tracks synchronization between AI-generated polls (MongoDB) and blockchain polls (TON)
 */
const pollSyncSchema = new mongoose.Schema({
  // Reference to AI-generated poll
  aiPollId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'AiGeneratedPoll',
    required: true,
    index: true
  },
  
  // Blockchain poll reference
  blockchainPollId: {
    type: Number,
    required: false, // null until successfully registered
    index: true
  },
  
  // Sync status tracking
  syncStatus: {
    type: String,
    enum: [
      'pending',           // Waiting to be registered on blockchain
      'registering',       // Currently being registered
      'registered',        // Successfully registered on blockchain
      'syncing',          // Syncing data between systems
      'synced',           // Fully synchronized
      'failed',           // Registration or sync failed
      'cancelled'         // Registration cancelled
    ],
    default: 'pending',
    index: true
  },
  
  // Registration attempts
  registrationAttempts: {
    type: Number,
    default: 0,
    max: 5
  },
  
  maxRegistrationAttempts: {
    type: Number,
    default: 3
  },
  
  // Transaction data
  registrationTxHash: {
    type: String,
    required: false
  },
  
  registrationTxPayload: {
    type: String,
    required: false
  },
  
  contractAddress: {
    type: String,
    required: false
  },
  
  // Timing
  lastAttemptAt: {
    type: Date,
    required: false
  },
  
  registeredAt: {
    type: Date,
    required: false
  },
  
  lastSyncAt: {
    type: Date,
    required: false
  },
  
  nextRetryAt: {
    type: Date,
    required: false
  },
  
  // Error tracking
  errors: [{
    type: {
      type: String,
      enum: ['registration', 'sync', 'validation', 'network'],
      required: true
    },
    message: {
      type: String,
      required: true
    },
    details: mongoose.Schema.Types.Mixed,
    timestamp: {
      type: Date,
      default: Date.now
    },
    resolved: {
      type: Boolean,
      default: false
    }
  }],
  
  // Retry configuration
  retryConfig: {
    backoffMultiplier: {
      type: Number,
      default: 2
    },
    maxRetryDelay: {
      type: Number,
      default: 3600000 // 1 hour in milliseconds
    },
    baseRetryDelay: {
      type: Number,
      default: 60000 // 1 minute in milliseconds
    }
  },
  
  // Metadata
  createdBy: {
    type: String,
    required: false // User ID or system identifier
  },
  
  metadata: {
    userAgent: String,
    ipAddress: String,
    requestId: String
  },
  
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
  collection: 'poll_syncs'
});

// Indexes for efficient querying
pollSyncSchema.index({ syncStatus: 1, nextRetryAt: 1 });
pollSyncSchema.index({ registrationAttempts: 1, syncStatus: 1 });
pollSyncSchema.index({ aiPollId: 1, blockchainPollId: 1 });
pollSyncSchema.index({ createdAt: -1 });
pollSyncSchema.index({ lastAttemptAt: 1 });

// Virtual fields
pollSyncSchema.virtual('canRetry').get(function() {
  return this.registrationAttempts < this.maxRegistrationAttempts && 
         this.syncStatus === 'failed' &&
         (!this.nextRetryAt || new Date() >= this.nextRetryAt);
});

pollSyncSchema.virtual('isExpired').get(function() {
  return this.registrationAttempts >= this.maxRegistrationAttempts;
});

pollSyncSchema.virtual('currentRetryDelay').get(function() {
  const baseDelay = this.retryConfig.baseRetryDelay;
  const multiplier = this.retryConfig.backoffMultiplier;
  const maxDelay = this.retryConfig.maxRetryDelay;
  
  const delay = baseDelay * Math.pow(multiplier, this.registrationAttempts);
  return Math.min(delay, maxDelay);
});

// Instance methods
pollSyncSchema.methods.addError = function(type, message, details = null) {
  this.errors.push({
    type,
    message,
    details,
    timestamp: new Date(),
    resolved: false
  });
  
  // Keep only last 20 errors
  if (this.errors.length > 20) {
    this.errors = this.errors.slice(-20);
  }
  
  this.updatedAt = new Date();
};

pollSyncSchema.methods.markErrorResolved = function(errorId) {
  const error = this.errors.id(errorId);
  if (error) {
    error.resolved = true;
    this.updatedAt = new Date();
  }
};

pollSyncSchema.methods.incrementAttempt = function() {
  this.registrationAttempts += 1;
  this.lastAttemptAt = new Date();
  
  if (this.registrationAttempts >= this.maxRegistrationAttempts) {
    this.syncStatus = 'failed';
    this.nextRetryAt = null;
  } else {
    this.syncStatus = 'failed';
    this.nextRetryAt = new Date(Date.now() + this.currentRetryDelay);
  }
  
  this.updatedAt = new Date();
};

pollSyncSchema.methods.markRegistering = function(txPayload, contractAddress) {
  this.syncStatus = 'registering';
  this.registrationTxPayload = txPayload;
  this.contractAddress = contractAddress;
  this.lastAttemptAt = new Date();
  this.updatedAt = new Date();
};

pollSyncSchema.methods.markRegistered = function(blockchainPollId, txHash) {
  this.syncStatus = 'registered';
  this.blockchainPollId = blockchainPollId;
  this.registrationTxHash = txHash;
  this.registeredAt = new Date();
  this.nextRetryAt = null;
  this.updatedAt = new Date();
};

pollSyncSchema.methods.markSynced = function() {
  this.syncStatus = 'synced';
  this.lastSyncAt = new Date();
  this.updatedAt = new Date();
};

pollSyncSchema.methods.resetForRetry = function() {
  if (this.canRetry) {
    this.syncStatus = 'pending';
    this.nextRetryAt = null;
    this.updatedAt = new Date();
  }
};

// Static methods
pollSyncSchema.statics.findPendingRegistration = function() {
  return this.find({
    syncStatus: { $in: ['pending', 'failed'] },
    $or: [
      { nextRetryAt: { $exists: false } },
      { nextRetryAt: null },
      { nextRetryAt: { $lte: new Date() } }
    ],
    registrationAttempts: { $lt: 3 }
  }).populate('aiPollId').sort({ createdAt: 1 });
};

pollSyncSchema.statics.findPendingSync = function() {
  return this.find({
    syncStatus: { $in: ['registered', 'syncing'] },
    blockchainPollId: { $exists: true, $ne: null }
  }).populate('aiPollId').sort({ lastSyncAt: 1 });
};

pollSyncSchema.statics.findByAiPoll = function(aiPollId) {
  return this.findOne({ aiPollId }).populate('aiPollId');
};

pollSyncSchema.statics.findByBlockchainPoll = function(blockchainPollId) {
  return this.findOne({ blockchainPollId }).populate('aiPollId');
};

pollSyncSchema.statics.getStats = function() {
  return this.aggregate([
    {
      $group: {
        _id: '$syncStatus',
        count: { $sum: 1 }
      }
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$count' },
        statusCounts: {
          $push: {
            status: '$_id',
            count: '$count'
          }
        }
      }
    }
  ]);
};

module.exports = mongoose.model('PollSync', pollSyncSchema);