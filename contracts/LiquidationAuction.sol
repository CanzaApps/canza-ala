//SPDX-License-Identifier: Unlicensed
pragma solidity ^0.8.18;
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

contract LiquidationAuction {

    struct DepositPositions {

        address depositorAddress;
        uint256 depositAmount;
        uint256 claimableCollateral;

    }


    struct Bracket {
        
        uint256 bracketDepositTotal;
        uint256 bracketCollateralTotal;
        mapping (address=>DepositPositions) userPositions ;

    }

    
    uint256[] public bracketList;
    mapping (uint256=>bool) public bracketUsed;

    uint256 public basisPoints = 10000;


    mapping (uint256=>address[]) public depositorList;
    mapping (uint256=>Bracket) public auctionBook;


    function deposit (uint256 _bracket, uint256 _amount) public{

        auctionBook[_bracket].bracketDepositTotal += _amount;

        auctionBook[_bracket].userPositions[msg.sender].depositAmount += _amount;
        auctionBook[_bracket].userPositions[msg.sender].depositorAddress = msg.sender;

        
        bracketList.push(_bracket);
        depositorList[_bracket].push(msg.sender);

    }
    
    function liquidate (uint256 _amount) public {

        uint256 remainingLiquidation = _amount;
        uint256 numberOfBrackets = bracketList.length;
        uint256 bracketCount;


        while (remainingLiquidation != 0 || bracketCount < numberOfBrackets){

            for (uint256 _bracketID = 0; _bracketID < bracketList.length; _bracketID++){
                
                uint256 _bracket = bracketList[_bracketID];

                uint256 bracketReward;

                if(remainingLiquidation >= auctionBook[_bracketID].bracketDepositTotal){

                    bracketReward = auctionBook[_bracketID].bracketDepositTotal * _bracket / basisPoints;
                    bracketReward += auctionBook[_bracketID].bracketDepositTotal;

                    for(uint256 _userID = 0; _userID < depositorList[_bracketID].length; _userID++){

                        address _userAddress = depositorList[_bracketID][_userID];

                        uint256 a = auctionBook[_bracket].userPositions[_userAddress].depositAmount*1000;
                        uint256 b = auctionBook[_bracket].bracketDepositTotal;

                        uint256 c = remainingLiquidation * a/b;
                        uint256 d = bracketReward * a/b;

                        c = c/1000;
                        d = d/1000;

                        auctionBook[_bracket].userPositions[_userAddress].depositAmount = 0;
                        auctionBook[_bracket].userPositions[_userAddress].claimableCollateral += d;

                    }

                    auctionBook[_bracket].bracketCollateralTotal += bracketReward;

                    remainingLiquidation -= auctionBook[_bracket].bracketDepositTotal;
                    auctionBook[_bracket].bracketDepositTotal = 0;

                }else{

                    bracketReward = remainingLiquidation * _bracket / basisPoints;
                    bracketReward += remainingLiquidation;

                    for(uint256 _userID = 0; _userID < depositorList[_bracketID].length; _userID++){

                        address _userAddress = depositorList[_bracketID][_userID];

                        uint256 a = auctionBook[_bracket].userPositions[_userAddress].depositAmount*1000;
                        uint256 b = auctionBook[_bracket].bracketDepositTotal;

                        uint256 c = remainingLiquidation * a/b;
                        uint256 d = bracketReward * a/b;

                        c = c/1000;
                        d = d/1000;

                        auctionBook[_bracket].userPositions[_userAddress].depositAmount -= c;
                        auctionBook[_bracket].userPositions[_userAddress].claimableCollateral += d;

                    }

                    auctionBook[_bracket].bracketCollateralTotal += bracketReward;

                    auctionBook[_bracket].bracketDepositTotal -= remainingLiquidation;
                    remainingLiquidation = 0;

                }

                bracketCount++;

            }
            
        }

    }

}
