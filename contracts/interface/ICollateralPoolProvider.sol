//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;

interface ICollateralPoolProvider {
    function releaseReward(uint256 expectedReward) external;
}