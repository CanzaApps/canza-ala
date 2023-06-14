//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/math/Math.sol";

contract poolContract {
    uint256 public liquidationPercentage;
    address public currencyDeposit;
    address public currencyLiquidation;

    uint256 basisPoints = 10000;

    mapping(address => uint256) public depositUser;
    mapping(address => uint256) public claimeableUser;

    uint256 public claimableTotal;
    uint256 public depositTotal;
    uint256 public liqudationsTotal;

    address[] public users;
    mapping(address => bool) public onUserList;

    address controllerAddress;

    constructor(
        uint256 _liquidationPercentage,
        address _currencyDeposit,
        address _currencyLiquidation
    ) {
        liquidationPercentage = _liquidationPercentage;

        currencyDeposit = _currencyDeposit;
        currencyLiquidation = _currencyLiquidation;
        controllerAddress = msg.sender;
    }

    function deposit(uint256 _amount) public payable {
        _transferFrom(_amount, currencyDeposit);

        depositUser[msg.sender] += _amount;
        depositTotal += _amount;

        if (!onUserList[msg.sender]) {
            users.push(msg.sender);
            onUserList[msg.sender] = true;
        }
    }

    function withdraw(uint256 _amount) public {
        require(_amount <= depositUser[msg.sender], "Not enough deposit");
        _transferTo(_amount, msg.sender, currencyDeposit);

        depositUser[msg.sender] -= _amount;
        depositTotal -= _amount;
    }

    function calculatePayout(
        uint256 _amountToLiquidate
    ) public view returns (uint256) {
        uint256 amountToLiquidate = Math.min(_amountToLiquidate, depositTotal);
        uint256 payout = (amountToLiquidate * liquidationPercentage) /
            basisPoints;
        payout += amountToLiquidate;

        return payout;
    }

    //@DEV-TODO needs only owner lock
    function releaseDeposits(uint256 _amountToLiquidate) public {
        require(msg.sender == controllerAddress, "Not Controller");
        require(_amountToLiquidate <= depositTotal, "Trying to Over Liquidate");

        _amountToLiquidate = Math.min(_amountToLiquidate, depositTotal);

        _transferTo(_amountToLiquidate, msg.sender, currencyDeposit);
    }

    //@DEV-TODO: Needs only owner lock
    function payCollateral(uint256 _amountToLiquidate) public payable {
        require(msg.sender == controllerAddress, "Not Controller");
        if (depositTotal != 0) {
            uint256 payout = calculatePayout(_amountToLiquidate);

            for (uint256 i = 0; i < users.length; i++) {
                address userAddress = users[i];

                uint256 y = (payout * depositUser[userAddress] * 1000) /
                    depositTotal;
                y = y / 1000;
                claimeableUser[userAddress] += y;

                uint256 x = (_amountToLiquidate *
                    depositUser[userAddress] *
                    1000) / depositTotal;
                x = x / 1000;
                depositUser[userAddress] -= x;
            }

            depositTotal -= _amountToLiquidate;
            claimableTotal += payout;
            liqudationsTotal += payout;
        }
    }

    function claimRewards() public {
        uint256 claimAmount = claimeableUser[msg.sender];
        _transferTo(claimAmount, msg.sender, currencyLiquidation);

        claimableTotal -= claimAmount;
        claimeableUser[msg.sender] = 0;
    }

    function _transferFrom(uint256 _amount, address _currency) internal {
        address currency = _currency;

        require(
            IERC20(currency).balanceOf(msg.sender) >= _amount,
            "Insufficient balance"
        );

        bool transferSuccess = IERC20(currency).transferFrom(
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
        address currency = _currency;

        require(
            IERC20(currency).balanceOf(address(this)) >= _amount,
            "Insufficient Balance"
        );
        bool transferSuccess = IERC20(currency).transfer(_user, _amount);

        if (!transferSuccess) revert();
    }
}
