const { TonClient } = require('@ton/ton');
const { Address, toNano, beginCell } = require('@ton/core');
const config = require('../config/config');

/**
 * TON Blockchain Service
 * Handles all interactions with the TPolls smart contract on TON blockchain
 */
class TonService {
  constructor() {
    this.client = null;
    this.contractAddress = config.ton.contractAddress;
    this.managerAddresses = {
      pollManager: null,
      responseManager: null,
      fundManager: null,
      optionsStorage: null
    };
    this.isInitialized = false;
  }

  /**
   * Initialize the TON client and contract connections
   */
  async init() {
    try {
      console.log(`Initializing TON client for ${config.ton.network} network`);
      
      this.client = new TonClient({
        endpoint: config.ton.endpoint,
        apiKey: config.ton.apiKey
      });

      // Test connection
      await this._testConnection();
      
      // Initialize manager addresses
      await this._initializeManagerAddresses();
      
      this.isInitialized = true;
      console.log('TON service initialized successfully');
      
      return true;
    } catch (error) {
      console.error('Failed to initialize TON service:', error);
      this.isInitialized = false;
      return false;
    }
  }

  /**
   * Test the connection to TON network
   */
  async _testConnection() {
    try {
      const contractAddress = Address.parse(this.contractAddress);
      const contractState = await this.client.getContractState(contractAddress);
      console.log(`Contract state: ${contractState.state}`);
      return contractState.state === 'active';
    } catch (error) {
      throw new Error(`TON connection test failed: ${error.message}`);
    }
  }

  /**
   * Initialize manager contract addresses from main contract
   */
  async _initializeManagerAddresses() {
    try {
      const contractAddress = Address.parse(this.contractAddress);
      
      // Check if contract is initialized
      const isInitializedResult = await this.client.runMethod(contractAddress, 'isInitialized');
      const isInitialized = isInitializedResult.stack?.items[0]?.value === -1n;
      
      if (!isInitialized) {
        console.warn('Main contract not initialized yet');
        return;
      }

      // Get manager addresses
      const [pollManagerResult, responseManagerResult, fundManagerResult, optionsStorageResult] = await Promise.all([
        this.client.runMethod(contractAddress, 'getPollManager'),
        this.client.runMethod(contractAddress, 'getResponseManager'),
        this.client.runMethod(contractAddress, 'getFundManager'),
        this.client.runMethod(contractAddress, 'getOptionsStorage')
      ]);

      // Parse addresses from Cell responses
      this.managerAddresses.pollManager = this._parseAddressFromCell(pollManagerResult);
      this.managerAddresses.responseManager = this._parseAddressFromCell(responseManagerResult);
      this.managerAddresses.fundManager = this._parseAddressFromCell(fundManagerResult);
      this.managerAddresses.optionsStorage = this._parseAddressFromCell(optionsStorageResult);

      console.log('Manager addresses initialized:', this.managerAddresses);
    } catch (error) {
      console.warn('Failed to initialize manager addresses:', error.message);
    }
  }

  /**
   * Parse address from Cell response
   */
  _parseAddressFromCell(result) {
    try {
      if (result.stack?.items[0]?.cell) {
        const cell = result.stack.items[0].cell;
        const slice = cell.beginParse();
        const address = slice.loadAddress();
        return address.toString();
      }
      return null;
    } catch (error) {
      console.warn('Failed to parse address from cell:', error);
      return null;
    }
  }

  /**
   * Get contract status and initialization state
   */
  async getContractStatus() {
    if (!this.client) {
      return { deployed: false, initialized: false, error: 'TON client not initialized' };
    }

    try {
      const contractAddress = Address.parse(this.contractAddress);
      
      // Check if contract is deployed
      const contractState = await this.client.getContractState(contractAddress);
      
      if (contractState.state !== 'active') {
        return { deployed: true, initialized: false, error: `Contract state: ${contractState.state}` };
      }
      
      // Check if contract is initialized
      const isInitializedResult = await this.client.runMethod(contractAddress, 'isInitialized');
      const isInitialized = isInitializedResult.stack?.items[0]?.value === -1n;
      
      return { 
        deployed: true, 
        initialized: isInitialized,
        managersReady: Object.values(this.managerAddresses).every(addr => addr !== null)
      };
    } catch (error) {
      return { deployed: false, initialized: false, error: error.message };
    }
  }

  /**
   * Register a poll on the blockchain
   * @param {Object} pollData - Poll data from MongoDB
   * @returns {Promise<Object>} Registration result
   */
  async registerPoll(pollData) {
    if (!this.isInitialized || !this.managerAddresses.pollManager) {
      throw new Error('TON service not properly initialized');
    }

    try {
      const {
        title,
        description,
        options,
        duration = 86400, // 24 hours default
        rewardPerVote = '0.01',
        totalFunding = '1.0'
      } = pollData;

      // Validate input
      if (!title || !description || !options || options.length < 2) {
        throw new Error('Invalid poll data: title, description, and at least 2 options required');
      }

      // Build the payload for CreatePollWithFunds message
      const cell = beginCell();
      const titleCell = beginCell().storeStringTail(title).endCell();
      const descCell = beginCell().storeStringTail(description).endCell();
      cell.storeRef(titleCell);
      cell.storeRef(descCell);
      cell.storeUint(options.length, 32);
      cell.storeUint(duration, 32);
      cell.storeCoins(toNano(rewardPerVote));
      const payload = cell.endCell().toBoc().toString('base64');

      // Note: This method returns the transaction payload
      // The actual sending should be done by the frontend with user's wallet
      return {
        success: true,
        payload,
        contractAddress: this.contractAddress,
        amount: toNano(parseFloat(totalFunding) + 0.01).toString(),
        pollData: {
          title,
          description,
          options,
          duration,
          rewardPerVote,
          totalFunding
        }
      };
    } catch (error) {
      console.error('Error registering poll:', error);
      throw new Error(`Failed to register poll: ${error.message}`);
    }
  }

  /**
   * Get poll data from blockchain
   * @param {number} pollId - Poll ID on blockchain
   * @returns {Promise<Object>} Poll data from blockchain
   */
  async getPollFromBlockchain(pollId) {
    if (!this.isInitialized || !this.managerAddresses.pollManager) {
      throw new Error('TON service not properly initialized');
    }

    try {
      const pollManagerAddress = Address.parse(this.managerAddresses.pollManager);
      const pollResult = await this.client.runMethod(pollManagerAddress, 'getPoll', [
        { type: 'int', value: BigInt(pollId) }
      ]);

      if (!pollResult.stack || pollResult.stack.items.length === 0) {
        throw new Error(`Poll ${pollId} not found on blockchain`);
      }

      // Parse poll data from contract response
      const pollData = this._parsePollFromCell(pollResult.stack.items[0].cell, pollId);
      
      // Get additional data
      const [totalVotes, fundData] = await Promise.all([
        this._getPollTotalVotes(pollId),
        this._getPollFundData(pollId)
      ]);

      return {
        ...pollData,
        totalVotes,
        fundData,
        blockchainPollId: pollId
      };
    } catch (error) {
      console.error(`Error getting poll ${pollId} from blockchain:`, error);
      throw error;
    }
  }

  /**
   * Parse poll data from Cell
   */
  _parsePollFromCell(cell, pollId) {
    try {
      const slice = cell.beginParse();
      
      return {
        id: Number(slice.loadUint(32)),
        creator: slice.loadAddress().toString(),
        optionCount: Number(slice.loadUint(8)),
        startTime: Number(slice.loadUint(32)),
        endTime: Number(slice.loadUint(32)),
        isActive: !!slice.loadUint(1),
        totalVotes: Number(slice.loadUint(32)),
        rewardPerVote: Number(slice.loadUint(64))
      };
    } catch (error) {
      console.warn('Failed to parse poll cell, using defaults:', error);
      return {
        id: pollId,
        creator: 'Unknown',
        optionCount: 0,
        startTime: Math.floor(Date.now() / 1000),
        endTime: Math.floor(Date.now() / 1000) + 86400,
        isActive: true,
        totalVotes: 0,
        rewardPerVote: 0
      };
    }
  }

  /**
   * Get total votes for a poll from ResponseManager
   */
  async _getPollTotalVotes(pollId) {
    if (!this.managerAddresses.responseManager) return 0;

    try {
      const responseManagerAddress = Address.parse(this.managerAddresses.responseManager);
      const votesResult = await this.client.runMethod(responseManagerAddress, 'getTotalPollVotes', [
        { type: 'int', value: BigInt(pollId) }
      ]);

      if (votesResult.stack?.items[0]?.cell) {
        const cell = votesResult.stack.items[0].cell;
        const slice = cell.beginParse();
        return Number(slice.loadUint(32));
      } else if (votesResult.stack?.items[0]?.value) {
        return Number(votesResult.stack.items[0].value);
      }
      return 0;
    } catch (error) {
      console.warn('Failed to get total votes:', error);
      return 0;
    }
  }

  /**
   * Get fund pool data from FundManager
   */
  async _getPollFundData(pollId) {
    if (!this.managerAddresses.fundManager) {
      return { totalFunds: '0.000 TON', rewardPerVote: 0 };
    }

    try {
      const fundManagerAddress = Address.parse(this.managerAddresses.fundManager);
      const fundResult = await this.client.runMethod(fundManagerAddress, 'getFundPool', [
        { type: 'int', value: BigInt(pollId) }
      ]);

      // Parse fund data from response
      return {
        totalFunds: '0.000 TON', // TODO: Parse from cell
        rewardPerVote: 0.001
      };
    } catch (error) {
      console.warn('Failed to get fund pool data:', error);
      return { totalFunds: '0.000 TON', rewardPerVote: 0 };
    }
  }

  /**
   * Get all active polls from blockchain
   */
  async getActivePolls() {
    if (!this.isInitialized || !this.managerAddresses.pollManager) {
      return [];
    }

    try {
      const pollManagerAddress = Address.parse(this.managerAddresses.pollManager);
      const pollsCountResult = await this.client.runMethod(pollManagerAddress, 'getPollsCount');
      
      let totalPolls = 0;
      if (pollsCountResult.stack?.items[0]?.cell) {
        const cell = pollsCountResult.stack.items[0].cell;
        const slice = cell.beginParse();
        totalPolls = Number(slice.loadUint(32));
      } else if (pollsCountResult.stack?.items[0]?.value) {
        totalPolls = Number(pollsCountResult.stack.items[0].value);
      }

      console.log(`Found ${totalPolls} polls on blockchain`);

      // Fetch individual polls
      const polls = [];
      for (let i = 1; i <= Math.min(totalPolls, 20); i++) { // Limit to 20 polls
        try {
          const pollData = await this.getPollFromBlockchain(i);
          if (pollData && pollData.isActive) {
            polls.push(pollData);
          }
        } catch (error) {
          console.warn(`Failed to fetch poll ${i}:`, error.message);
        }
      }

      return polls;
    } catch (error) {
      console.error('Error getting active polls from blockchain:', error);
      return [];
    }
  }

  /**
   * Check if user has voted on a poll
   */
  async hasUserVoted(userAddress, pollId) {
    // TODO: Implement vote checking logic
    return false;
  }

  /**
   * Submit a vote transaction payload
   * @param {number} pollId - Poll ID
   * @param {number} optionId - Selected option ID
   * @returns {Object} Transaction payload for frontend
   */
  async createVoteTransaction(pollId, optionId) {
    if (!this.isInitialized) {
      throw new Error('TON service not properly initialized');
    }

    try {
      // Build vote transaction payload
      const cell = beginCell();
      cell.storeUint(pollId, 32);
      cell.storeUint(optionId, 32);
      const payload = cell.endCell().toBoc().toString('base64');

      return {
        success: true,
        payload,
        contractAddress: this.contractAddress,
        amount: toNano('0.05').toString(),
        pollId,
        optionId
      };
    } catch (error) {
      console.error('Error creating vote transaction:', error);
      throw new Error(`Failed to create vote transaction: ${error.message}`);
    }
  }
}

// Export singleton instance
const tonService = new TonService();
module.exports = tonService;