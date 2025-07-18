#!/usr/bin/env node

const axios = require('axios');

const API_BASE = 'http://localhost:3001/api';

/**
 * Test the new simplified TON contract implementation
 */
async function testSimpleContract() {
  console.log('🧪 Testing Simplified TON Contract\n');
  console.log('📋 Contract Specifications:');
  console.log('   - Stores ONLY: poll creator, poll ID, and vote results');
  console.log('   - All other data (titles, descriptions, etc.) stored in MongoDB');
  console.log('   - Minimal on-chain storage for cost efficiency\n');

  try {
    // Test 1: Check simple blockchain service status
    console.log('1. Checking simplified blockchain service status...');
    try {
      const statusResponse = await axios.get(`${API_BASE}/simple-blockchain/status`);
      console.log('✅ Simple blockchain service status:', statusResponse.data.success ? 'Ready' : 'Not ready');
      console.log(`   Contract address: ${statusResponse.data.status?.address || 'Not available'}`);
    } catch (error) {
      console.log('⚠️ Simple blockchain service check failed:', error.message);
    }

    // Test 2: Get contract statistics
    console.log('\n2. Getting contract statistics...');
    try {
      const statsResponse = await axios.get(`${API_BASE}/simple-blockchain/stats`);
      console.log('✅ Contract statistics retrieved:');
      console.log(`   Total polls: ${statsResponse.data.stats?.totalPolls || 0}`);
      console.log(`   Active polls: ${statsResponse.data.stats?.activePolls || 0}`);
      console.log(`   Next poll ID: ${statsResponse.data.stats?.nextPollId || 1}`);
    } catch (error) {
      console.log('ℹ️ Contract stats:', error.response?.data?.message || error.message);
    }

    // Test 3: Create AI poll content (MongoDB only)
    console.log('\n3. Creating AI poll content...');
    const aiPollResponse = await axios.post(`${API_BASE}/poll-ai`, {
      prompt: 'Best blockchain for DeFi: Ethereum vs Solana vs TON'
    });
    
    console.log('✅ AI poll content generated:');
    const aiPoll = aiPollResponse.data.data.poll;
    console.log(`   Subject: ${aiPoll.subject}`);
    console.log(`   Options: ${aiPoll.options.join(', ')}`);
    console.log(`   Option count: ${aiPoll.options.length}`);

    // Test 4: Create poll transaction (for blockchain)
    console.log('\n4. Creating poll transaction for blockchain...');
    try {
      const pollTxResponse = await axios.post(`${API_BASE}/simple-blockchain/polls/create-transaction`, {
        optionCount: aiPoll.options.length,
        createdBy: 'EQSimpleTest_Creator_Address'
      });
      
      console.log('✅ Poll transaction created:');
      console.log(`   Next poll ID: ${pollTxResponse.data.nextPollId}`);
      console.log(`   Contract address: ${pollTxResponse.data.transactionData.contractAddress}`);
      console.log(`   Transaction amount: ${pollTxResponse.data.transactionData.amount}`);
      
      const mockPollId = pollTxResponse.data.nextPollId;
      const mockTxHash = '0x' + Math.random().toString(36).substring(7);

      // Test 5: Store poll metadata after "blockchain creation"
      console.log('\n5. Storing poll metadata...');
      try {
        const metadataResponse = await axios.post(`${API_BASE}/simple-blockchain/polls/store-metadata`, {
          blockchainPollId: mockPollId,
          transactionHash: mockTxHash,
          contractAddress: pollTxResponse.data.transactionData.contractAddress,
          aiData: aiPoll,
          pollData: {
            optionCount: aiPoll.options.length
          },
          createdBy: 'EQSimpleTest_Creator_Address'
        });
        
        console.log('✅ Poll metadata stored successfully:');
        console.log(`   MongoDB record ID: ${metadataResponse.data.blockchainPoll}`);
        console.log(`   Blockchain poll ID: ${metadataResponse.data.blockchainPollId}`);
        console.log(`   Has AI data: ${!!metadataResponse.data.aiPoll}`);

        // Test 6: Create vote transaction
        console.log('\n6. Creating vote transaction...');
        try {
          const voteResponse = await axios.post(`${API_BASE}/simple-blockchain/votes/create-transaction`, {
            pollId: mockPollId,
            optionIndex: 0,
            voterAddress: 'EQSimpleTest_Voter_Address'
          });
          
          console.log('✅ Vote transaction created:');
          console.log(`   Vote ID: ${voteResponse.data.voteId}`);
          console.log(`   Poll ID: ${mockPollId}`);
          console.log(`   Option index: 0`);
          console.log(`   Contract address: ${voteResponse.data.transactionData.contractAddress}`);

          // Test 7: Confirm vote
          console.log('\n7. Confirming vote...');
          const mockVoteTxHash = '0x' + Math.random().toString(36).substring(7);
          
          try {
            const confirmResponse = await axios.post(`${API_BASE}/simple-blockchain/votes/confirm`, {
              voteId: voteResponse.data.voteId,
              txHash: mockVoteTxHash
            });
            
            console.log('✅ Vote confirmed successfully');
            console.log(`   Vote status: ${confirmResponse.data.voteStatus}`);
          } catch (confirmError) {
            console.log('ℹ️ Vote confirmation:', confirmError.response?.data?.message || confirmError.message);
          }
        } catch (voteError) {
          console.log('ℹ️ Vote transaction:', voteError.response?.data?.message || voteError.message);
        }

        // Test 8: Retrieve poll data
        console.log('\n8. Retrieving poll data...');
        try {
          const pollDataResponse = await axios.get(`${API_BASE}/simple-blockchain/polls/${mockPollId}`);
          
          console.log('✅ Poll data retrieved:');
          const poll = pollDataResponse.data.poll;
          console.log(`   Poll ID: ${poll.id}`);
          console.log(`   Title: ${poll.title}`);
          console.log(`   Creator: ${poll.creator}`);
          console.log(`   Option count: ${poll.optionCount}`);
          console.log(`   Total votes: ${poll.totalVotes}`);
          console.log(`   Is active: ${poll.isActive}`);
          console.log(`   Has AI data: ${pollDataResponse.data.metadata.hasAiData}`);
        } catch (pollError) {
          console.log('ℹ️ Poll retrieval:', pollError.response?.data?.message || pollError.message);
        }

        // Test 9: Get poll results
        console.log('\n9. Getting poll results...');
        try {
          const resultsResponse = await axios.get(`${API_BASE}/simple-blockchain/polls/${mockPollId}/results`);
          
          console.log('✅ Poll results retrieved:');
          console.log(`   Total votes: ${resultsResponse.data.totalVotes}`);
          console.log(`   Results:`);
          resultsResponse.data.results.forEach((result, index) => {
            console.log(`     ${index}: "${result.optionText}" - ${result.voteCount} votes (${result.percentage}%)`);
          });
        } catch (resultsError) {
          console.log('ℹ️ Poll results:', resultsError.response?.data?.message || resultsError.message);
        }
      } catch (metadataError) {
        console.log('❌ Metadata storage failed:', metadataError.response?.data?.message || metadataError.message);
      }
    } catch (pollTxError) {
      console.log('❌ Poll transaction creation failed:', pollTxError.response?.data?.message || pollTxError.message);
    }

    console.log('\n🎉 Simplified Contract Test Complete!\n');
    
    console.log('📊 Data Architecture Summary:');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                   TON BLOCKCHAIN                       │');
    console.log('│  ✅ Poll ID (uint32)                                   │');
    console.log('│  ✅ Poll Creator (Address)                             │');
    console.log('│  ✅ Vote Results (option_index -> vote_count)          │');
    console.log('│  ✅ Total Votes (uint32)                               │');
    console.log('│  ✅ Active Status (Bool)                               │');
    console.log('│  ✅ Option Count (uint32)                              │');
    console.log('└─────────────────────────────────────────────────────────┘');
    console.log('┌─────────────────────────────────────────────────────────┐');
    console.log('│                      MONGODB                            │');
    console.log('│  📝 Poll Titles & Descriptions                         │');
    console.log('│  📝 Option Texts                                       │');
    console.log('│  📝 AI-Generated Content                               │');
    console.log('│  📝 Categories & Metadata                              │');
    console.log('│  📝 Timestamps & Duration                              │');
    console.log('│  📝 Sync Status & Tracking                             │');
    console.log('└─────────────────────────────────────────────────────────┘');

    console.log('\n🔧 Benefits of This Architecture:');
    console.log('• 💰 Lower gas costs (minimal on-chain data)');
    console.log('• 🔒 Essential voting data immutable on blockchain');  
    console.log('• 🚀 Rich metadata and AI features via MongoDB');
    console.log('• 📊 Fast queries for UI (database optimization)');
    console.log('• 🔄 Easy to sync and maintain consistency');
    console.log('• 🎯 Clear separation of concerns');

  } catch (error) {
    console.error('❌ Test failed:', error.response?.data || error.message);
  }
}

// Run test
testSimpleContract().catch(console.error);