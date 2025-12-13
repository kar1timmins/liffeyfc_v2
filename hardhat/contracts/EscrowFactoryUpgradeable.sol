// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./CompanyWishlistEscrow.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";

/**
 * @title EscrowFactoryUpgradeable
 * @notice Upgradeable UUPS factory for deploying CompanyWishlistEscrow contracts
 */
contract EscrowFactoryUpgradeable is Initializable, OwnableUpgradeable, UUPSUpgradeable {
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

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(address owner_) public initializer {
        __Ownable_init();
        __UUPSUpgradeable_init();
        transferOwnership(owner_);
    }

    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}

    /**
     * @notice Create a new escrow contract
     */
    function createEscrow(
        address _company,
        address _masterWallet,
        uint256 _targetAmount,
        uint256 _durationInDays,
        string calldata _campaignName,
        string calldata _campaignDescription
    ) external returns (address escrowAddress) {
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

    function getCompanyEscrows(address _company) external view returns (address[] memory) {
        return companyEscrows[_company];
    }

    function getEscrowCount() external view returns (uint256) {
        return allEscrows.length;
    }

    function getAllEscrows() external view returns (address[] memory) {
        return allEscrows;
    }

    function getEscrowCompany(address _escrow) external view returns (address) {
        return escrowToCompany[_escrow];
    }

    // storage gap for upgrade safety
    uint256[50] private __gap;
}
