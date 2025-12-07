// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title CompanyWishlistEscrow
 * @notice Escrow contract for company wishlist funding
 * @dev Holds funds until target is reached within deadline, then releases to company
 * 
 * Features:
 * - Time-bound fundraising campaign
 * - All-or-nothing funding (refund if target not met)
 * - Transparent contribution tracking
 * - Automatic fund release when target is met
 * - Refund mechanism if campaign fails
 */
contract CompanyWishlistEscrow {
    // State variables
    address public immutable company;
    address public immutable creator;
    uint256 public immutable targetAmount;
    uint256 public immutable deadline;
    uint256 public totalRaised;
    bool public isFinalized;
    bool public isSuccessful;
    
    // Mapping to track individual contributions
    mapping(address => uint256) public contributions;
    address[] public contributors;
    
    // Events
    event ContributionReceived(address indexed contributor, uint256 amount, uint256 totalRaised);
    event FundsReleased(address indexed company, uint256 amount);
    event RefundIssued(address indexed contributor, uint256 amount);
    event CampaignFinalized(bool successful, uint256 totalRaised);
    
    // Errors
    error CampaignExpired();
    error CampaignNotExpired();
    error TargetNotReached();
    error TargetAlreadyReached();
    error AlreadyFinalized();
    error NotFinalized();
    error NoContribution();
    error TransferFailed();
    error ZeroAmount();
    error InvalidAddress();
    
    /**
     * @notice Constructor to create a new escrow campaign
     * @param _company Address that will receive funds if target is met
     * @param _targetAmount Target amount in wei
     * @param _durationInDays Campaign duration in days
     */
    constructor(
        address _company,
        uint256 _targetAmount,
        uint256 _durationInDays
    ) {
        if (_company == address(0)) revert InvalidAddress();
        if (_targetAmount == 0) revert ZeroAmount();
        if (_durationInDays == 0) revert ZeroAmount();
        
        company = _company;
        creator = msg.sender;
        targetAmount = _targetAmount;
        deadline = block.timestamp + (_durationInDays * 1 days);
    }
    
    /**
     * @notice Contribute to the campaign
     * @dev Funds are held in escrow until target is reached or deadline passes
     */
    function contribute() external payable {
        if (block.timestamp > deadline) revert CampaignExpired();
        if (msg.value == 0) revert ZeroAmount();
        if (isFinalized) revert AlreadyFinalized();
        
        // Track first-time contributors
        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
        }
        
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
        
        emit ContributionReceived(msg.sender, msg.value, totalRaised);
        
        // Auto-finalize if target is reached
        if (totalRaised >= targetAmount && !isFinalized) {
            _finalize();
        }
    }
    
    /**
     * @notice Finalize the campaign after deadline
     * @dev Can be called by anyone after deadline passes
     */
    function finalize() external {
        if (block.timestamp <= deadline) revert CampaignNotExpired();
        if (isFinalized) revert AlreadyFinalized();
        
        _finalize();
    }
    
    /**
     * @notice Internal function to finalize the campaign
     */
    function _finalize() private {
        isFinalized = true;
        isSuccessful = totalRaised >= targetAmount;
        
        emit CampaignFinalized(isSuccessful, totalRaised);
        
        // If successful, release funds to company
        if (isSuccessful) {
            _releaseFunds();
        }
    }
    
    /**
     * @notice Release funds to company (called automatically when target is reached)
     */
    function _releaseFunds() private {
        (bool success, ) = company.call{value: totalRaised}("");
        if (!success) revert TransferFailed();
        
        emit FundsReleased(company, totalRaised);
    }
    
    /**
     * @notice Claim refund if campaign failed
     * @dev Contributors can claim refund if target was not reached
     */
    function claimRefund() external {
        if (!isFinalized) {
            if (block.timestamp <= deadline) revert CampaignNotExpired();
            _finalize();
        }
        
        if (isSuccessful) revert TargetAlreadyReached();
        
        uint256 contribution = contributions[msg.sender];
        if (contribution == 0) revert NoContribution();
        
        contributions[msg.sender] = 0;
        
        (bool success, ) = msg.sender.call{value: contribution}("");
        if (!success) revert TransferFailed();
        
        emit RefundIssued(msg.sender, contribution);
    }
    
    /**
     * @notice Get campaign status
     */
    function getCampaignStatus() external view returns (
        uint256 _totalRaised,
        uint256 _targetAmount,
        uint256 _deadline,
        uint256 _timeRemaining,
        bool _isFinalized,
        bool _isSuccessful,
        uint256 _contributorCount
    ) {
        return (
            totalRaised,
            targetAmount,
            deadline,
            block.timestamp > deadline ? 0 : deadline - block.timestamp,
            isFinalized,
            isSuccessful,
            contributors.length
        );
    }
    
    /**
     * @notice Get contribution amount for an address
     */
    function getContribution(address contributor) external view returns (uint256) {
        return contributions[contributor];
    }
    
    /**
     * @notice Get all contributors
     */
    function getContributors() external view returns (address[] memory) {
        return contributors;
    }
    
    /**
     * @notice Calculate percentage of target reached
     */
    function getProgressPercentage() external view returns (uint256) {
        if (targetAmount == 0) return 0;
        return (totalRaised * 100) / targetAmount;
    }
    
    /**
     * @notice Check if campaign is active
     */
    function isActive() external view returns (bool) {
        return !isFinalized && block.timestamp <= deadline;
    }
    
    /**
     * @notice Receive function to accept direct transfers
     */
    receive() external payable {
        if (block.timestamp > deadline) revert CampaignExpired();
        if (isFinalized) revert AlreadyFinalized();
        
        if (contributions[msg.sender] == 0) {
            contributors.push(msg.sender);
        }
        
        contributions[msg.sender] += msg.value;
        totalRaised += msg.value;
        
        emit ContributionReceived(msg.sender, msg.value, totalRaised);
        
        if (totalRaised >= targetAmount && !isFinalized) {
            _finalize();
        }
    }
}
