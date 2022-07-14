// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {IJarvisBrrrrr} from './interfaces/IJarvisBrrrrr.sol';
import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {SynthereumInterfaces} from '../core/Constants.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';

contract JarvisBrrrrr is
  IJarvisBrrrrr,
  ReentrancyGuard,
  AccessControlEnumerable
{
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

  event Minted(address indexed token, address recipient, uint256 amount);
  event Redeemed(address indexed token, address recipient, uint256 amount);
  event NewMaxSupply(address indexed token, uint256 newMaxSupply);

  constructor(ISynthereumFinder _synthereumFinder, Roles memory _roles) {
    synthereumFinder = _synthereumFinder;

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  /**
   * @notice Mints synthetic token without collateral to a pre-defined address (SynthereumMoneyMarketManager)
   * @param _token Synthetic token address to mint
   * @param _amount Amount of tokens to mint
   * @return newCirculatingSupply New circulating supply in Money Market
   */
  function mint(IMintableBurnableERC20 _token, uint256 _amount)
    external
    override
    onlyMoneyMarketManager
    nonReentrant
    returns (uint256 newCirculatingSupply)
  {
    newCirculatingSupply = _amount + circulatingSupply[_token];
    require(
      newCirculatingSupply <= maxCirculatingSupply[_token],
      'Minting over max limit'
    );
    circulatingSupply[_token] = newCirculatingSupply;
    _token.mint(msg.sender, _amount);
    emit Minted(address(_token), msg.sender, _amount);
  }

  /**
   * @notice Burns synthetic token without releasing collateral from the pre-defined address (SynthereumMoneyMarketManager)
   * @param _token Synthetic token address to burn
   * @param _amount Amount of tokens to burn
   * @return newCirculatingSupply New circulating supply in Money Market
   */
  function redeem(IMintableBurnableERC20 _token, uint256 _amount)
    external
    override
    onlyMoneyMarketManager
    nonReentrant
    returns (uint256 newCirculatingSupply)
  {
    uint256 actualSupply = circulatingSupply[_token];
    IERC20(_token).safeTransferFrom(msg.sender, address(this), _amount);
    newCirculatingSupply = actualSupply - _amount;
    circulatingSupply[_token] = newCirculatingSupply;
    _token.burn(_amount);
    emit Redeemed(address(_token), msg.sender, _amount);
  }

  /**
   * @notice Sets the max circulating supply that can be minted for a specific token - only manager can set this
   * @param _token Synthetic token address to set
   * @param _newMaxSupply New Max supply value of the token
   */
  function setMaxSupply(IMintableBurnableERC20 _token, uint256 _newMaxSupply)
    external
    override
    onlyMaintainer
    nonReentrant
  {
    maxCirculatingSupply[_token] = _newMaxSupply;
    emit NewMaxSupply(address(_token), _newMaxSupply);
  }

  /**
   * @notice Returns the max circulating supply of a synthetic token
   * @param _token Synthetic token address
   * @return maxCircSupply Max supply of the token
   */
  function maxSupply(IMintableBurnableERC20 _token)
    external
    view
    override
    returns (uint256 maxCircSupply)
  {
    maxCircSupply = maxCirculatingSupply[_token];
  }

  /**
   * @notice Returns the circulating supply of a synthetic token
   * @param _token Synthetic token address
   * @return circSupply Circulating supply of the token
   */
  function supply(IMintableBurnableERC20 _token)
    external
    view
    override
    returns (uint256 circSupply)
  {
    circSupply = circulatingSupply[_token];
  }
}
