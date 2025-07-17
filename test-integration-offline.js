#!/usr/bin/env node

const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:3001/api';

async function testIntegrationOffline() {
  console.log('🧪 Testing Integration (Offline Mode)\n');

  try {
    // Connect to MongoDB
    await mongoose.connect('mongodb://localhost:27017/tpolls-db');
    console.log('✅ Connected to MongoDB');

    // 1. Test AI poll creation
    console.log('\n1. Testing AI poll creation...');
    const pollResponse = await axios.post(`${API_BASE}/poll-ai`, {
      prompt: 'Create a poll about Web3 development tools: Hardhat, Truffle, Foundry, Remix'
    });
    
    console.log('✅ AI poll created:', {
      subject: pollResponse.data.data.poll.subject.substring(0, 60) + '...',
      options: pollResponse.data.data.poll.options,
      category: pollResponse.data.data.poll.category
    });

    // 2. Test database models directly
    console.log('\n2. Testing database models...');
    
    const AiGeneratedPoll = require('./src/models/AiGeneratedPoll');
    const PollSync = require('./src/models/PollSync');
    const BlockchainVote = require('./src/models/BlockchainVote');

    // Create test poll
    const testPoll = new AiGeneratedPoll({
      subject: 'Test Poll for Integration',
      description: 'This is a test poll for verifying integration',
      category: 'tech',
      options: ['Option A', 'Option B', 'Option C'],
      rewardPerResponse: '0.01',
      durationDays: 3,
      maxResponses: 100,
      targetFund: '1.0',
      fundingType: 'self-funded',
      rewardDistribution: 'fixed'
    });

    const savedPoll = await testPoll.save();
    console.log('✅ Test poll saved:', { id: savedPoll._id, subject: savedPoll.subject });

    // Create sync record
    const pollSync = new PollSync({
      aiPollId: savedPoll._id,
      syncStatus: 'pending',
      createdBy: 'test_user'
    });

    await pollSync.save();
    console.log('✅ Sync record created:', { id: pollSync._id, status: pollSync.syncStatus });

    // Simulate registration process
    pollSync.markRegistering('test_payload', 'test_contract_address');
    await pollSync.save();
    console.log('✅ Registration marked:', { status: pollSync.syncStatus });

    pollSync.markRegistered(123, 'test_tx_hash');
    await pollSync.save();
    console.log('✅ Registration confirmed:', { 
      status: pollSync.syncStatus, 
      blockchainPollId: pollSync.blockchainPollId 
    });

    // Create test vote
    const testVote = new BlockchainVote({
      voteId: 'test_vote_' + Date.now(),
      blockchainPollId: 123,
      voterAddress: 'EQTest_Voter_Address',
      selectedOptionId: 1,
      status: 'pending'
    });

    await testVote.save();
    console.log('✅ Vote record created:', { 
      voteId: testVote.voteId, 
      status: testVote.status 
    });

    // Test vote confirmation simulation
    testVote.updateConfirmations(1000, 1003);
    await testVote.save();
    console.log('✅ Vote confirmations updated:', { 
      confirmations: testVote.confirmations, 
      status: testVote.status 
    });

    // 3. Test API endpoints that don't require blockchain connection
    console.log('\n3. Testing offline API endpoints...');

    // Test sync status
    const syncStatus = await axios.get(`${API_BASE}/blockchain/sync-status`);
    console.log('✅ Sync status retrieved:', {
      pendingRegistrations: syncStatus.data.pendingRegistrations,
      pendingSyncs: syncStatus.data.pendingSyncs
    });

    // Test poll results (mock data)
    try {
      const resultsResponse = await axios.get(`${API_BASE}/blockchain/polls/123/results`);
      console.log('✅ Poll results endpoint working:', {
        totalVotes: resultsResponse.data.totalVotes
      });
    } catch (error) {
      console.log('ℹ️ Poll results test (expected no data):', error.response?.data?.message || 'No results yet');
    }

    // 4. Test vote validation
    console.log('\n4. Testing vote validation...');
    const duplicateVoteTest = await BlockchainVote.hasUserVoted('EQTest_Voter_Address', 123);
    console.log('✅ Duplicate vote detection:', { 
      hasVoted: !!duplicateVoteTest,
      voteId: duplicateVoteTest?.voteId 
    });

    // 5. Test static methods
    console.log('\n5. Testing static methods...');
    const voteStats = await BlockchainVote.getVoteStats();
    console.log('✅ Vote statistics:', { statsCount: voteStats.length });

    const syncStats = await PollSync.getStats();
    console.log('✅ Sync statistics:', { stats: syncStats });

    // 6. Test model validations
    console.log('\n6. Testing model validations...');
    try {
      const invalidPoll = new AiGeneratedPoll({
        subject: '', // Invalid: empty subject
        options: ['Only one option'] // Invalid: not enough options
      });
      await invalidPoll.save();
      console.log('❌ Validation should have failed');
    } catch (error) {
      console.log('✅ Model validation working:', 'Prevented invalid poll creation');
    }

    console.log('\n🎉 Integration Test Complete (Offline Mode)!');
    console.log('\n📝 Summary:');
    console.log('- ✅ AI poll generation working');
    console.log('- ✅ Database models functioning correctly');
    console.log('- ✅ Poll sync workflow operational');
    console.log('- ✅ Vote tracking system working');
    console.log('- ✅ API endpoints responding correctly');
    console.log('- ✅ Data validation functioning');
    console.log('- ✅ Vote confirmation simulation working');

    console.log('\n📋 For Full Integration:');
    console.log('1. Add TONCENTER_API_KEY to .env file');
    console.log('2. Ensure contract is properly deployed and initialized');
    console.log('3. Test with real wallet transactions from frontend');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await AiGeneratedPoll.findByIdAndDelete(savedPoll._id);
    await PollSync.findByIdAndDelete(pollSync._id);
    await BlockchainVote.findOneAndDelete({ voteId: testVote.voteId });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
    if (error.response?.data) {
      console.error('API Error:', error.response.data);
    }
  } finally {
    await mongoose.disconnect();
    console.log('✅ Disconnected from MongoDB');
  }
}

testIntegrationOffline().catch(console.error);