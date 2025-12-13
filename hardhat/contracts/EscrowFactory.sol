// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CompanyWishlistEscrow.sol";

/**
 * @title EscrowFactory
 * @notice Factory contract for deploying CompanyWishlistEscrow contracts
 * @dev Tracks all deployed escrow contracts and provides lookup functionality
 */
contract EscrowFactory {
    // Array of all deployed escrow contracts
    address[] public allEscrows;
    
    // Mapping from company address to their escrow contracts
    mapping(address => address[]) public companyEscrows;
    
    // Mapping from escrow address to company address
    mapping(address => address) public escrowToCompany;
    
    // Events
    event EscrowCreated(
        address indexed escrowAddress,
        address indexed company,
        uint256 targetAmount,
        uint256 deadline,
        uint256 timestamp,
        string campaignName,
        string campaignDescription
    );
    
    /**
     * @notice Create a new escrow contract
     * @param _company Company address (child wallet)
     * @param _masterWallet Master wallet address for automatic fund forwarding
     * @param _targetAmount Target amount in wei
     * @param _durationInDays Campaign duration in days
     * @return escrowAddress Address of the newly created escrow contract
     */
    function createEscrow(
        address _company,
        address _masterWallet,
        uint256 _targetAmount,
        uint256 _durationInDays,
        string calldata _campaignName,
        string calldata _campaignDescription
    ) external returns (address escrowAddress) {
        // Deploy new escrow contract
        CompanyWishlistEscrow escrow = new CompanyWishlistEscrow(
            _company,
            _masterWallet,
            _targetAmount,
            _durationInDays,
            _campaignName,
            _campaignDescription
        );
        
        escrowAddress = address(escrow);
        
        // Track the escrow
        allEscrows.push(escrowAddress);
        companyEscrows[_company].push(escrowAddress);
        escrowToCompany[escrowAddress] = _company;
        
        emit EscrowCreated(
            escrowAddress,
            _company,
            _targetAmount,
            block.timestamp + (_durationInDays * 1 days),
            block.timestamp,
            _campaignName,
            _campaignDescription
        );
        
        return escrowAddress;
    }
    
    /**
     * @notice Get all escrow contracts for a company
     */
    function getCompanyEscrows(address _company) external view returns (address[] memory) {
        return companyEscrows[_company];
    }
    
    /**
     * @notice Get total number of escrows
     */
    function getEscrowCount() external view returns (uint256) {
        return allEscrows.length;
    }
    
    /**
     * @notice Get all escrows
     */
    function getAllEscrows() external view returns (address[] memory) {
        return allEscrows;
    }
    
    /**
     * @notice Get company address for an escrow
     */
    function getEscrowCompany(address _escrow) external view returns (address) {
        return escrowToCompany[_escrow];
    }
    
    /**
     * @notice Get escrow details
     */
    function getEscrowDetails(address _escrow) external view returns (
        address company,
        uint256 totalRaised,
        uint256 targetAmount,
        uint256 deadline,
        bool isFinalized,
        bool isSuccessful,
        string memory campaignName,
        string memory campaignDescription
    ) {
        CompanyWishlistEscrow escrow = CompanyWishlistEscrow(payable(_escrow));
        
        company = escrow.company();
        totalRaised = escrow.totalRaised();
        targetAmount = escrow.targetAmount();
        deadline = escrow.deadline();
        isFinalized = escrow.isFinalized();
        isSuccessful = escrow.isSuccessful();
        campaignName = escrow.campaignName();
        campaignDescription = escrow.campaignDescription();
    }
}
