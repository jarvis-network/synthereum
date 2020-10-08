pragma solidity >=0.6.0 <0.7.0;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';

abstract contract IRToken is IERC20 {
  IERC20 public token;

  function redeemAndTransfer(address redeemTo, uint256 redeemTokens)
    external
    virtual
    returns (bool);

  function createHat(
    address[] calldata recipients,
    uint32[] calldata proportions,
    bool doChangeHat
  ) external virtual returns (uint256 hatID);

  function mintWithSelectedHat(uint256 mintAmount, uint256 hatID)
    external
    virtual
    returns (bool);
}
