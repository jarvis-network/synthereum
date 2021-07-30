// SPDX-License-Identifier: MIT

pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "./Aureus.sol";

contract AerariumSanctius is Ownable {
    
    using SafeMath for uint256;
    using SafeERC20 for RewardToken;
    using SafeERC20 for IERC20;
    
    struct TokenHoldings {
        IERC20 token;
        uint256 amount;
        bool initialized;
    }
    
    RewardToken public rwdToken;
    
    TokenHoldings[] public tokensHeld;

    uint256 endBlock;

    function setRewardToken(RewardToken _rwdToken) public onlyOwner {
        require(block.number > endBlock, "There is a program still running");
        rwdToken = _rwdToken;
    }

    function setReleaseTime(uint256 _endBlock) public onlyOwner {
        require(block.number > endBlock, "There is a program still running");
        endBlock = _endBlock;
    }

    function withdrawExcess(address main) public onlyOwner {
        require(rwdToken.balanceOf(main) == 0, "The balance of Etruria is not 0");
        for (uint256 i=0; i<tokensHeld.length; i++) {
            uint256 amount = tokensHeld[i].amount;
            tokensHeld[i].token.safeTransfer(msg.sender, amount);
        }
    }           

    function checkTokenAvailability(IERC20 _token) internal view returns(bool check, uint256 index){
        for (uint256 i=0; i<tokensHeld.length; i++) {
            if(tokensHeld[i].token == _token) {
                index = i;
                return (check, i);
            }
        }
    }
    
    function addTokens(IERC20 _token, uint256 _amount) public {
        _token.safeTransferFrom(msg.sender,address(this), _amount);
        (, uint256 index) = checkTokenAvailability(_token);
        (bool check, ) = checkTokenAvailability(_token);
        if (check == true){
            uint256 amount = tokensHeld[index].amount.add(_amount);
            tokensHeld[index].amount = amount;
        }
        else{
            tokensHeld.push(
                TokenHoldings({
                    token: _token,
                    amount: _amount,
                    initialized: true
                })
            );
        }   
    }

    function _withdraw(uint256 percentage) internal {
        for (uint256 i=0; i<tokensHeld.length; i++) {
            uint256 currentAmount = tokensHeld[i].amount
            uint256 _amount = currentAmount.mul(percentage).div(10000);
            tokensHeld[i].token.safeTransfer(msg.sender, _amount);
            uint256 newAmount = currentAmount.sub(_amount);
            tokensHeld[i].amount = newAmount;
        }
       
    }

    function claim(uint256 rwdAmount) public {
        require(block.number > endBlock, "The end time of the program is not reached!");
        uint256 percentage = (rwdAmount.mul(10000)).div(rwdToken.totalSupply());
        rwdToken.burn(msg.sender, rwdAmount);
        _withdraw(percentage);
    }
 
    
}