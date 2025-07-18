const { TonClient } = require('@ton/ton');
const { Address, Cell, beginCell, toNano } = require('@ton/core');
const config = require('../config/config');

/**
 * Simplified TON Service
 * Handles interaction with the new simplified polling contract
 * Only stores: poll creator, poll ID, and vote results
 */
class SimpleTonService {
  constructor() {
    this.client = null;
    this.contractAddress = null;
    this.isInitialized = false;
    
    console.log('SimpleTonService initialized');
  }

  /**
   * Initialize the service
   */
  async init() {
    try {
      // Initialize TON client
      this.client = new TonClient({
        endpoint: config.ton.endpoint,
        apiKey: config.ton.apiKey
      });

      this.contractAddress = config.ton.contractAddress;
      console.log(`SimpleTonService connecting to contract: ${this.contractAddress}`);

      // Test connection
      const status = await this.getContractStatus();
      if (status.deployed) {
        this.isInitialized = true;
        console.log('SimpleTonService initialized successfully');
        return true;
      } else {
        console.warn('Contract not deployed, running in limited mode');
        return false;
      }
    } catch (error) {
      console.error('Failed to initialize SimpleTonService:', error);
      return false;
    }
  }

  /**
   * Get contract deployment status
   */
  async getContractStatus() {
    try {
      if (!this.client || !this.contractAddress) {
        return { deployed: false, error: 'Client or contract address not available' };
      }

      const contractAddress = Address.parse(this.contractAddress);
      const contractState = await this.client.getContractState(contractAddress);
      
      return {
        deployed: contractState.state === 'active',
        address: this.contractAddress,
        balance: contractState.balance ? Number(contractState.balance) / 1000000000 : 0, // Convert to TON
        lastTransaction: contractState.lastTransaction ? {
          hash: contractState.lastTransaction.hash?.toString('hex'),
          lt: contractState.lastTransaction.lt?.toString()
        } : null
      };
    } catch (error) {
      console.error('Error getting contract status:', error);
      return { deployed: false, error: error.message };
    }
  }

  /**
   * Create a new poll on the blockchain
   * @param {number} optionCount - Number of voting options
   * @returns {Promise<Object>} Transaction payload for frontend
   */
  async createPoll(optionCount) {
    if (!this.isInitialized) {
      throw new Error('SimpleTonService not properly initialized');
    }

    try {
      // Validate option count
      if (optionCount < 2 || optionCount > 10) {
        throw new Error('Poll must have 2-10 options');
      }

      // Build CreatePoll message payload
      const messageBody = beginCell()
        .storeUint(1563446443, 32) // CreatePoll operation code from ABI
        .storeUint(optionCount, 32)
        .endCell();

      const payload = messageBody.toBoc().toString('base64');

      return {
        success: true,
        contractAddress: this.contractAddress,
        amount: toNano('0.05').toString(), // Small amount for gas
        payload,
        optionCount
      };
    } catch (error) {
      console.error('Error creating poll transaction:', error);
      throw new Error(`Failed to create poll: ${error.message}`);
    }
  }

  /**
   * Create a vote transaction
   * @param {number} pollId - Poll ID to vote on
   * @param {number} optionIndex - Option index (0-based)
   * @returns {Promise<Object>} Transaction payload for frontend
   */
  async createVoteTransaction(pollId, optionIndex) {
    if (!this.isInitialized) {
      throw new Error('SimpleTonService not properly initialized');
    }

    try {
      // Validate inputs
      if (pollId < 1) {
        throw new Error('Invalid poll ID');
      }

      if (optionIndex < 0) {
        throw new Error('Invalid option index');
      }

      // Build Vote message payload
      const messageBody = beginCell()
        .storeUint(2172077871, 32) // Vote operation code from ABI
        .storeUint(pollId, 32)
        .storeUint(optionIndex, 32)
        .endCell();

      const payload = messageBody.toBoc().toString('base64');

      return {
        success: true,
        contractAddress: this.contractAddress,
        amount: toNano('0.02').toString(), // Small amount for gas
        payload,
        pollId,
        optionIndex
      };
    } catch (error) {
      console.error('Error creating vote transaction:', error);
      throw new Error(`Failed to create vote transaction: ${error.message}`);
    }
  }

  /**
   * Get poll information from blockchain
   * @param {number} pollId - Poll ID
   * @returns {Promise<Object>} Poll data
   */
  async getPoll(pollId) {
    if (!this.isInitialized) {
      throw new Error('SimpleTonService not properly initialized');
    }

    try {
      const contractAddress = Address.parse(this.contractAddress);
      
      // First check if the poll exists by checking total polls
      const totalPolls = await this.getTotalPolls();
      if (pollId > totalPolls) {
        console.log(`Poll ${pollId} does not exist. Total polls: ${totalPolls}`);
        return null;
      }
      
      // Call getPoll getter method with better error handling
      let result;
      try {
        result = await this.client.runMethod(contractAddress, 'getPoll', [
          { type: 'int', value: BigInt(pollId) }
        ]);
      } catch (getError) {
        console.error(`Error calling getPoll for poll ${pollId}:`, getError.message);
        
        // Try alternative: check if poll exists by getting creator
        try {
          const creatorResult = await this.client.runMethod(contractAddress, 'getPollCreator', [
            { type: 'int', value: BigInt(pollId) }
          ]);
          
          if (creatorResult.stack && creatorResult.stack.items.length > 0) {
            // Poll exists, return minimal data
            return {
              id: pollId,
              creator: 'Unknown', // We'll get this from metadata
              totalVotes: 0,
              isActive: true,
              optionCount: 2 // Default
            };
          }
        } catch (creatorError) {
          console.error(`Error getting poll creator for poll ${pollId}:`, creatorError.message);
        }
        
        return null;
      }

      if (!result.stack || result.stack.items.length === 0) {
        console.log(`Poll ${pollId} returned empty result`);
        return null; // Poll not found
      }

      // Parse Poll struct from the stack
      const pollData = this._parsePollFromStack(result.stack);
      
      if (!pollData) {
        console.log(`Failed to parse poll data for poll ${pollId}`);
        return null;
      }

      return {
        id: pollData.id,
        creator: pollData.creator,
        totalVotes: pollData.totalVotes,
        isActive: pollData.isActive,
        optionCount: pollData.optionCount
      };
    } catch (error) {
      console.error(`Error getting poll ${pollId}:`, error);
      throw new Error(`Failed to get poll: ${error.message}`);
    }
  }

  /**
   * Get poll results from blockchain
   * @param {number} pollId - Poll ID
   * @returns {Promise<Object>} Poll results
   */
  async getPollResults(pollId) {
    if (!this.isInitialized) {
      throw new Error('SimpleTonService not properly initialized');
    }

    try {
      const contractAddress = Address.parse(this.contractAddress);
      
      // First get poll info to know how many options there are
      const poll = await this.getPoll(pollId);
      if (!poll) {
        throw new Error('Poll not found');
      }

      // Get results for each option
      const results = [];
      for (let optionIndex = 0; optionIndex < poll.optionCount; optionIndex++) {
        try {
          const result = await this.client.runMethod(contractAddress, 'getOptionResult', [
            { type: 'int', value: BigInt(pollId) },
            { type: 'int', value: BigInt(optionIndex) }
          ]);

          const voteCount = result.stack && result.stack.items.length > 0 
            ? Number(result.stack.items[0].value) 
            : 0;

          results.push({
            optionIndex,
            voteCount
          });
        } catch (error) {
          console.warn(`Failed to get result for option ${optionIndex}:`, error);
          results.push({
            optionIndex,
            voteCount: 0
          });
        }
      }

      return {
        pollId,
        totalVotes: poll.totalVotes,
        results,
        isActive: poll.isActive
      };
    } catch (error) {
      console.error(`Error getting poll results ${pollId}:`, error);
      throw new Error(`Failed to get poll results: ${error.message}`);
    }
  }

  /**
   * Check if a user has voted on a poll
   * @param {string} userAddress - User's wallet address
   * @param {number} pollId - Poll ID
   * @returns {Promise<boolean>} Whether user has voted
   */
  async hasUserVoted(userAddress, pollId) {
    if (!this.isInitialized) {
      throw new Error('SimpleTonService not properly initialized');
    }

    try {
      const contractAddress = Address.parse(this.contractAddress);
      const userAddr = Address.parse(userAddress);
      
      const result = await this.client.runMethod(contractAddress, 'hasUserVoted', [
        { type: 'slice', cell: beginCell().storeAddress(userAddr).endCell() },
        { type: 'int', value: BigInt(pollId) }
      ]);

      return result.stack && result.stack.items.length > 0 
        ? result.stack.items[0].value === -1n
        : false;
    } catch (error) {
      console.error(`Error checking vote status:`, error);
      return false; // Assume not voted if we can't check
    }
  }

  /**
   * Get user's vote on a poll
   * @param {string} userAddress - User's wallet address  
   * @param {number} pollId - Poll ID
   * @returns {Promise<number>} Option index voted for, or -1 if not voted
   */
  async getUserVote(userAddress, pollId) {
    if (!this.isInitialized) {
      throw new Error('SimpleTonService not properly initialized');
    }

    try {
      const contractAddress = Address.parse(this.contractAddress);
      const userAddr = Address.parse(userAddress);
      
      const result = await this.client.runMethod(contractAddress, 'getUserVote', [
        { type: 'slice', cell: beginCell().storeAddress(userAddr).endCell() },
        { type: 'int', value: BigInt(pollId) }
      ]);

      return result.stack && result.stack.items.length > 0 
        ? Number(result.stack.items[0].value)
        : -1;
    } catch (error) {
      console.error(`Error getting user vote:`, error);
      return -1;
    }
  }

  /**
   * Get total number of polls created
   * @returns {Promise<number>} Total polls count
   */
  async getTotalPolls() {
    if (!this.isInitialized) {
      throw new Error('SimpleTonService not properly initialized');
    }

    try {
      const contractAddress = Address.parse(this.contractAddress);
      
      // Try getTotalPolls method first
      try {
        const result = await this.client.runMethod(contractAddress, 'getPollCount');
        if (result.stack && result.stack.items.length > 0) {
          return Number(result.stack.items[0].value);
        }
      } catch (error) {
        console.log('getPollCount method failed, trying getPollCount');
      }
      
      // Fallback to getPollCount
      try {
        const result = await this.client.runMethod(contractAddress, 'getPollCount');
        if (result.stack && result.stack.items.length > 0) {
          return Number(result.stack.items[0].value);
        }
      } catch (error) {
        console.log('getPollCount method failed, trying getNextPollId');
      }
      
      // Final fallback: use nextPollId - 1
      try {
        const nextPollId = await this.getNextPollId();
        return Math.max(0, nextPollId - 1);
      } catch (error) {
        console.log('All methods failed, returning 0');
        return 0;
      }
    } catch (error) {
      console.error('Error getting total polls:', error);
      return 0;
    }
  }

  /**
   * Get next poll ID that will be assigned
   * @returns {Promise<number>} Next poll ID
   */
  async getNextPollId() {
    if (!this.isInitialized) {
      throw new Error('SimpleTonService not properly initialized');
    }

    try {
      const contractAddress = Address.parse(this.contractAddress);
      
      const result = await this.client.runMethod(contractAddress, 'getNextPollId');

      return result.stack && result.stack.items.length > 0 
        ? Number(result.stack.items[0].value)
        : 1;
    } catch (error) {
      console.error('Error getting next poll ID:', error);
      return 1;
    }
  }

  /**
   * Get all active polls
   * @returns {Promise<Array>} Array of active polls
   */
  async getActivePolls() {
    try {
      // Use the contract's getActivePolls method directly
      const contractAddress = Address.parse(this.contractAddress);
      console.log('contractAddress', contractAddress)
      const result = await this.client.runMethod(contractAddress, 'getActivePolls');
      console.log('result', result)
      
      if (!result.stack || result.stack.items.length === 0) {
        console.log('No active polls found');
        return [];
      }
      
      // Parse the dictionary of active polls
      const activePolls = [];
      const pollsDict = result.stack.items[0];
      
      if (pollsDict && pollsDict.type === 'dict') {
        // TODO: Parse dictionary properly
        // For now, fallback to individual poll checking
        return await this.getActivePollsByIteration();
      }
      
      return activePolls;
    } catch (error) {
      console.error('Error getting active polls directly:', error);
      // Fallback to iteration method
      return await this.getActivePollsByIteration();
    }
  }

  /**
   * Get active polls by iterating through poll IDs (fallback method)
   * @returns {Promise<Array>} Array of active polls
   */
  async getActivePollsByIteration() {
    try {
      let totalPolls = 0;
      
      // Try to get total polls count safely
      try {
        totalPolls = await this.getTotalPolls();
      } catch (error) {
        console.warn('Could not get total polls count, trying getNextPollId');
        try {
          const nextPollId = await this.getNextPollId();
          totalPolls = nextPollId - 1;
        } catch (nextError) {
          console.warn('Could not get next poll ID either, assuming 0 polls');
          return [];
        }
      }

      const activePolls = [];

      // Check each poll to see if it's active
      for (let pollId = 1; pollId <= totalPolls; pollId++) {
        try {
          const poll = await this.getPoll(pollId);
          if (poll && poll.isActive) {
            activePolls.push(poll);
          }
        } catch (error) {
          console.warn(`Failed to check poll ${pollId}:`, error);
        }
      }

      return activePolls;
    } catch (error) {
      console.error('Error getting active polls by iteration:', error);
      return [];
    }
  }

  /**
   * Parse Poll struct from TVM stack
   * @private
   */
  _parsePollFromStack(stack) {
    try {
      if (!stack.items || stack.items.length === 0) {
        console.log('Stack is empty or has no items');
        return null;
      }

      console.log('Parsing stack with', stack.items.length, 'items');
      console.log('First item type:', stack.items[0]?.type);

      // Handle different response formats
      const item = stack.items[0];
      
      // Check if it's a tuple (struct)
      if (item.type === 'tuple' && item.items) {
        console.log('Parsing as tuple with', item.items.length, 'items');
        return {
          id: Number(item.items[0]?.value || 0),
          creator: item.items[1]?.value ? Address.parse(item.items[1].value).toString() : null,
          totalVotes: Number(item.items[2]?.value || 0),
          isActive: Boolean(item.items[3]?.value),
          optionCount: Number(item.items[4]?.value || 0)
        };
      }

      // Check if it's a null value
      if (item.type === 'null') {
        console.log('Poll data is null');
        return null;
      }

      // Check if it's a slice (might contain serialized data)
      if (item.type === 'slice') {
        console.log('Poll data is a slice - poll might not exist');
        return null;
      }

      // Fallback: try to parse as individual values in separate stack items
      if (stack.items.length >= 5) {
        console.log('Parsing as individual stack items');
        return {
          id: Number(stack.items[0]?.value || 0),
          creator: stack.items[1]?.value ? Address.parse(stack.items[1].value).toString() : null,
          totalVotes: Number(stack.items[2]?.value || 0),
          isActive: Boolean(stack.items[3]?.value),
          optionCount: Number(stack.items[4]?.value || 0)
        };
      }

      console.log('Unable to parse poll data - unknown format');
      return null;
    } catch (error) {
      console.error('Error parsing poll from stack:', error);
      return null;
    }
  }
}

module.exports = new SimpleTonService();