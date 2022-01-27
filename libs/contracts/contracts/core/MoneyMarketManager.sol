// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {
  ISynthereumFinder
} from '@jarvis-network/synthereum-contracts/contracts/core/interfaces/IFinder.sol';
import {
  IMoneyMarketManager,
  IMintableBurnableERC20
} from './interfaces/IMoneyMarketManager.sol';
import {SynthereumInterfaces} from './Constants.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';

contract MoneyMarketManager is AccessControlEnumerable, IMoneyMarketManager {
  using SafeERC20 for IERC20;

  mapping(IMintableBurnableERC20 => uint256) private maxCirculatingSupply;
  mapping(IMintableBurnableERC20 => uint256) private circulatingSupply;

  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  ISynthereumFinder public immutable synthereumFinder;

  // Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  modifier onlyMoneyMarketManager() {
    require(
      msg.sender ==
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.MoneyMarketManager
        ),
      'Only mm manager can perform this operation'
    );
    _;
  }

  event Minted(address token, address recipient, uint256 amount);
  event Redeemed(address token, address recipient, uint256 amount);
  event NewMaxSupply(address token, uint256 newMaxSupply);

  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles) {
    synthereumFinder = _synthereumFinder;

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  function mint(IMintableBurnableERC20 token, uint256 amount)
    external
    override
    onlyMoneyMarketManager()
    returns (uint256 newCirculatingSupply)
  {
    newCirculatingSupply = amount + circulatingSupply[token];
    require(
      newCirculatingSupply <= maxCirculatingSupply[token],
      'Minting over max limit'
    );
    circulatingSupply[token] = newCirculatingSupply;
    token.mint(msg.sender, amount);
    emit Minted(address(token), msg.sender, amount);
  }

  function redeem(IMintableBurnableERC20 token, uint256 amount)
    external
    override
    onlyMoneyMarketManager()
    returns (uint256 newCirculatingSupply)
  {
    uint256 actualSupply = circulatingSupply[token];
    require(amount < actualSupply, 'Redeeming more than circulating supply');
    IERC20(token).safeTransferFrom(msg.sender, address(this), amount);
    newCirculatingSupply = actualSupply - amount;
    circulatingSupply[token] = newCirculatingSupply;
    token.burn(amount);
    emit Redeemed(address(token), msg.sender, amount);
  }

  function setMaxSupply(IMintableBurnableERC20 token, uint256 newMaxSupply)
    external
    override
    onlyMaintainer()
  {
    maxCirculatingSupply[token] = newMaxSupply;
    emit NewMaxSupply(address(token), newMaxSupply);
  }

  function maxSupply(IMintableBurnableERC20 token)
    external
    view
    override
    returns (uint256 maxCircSupply)
  {
    maxCircSupply = maxCirculatingSupply[token];
  }

  function supply(IMintableBurnableERC20 token)
    external
    view
    override
    returns (uint256 circSupply)
  {
    circSupply = circulatingSupply[token];
  }
}
