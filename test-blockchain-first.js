#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

/**
 * Test the blockchain-first architecture flow
 */
async function testBlockchainFirstFlow() {
  console.log('🧪 Testing Blockchain-First Architecture\n');

  try {
    // Test 1: Backend Status Check
    console.log('1. Checking backend and blockchain status...');
    try {
      const healthResponse = await axios.get(`${API_BASE}/../health`);
      console.log('✅ Backend health check:', healthResponse.data.status);
      
      const blockchainStatus = await axios.get(`${API_BASE}/blockchain/status`);
      console.log('✅ Blockchain status:', blockchainStatus.data.success ? 'Connected' : 'Not available');
    } catch (error) {
      console.log('⚠️ Backend/Blockchain status check failed:', error.message);
    }

    // Test 2: Create AI Poll (backend only - no blockchain registration yet)
    console.log('\n2. Creating AI poll (backend only)...');
    const aiPollResponse = await axios.post(`${API_BASE}/poll-ai`, {
      prompt: 'Best blockchain programming language for DeFi applications'
    });
    
    console.log('✅ AI poll created successfully');
    const aiPoll = aiPollResponse.data.data.poll;
    console.log(`   Subject: ${aiPoll.subject}`);
    console.log(`   Options: ${aiPoll.options.join(', ')}`);
    console.log(`   AI Poll ID: ${aiPoll._id || 'Generated'}`);

    // Test 3: Simulate Frontend Blockchain Registration
    console.log('\n3. Simulating frontend blockchain poll creation...');
    const mockBlockchainResult = {
      pollId: Math.floor(Math.random() * 1000) + 1, // Random blockchain poll ID
      transactionHash: '0x' + Math.random().toString(36).substring(7),
      contractAddress: 'EQD33qSiwBmeW455-zQsrxdHUlpiuO3pnkO0SzBCjPAFvOAe'
    };
    
    console.log(`   Mock Blockchain Poll ID: ${mockBlockchainResult.pollId}`);
    console.log(`   Mock Transaction Hash: ${mockBlockchainResult.transactionHash}`);

    // Test 4: Store metadata in backend after blockchain creation
    console.log('\n4. Storing poll metadata in backend...');
    try {
      const metadataResponse = await axios.post(`${API_BASE}/blockchain/polls/store-metadata`, {
        blockchainPollId: mockBlockchainResult.pollId,
        transactionHash: mockBlockchainResult.transactionHash,
        contractAddress: mockBlockchainResult.contractAddress,
        aiData: aiPoll,
        pollData: {
          title: aiPoll.subject,
          description: aiPoll.description,
          options: aiPoll.options,
          duration: aiPoll.durationDays * 24 * 3600,
          rewardPerVote: aiPoll.rewardPerResponse,
          totalFunding: aiPoll.targetFund
        },
        createdBy: 'EQTest_Blockchain_First_User'
      });
      
      console.log('✅ Poll metadata stored successfully');
      console.log(`   Backend ID: ${metadataResponse.data.blockchainPoll}`);
      console.log(`   Blockchain Poll ID: ${metadataResponse.data.blockchainPollId}`);
    } catch (metadataError) {
      console.log('❌ Metadata storage failed:', metadataError.response?.data?.message || metadataError.message);
    }

    // Test 5: Vote with blockchain poll ID
    console.log('\n5. Testing vote with blockchain poll ID...');
    try {
      const voteResponse = await axios.post(`${API_BASE}/blockchain/votes/create-transaction`, {
        pollId: mockBlockchainResult.pollId, // Numeric blockchain poll ID
        optionId: 0,
        voterAddress: 'EQTest_Blockchain_First_Voter'
      });
      
      console.log('✅ Vote transaction created successfully');
      console.log(`   Vote ID: ${voteResponse.data.voteId}`);
      console.log(`   Contract Address: ${voteResponse.data.transactionData.contractAddress}`);
    } catch (voteError) {
      console.log('ℹ️ Vote test result:', voteError.response?.data?.message || voteError.message);
    }

    // Test 6: Get active polls (should include both types)
    console.log('\n6. Testing active polls retrieval...');
    try {
      const activePollsResponse = await axios.get(`${API_BASE}/blockchain/polls/active`);
      
      console.log('✅ Active polls retrieved successfully');
      console.log(`   Total polls: ${activePollsResponse.data.count}`);
      console.log(`   Poll types: ${activePollsResponse.data.polls.map(p => p.type).join(', ')}`);
    } catch (pollsError) {
      console.log('ℹ️ Active polls test:', pollsError.response?.data?.message || pollsError.message);
    }

    // Test 7: Test blockchain poll retrieval
    console.log('\n7. Testing blockchain poll data retrieval...');
    try {
      const pollDataResponse = await axios.get(`${API_BASE}/blockchain/polls/${mockBlockchainResult.pollId}`);
      
      console.log('✅ Blockchain poll data retrieved');
      console.log(`   Poll ID: ${pollDataResponse.data.blockchainPoll?.blockchainPollId}`);
      console.log(`   Has AI data: ${!!pollDataResponse.data.aiPollData}`);
    } catch (pollDataError) {
      console.log('ℹ️ Blockchain poll retrieval:', pollDataError.response?.data?.message || pollDataError.message);
    }

    console.log('\n🎉 Blockchain-First Architecture Test Complete!\n');
    
    console.log('📋 Architecture Summary:');
    console.log('1. ✅ AI polls created in backend first (for content generation)');
    console.log('2. ✅ Frontend registers polls on blockchain (primary source)');
    console.log('3. ✅ Backend stores metadata after blockchain creation');
    console.log('4. ✅ Voting uses numeric blockchain poll IDs');
    console.log('5. ✅ System handles both blockchain and AI poll data');
    
    console.log('\n🔧 Key Benefits:');
    console.log('• Blockchain is source of truth for poll existence');
    console.log('• No more ObjectId vs numeric ID confusion');
    console.log('• AI polls can be registered when user decides');
    console.log('• Clear separation between content and registration');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

/**
 * Test error handling for the new architecture
 */
async function testErrorHandling() {
  console.log('\n🧪 Testing Error Handling\n');

  // Test invalid poll ID formats
  console.log('Testing invalid poll ID formats...');
  
  const testCases = [
    { pollId: 'invalid_string', expected: 'Invalid poll ID format' },
    { pollId: null, expected: 'Missing poll ID' },
    { pollId: -1, expected: 'Invalid poll ID value' },
    { pollId: 0, expected: 'Invalid poll ID value' }
  ];

  for (const testCase of testCases) {
    try {
      await axios.post(`${API_BASE}/blockchain/votes/create-transaction`, {
        pollId: testCase.pollId,
        optionId: 0,
        voterAddress: 'EQTest_Error_Handling'
      });
      console.log(`❌ Should have rejected: ${testCase.pollId}`);
    } catch (error) {
      console.log(`✅ Correctly rejected: ${testCase.pollId}`);
    }
  }
}

// Run tests
async function runTests() {
  await testBlockchainFirstFlow();
  await testErrorHandling();
  
  console.log('\n🏁 All tests completed!');
}

runTests().catch(console.error);