//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "./pool.sol";

contract Controller is
    Initializable,
    ReentrancyGuardUpgradeable,
    OwnableUpgradeable
{
    poolContract public auctionPool;
    uint256 public auctionId;
    address[] public deployments;

    struct auctionData {
        uint256 intervals;
        uint256 percentageInterval;
        address currencyDeposit;
        address currencyLiquidation;
        address[] poolAddress;
    }

    mapping(uint256 => auctionData) public openAuctions;

    function init() external initializer {
        __Ownable_init();
    }

    function createAuction(
        uint256 _liquidationPercentageInterval,
        uint256 _intervals,
        address _currencyDeposit,
        address _currencyLiquidation
    ) public {
        uint256 liquidationPercentage;
        openAuctions[auctionId].intervals = _intervals;
        openAuctions[auctionId]
            .percentageInterval = _liquidationPercentageInterval;
        openAuctions[auctionId].currencyDeposit = _currencyDeposit;
        openAuctions[auctionId].currencyLiquidation = _currencyLiquidation;

        for (uint256 i = 1; i < _intervals + 1; i++) {
            liquidationPercentage = _liquidationPercentageInterval * i;

            auctionPool = new poolContract(
                liquidationPercentage,
                _currencyDeposit,
                _currencyLiquidation
            );

            address contractAddress = address(auctionPool);
            openAuctions[auctionId].poolAddress.push(contractAddress);

            deployments.push(address(auctionPool));
        }

        auctionId++;
    }

    //Needs a liquidation function to trigger liquidation
    //Needs to check totals in each pool, ensure that there is enough to liquidate
    //Needs to get required payout from each pool
    //Subtract from running balance (remaining to liquidate)
    //Loop until done

    function liquidate(uint256 _amountToLiquidate, uint256 _auctionId) public {
        poolContract activeContract;

        uint256 runningBalance = _amountToLiquidate;
        uint256 auctionIntervals = openAuctions[_auctionId].intervals;
        uint256 i;

        do {
            address _address = openAuctions[_auctionId].poolAddress[i];
            activeContract = poolContract(_address);

            uint256 depositTotal = activeContract.depositTotal();

            uint256 x = Math.min(depositTotal, runningBalance);

            uint256 payout = activeContract.calculatePayout(x);

            activeContract.releaseDeposits(x);

            //This is where it would call liquidation function and send deposit

            address currency = activeContract.currencyLiquidation();
            _transferTo(payout, _address, currency);

            activeContract.payCollateral(x);

            runningBalance -= x;

            i++;
        } while (runningBalance > 0 && i < auctionIntervals);
    }

    function getPoolAddress(
        uint256 _loanId
    ) public view returns (address[] memory) {
        return openAuctions[_loanId].poolAddress;
    }

    function getdeploymentList() public view returns (address[] memory) {
        return deployments;
    }

    function getAuctionDetails(
        uint256 _auctionId
    ) public view returns (auctionData memory) {
        return openAuctions[_auctionId];
    }

    function calculatePotentialPayout(
        uint256 _amountToLiquidate,
        uint256 _auctionId
    ) public view returns (uint256 payout) {
        poolContract activeContract;
        uint256 runningBalance = _amountToLiquidate;
        uint256 auctionIntervals = openAuctions[_auctionId].intervals;
        uint256 i;
        uint256 potentialPayout;

        do {
            address _address = openAuctions[_auctionId].poolAddress[i];
            activeContract = poolContract(_address);

            uint256 depositTotal = activeContract.depositTotal();

            uint256 x = Math.min(depositTotal, runningBalance);

            potentialPayout += activeContract.calculatePayout(x);
            runningBalance -= x;
            i++;
        } while (runningBalance > 0 && i < auctionIntervals);

        return potentialPayout;
    }

    function _transferFrom(uint256 _amount, address _currency) internal {
        require(
            IERC20(_currency).balanceOf(msg.sender) >= _amount,
            "Insufficient balance"
        );

        bool transferSuccess = IERC20(_currency).transferFrom(
            msg.sender,
            address(this),
            _amount
        );

        if (!transferSuccess) revert();
    }

    function _transferTo(
        uint256 _amount,
        address _user,
        address _currency
    ) internal {
        require(
            IERC20(_currency).balanceOf(address(this)) >= _amount,
            "Insufficient Balance"
        );

        bool transferSuccess = IERC20(_currency).transfer(_user, _amount);

        if (!transferSuccess) revert();
    }
}
