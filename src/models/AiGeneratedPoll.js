const mongoose = require('mongoose');

const aiGeneratedPollSchema = new mongoose.Schema({
  subject: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  category: {
    type: String,
    required: true,
    enum: ['art', 'design', 'tech', 'defi', 'lifestyle', 'environment', 'web3', 'food', 'other'],
    default: 'other'
  },
  viewType: {
    type: String,
    default: 'text',
    enum: ['text', 'gallery']
  },
  options: {
    type: [String],
    required: true,
    validate: {
      validator: function(v) {
        return v.length >= 2;
      },
      message: 'Poll must have at least 2 options'
    }
  },
  rewardPerResponse: {
    type: String,
    default: '0.001'
  },
  durationDays: {
    type: Number,
    default: 7,
    min: 1,
    max: 365
  },
  maxResponses: {
    type: Number,
    default: 100,
    min: 1
  },
  minContribution: {
    type: String,
    default: '0.0001'
  },
  fundingType: {
    type: String,
    default: 'self-funded',
    enum: ['self-funded', 'crowdfunded', 'unfunded']
  },
  isOpenImmediately: {
    type: Boolean,
    default: true
  },
  targetFund: {
    type: String,
    default: '0.1'
  },
  rewardToken: {
    type: String,
    default: '0x0000000000000000000000000000000000000000'
  },
  rewardDistribution: {
    type: String,
    default: 'split',
    enum: ['split', 'fixed', 'none']
  },
  originalPrompt: {
    type: String,
    required: true,
    trim: true
  },
  status: {
    type: String,
    default: 'pending',
    enum: ['pending', 'registered', 'failed']
  },
  blockchainPollId: {
    type: Number,
    default: null
  },
  registrationAttempts: {
    type: Number,
    default: 0,
    min: 0
  },
  lastRegistrationAttempt: {
    type: Date,
    default: null
  },
  errorMessage: {
    type: String,
    default: null
  },
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
  collection: 'ai-generated-polls'
});

// Index for efficient querying
aiGeneratedPollSchema.index({ status: 1, createdAt: 1 });
aiGeneratedPollSchema.index({ originalPrompt: 'text', subject: 'text', description: 'text' });

// Pre-save middleware to update the updatedAt field
aiGeneratedPollSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

module.exports = mongoose.model('AiGeneratedPoll', aiGeneratedPollSchema); 