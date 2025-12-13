// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "./EscrowFactoryUpgradeable.sol";

/**
 * @title EscrowFactoryV2Upgradeable
 * @notice Example V2 with an added helper `version()` to verify upgrades
 */
contract EscrowFactoryV2Upgradeable is EscrowFactoryUpgradeable {
    function version() public pure returns (string memory) {
        return "v2";
    }
}
