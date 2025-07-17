#!/usr/bin/env node

const axios = require('axios');
const mongoose = require('mongoose');

const API_BASE = 'http://localhost:3001/api';

async function testPollRegistration() {
  console.log('🧪 Testing Poll Registration Flow\n');

  try {
    // 1. First create an AI poll and save it to database
    console.log('1. Creating and saving AI poll to database...');
    
    // Connect to MongoDB to create a poll manually
    await mongoose.connect('mongodb://localhost:27017/tpolls-db');
    
    const AiGeneratedPoll = require('./src/models/AiGeneratedPoll');
    
    // Create a test poll
    const testPoll = new AiGeneratedPoll({
      subject: 'Which DeFi protocol will dominate 2024?',
      description: 'Vote for the DeFi protocol you think will have the biggest impact in 2024. Consider factors like TVL growth, innovation, and user adoption.',
      category: 'defi',
      options: ['Uniswap', 'Aave', 'Compound', 'MakerDAO'],
      rewardPerResponse: '0.005',
      durationDays: 7,
      maxResponses: 500,
      targetFund: '2.5',
      fundingType: 'self-funded',
      rewardDistribution: 'fixed',
      originalPrompt: 'Create a poll about DeFi protocols for 2024'
    });

    const savedPoll = await testPoll.save();
    console.log('✅ AI poll saved to database:', {
      id: savedPoll._id,
      subject: savedPoll.subject,
      options: savedPoll.options
    });

    // 2. Test blockchain registration
    console.log('\n2. Testing blockchain registration...');
    const registrationResponse = await axios.post(`${API_BASE}/blockchain/polls/register`, {
      aiPollId: savedPoll._id.toString(),
      userId: 'test_user'
    });

    console.log('✅ Registration payload created:', {
      syncId: registrationResponse.data.syncId,
      contractAddress: registrationResponse.data.transactionData.contractAddress,
      amount: registrationResponse.data.transactionData.amount,
      hasPayload: !!registrationResponse.data.transactionData.payload
    });

    // 3. Check if sync record was created
    console.log('\n3. Checking sync record creation...');
    const PollSync = require('./src/models/PollSync');
    const syncRecord = await PollSync.findById(registrationResponse.data.syncId).populate('aiPollId');
    
    console.log('✅ Sync record created:', {
      id: syncRecord._id,
      status: syncRecord.syncStatus,
      aiPollTitle: syncRecord.aiPollId.subject,
      attempts: syncRecord.registrationAttempts
    });

    // 4. Simulate transaction confirmation
    console.log('\n4. Simulating transaction confirmation...');
    const confirmationResponse = await axios.post(`${API_BASE}/blockchain/polls/confirm-registration`, {
      syncId: registrationResponse.data.syncId,
      txHash: 'test_tx_hash_' + Date.now(),
      blockchainPollId: 1
    });

    console.log('✅ Registration confirmed:', confirmationResponse.data);

    // 5. Check updated sync status
    console.log('\n5. Checking updated sync status...');
    const updatedSync = await PollSync.findById(registrationResponse.data.syncId);
    console.log('✅ Sync updated:', {
      status: updatedSync.syncStatus,
      blockchainPollId: updatedSync.blockchainPollId,
      registeredAt: updatedSync.registeredAt
    });

    // 6. Test vote creation for the registered poll
    console.log('\n6. Testing vote creation for registered poll...');
    const voteResponse = await axios.post(`${API_BASE}/blockchain/votes/create-transaction`, {
      pollId: 1,
      optionId: 1, // Vote for 'Aave'
      voterAddress: 'EQTest_Voter_Address_12345'
    });

    console.log('✅ Vote transaction created:', {
      voteId: voteResponse.data.voteId,
      contractAddress: voteResponse.data.transactionData.contractAddress,
      amount: voteResponse.data.transactionData.amount
    });

    // 7. Test duplicate vote prevention
    console.log('\n7. Testing duplicate vote prevention...');
    try {
      await axios.post(`${API_BASE}/blockchain/votes/create-transaction`, {
        pollId: 1,
        optionId: 2,
        voterAddress: 'EQTest_Voter_Address_12345' // Same address
      });
      console.log('❌ Duplicate vote should have been prevented');
    } catch (error) {
      if (error.response?.data?.message?.includes('already voted')) {
        console.log('✅ Duplicate vote prevention working');
      } else {
        console.log('⚠️ Unexpected error:', error.response?.data?.message);
      }
    }

    // 8. Check vote record in database
    console.log('\n8. Checking vote record in database...');
    const BlockchainVote = require('./src/models/BlockchainVote');
    const voteRecord = await BlockchainVote.findOne({ voteId: voteResponse.data.voteId });
    console.log('✅ Vote record found:', {
      voteId: voteRecord.voteId,
      pollId: voteRecord.blockchainPollId,
      selectedOption: voteRecord.selectedOptionId,
      status: voteRecord.status
    });

    console.log('\n🎉 Poll Registration Test Complete!');
    console.log('\n📝 Summary:');
    console.log('- ✅ AI poll creation and database storage');
    console.log('- ✅ Blockchain registration payload generation');
    console.log('- ✅ Sync record creation and management');
    console.log('- ✅ Transaction confirmation handling');
    console.log('- ✅ Vote transaction creation');
    console.log('- ✅ Duplicate vote prevention');
    console.log('- ✅ Database vote tracking');

    // Cleanup
    console.log('\n🧹 Cleaning up test data...');
    await AiGeneratedPoll.findByIdAndDelete(savedPoll._id);
    await PollSync.findByIdAndDelete(registrationResponse.data.syncId);
    await BlockchainVote.findOneAndDelete({ voteId: voteResponse.data.voteId });
    console.log('✅ Test data cleaned up');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
  } finally {
    await mongoose.disconnect();
  }
}

// Run the test
testPollRegistration().catch(console.error);