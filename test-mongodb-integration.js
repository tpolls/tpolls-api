const { connectDB } = require('./src/config/database');
const AiGeneratedPoll = require('./src/models/AiGeneratedPoll');

async function testMongoDBIntegration() {
  try {
    console.log('Testing MongoDB integration...');
    
    // Connect to database
    await connectDB();
    
    // Create a test poll
    const testPoll = new AiGeneratedPoll({
      subject: 'Test Poll - Favorite Programming Languages',
      description: 'Which programming language do you prefer for development?',
      category: 'tech',
      viewType: 'text',
      options: ['JavaScript', 'Python', 'Java', 'C++'],
      rewardPerResponse: '0.001',
      durationDays: 7,
      maxResponses: 100,
      minContribution: '0.0001',
      fundingType: 'self-funded',
      isOpenImmediately: true,
      targetFund: '0.1',
      rewardToken: '0x0000000000000000000000000000000000000000',
      rewardDistribution: 'split',
      originalPrompt: 'Create a poll about favorite programming languages'
    });
    
    // Save to database
    const savedPoll = await testPoll.save();
    console.log('✅ Test poll saved to MongoDB with ID:', savedPoll._id);
    
    // Query the database
    const foundPoll = await AiGeneratedPoll.findById(savedPoll._id);
    console.log('✅ Test poll retrieved from MongoDB:', foundPoll.subject);
    
    // Query pending polls
    const pendingPolls = await AiGeneratedPoll.find({ status: 'pending' });
    console.log(`✅ Found ${pendingPolls.length} pending polls in database`);
    
    // Clean up - delete test poll
    await AiGeneratedPoll.findByIdAndDelete(savedPoll._id);
    console.log('✅ Test poll cleaned up from database');
    
    console.log('🎉 MongoDB integration test completed successfully!');
    
  } catch (error) {
    console.error('❌ MongoDB integration test failed:', error.message);
  } finally {
    process.exit(0);
  }
}

// Run the test
testMongoDBIntegration(); 