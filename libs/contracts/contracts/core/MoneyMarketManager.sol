// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {IJarvisBrrrrr} from './interfaces/IJarvisBrrrrr.sol';
import {IJarvisBrrMoneyMarket} from './interfaces/IJarvisBrrMoneyMarket.sol';
import {IMoneyMarketManager} from './interfaces/IMoneyMarketManager.sol';
import {
  IMintableBurnableERC20
} from '../tokens/interfaces/IMintableBurnableERC20.sol';
import {SynthereumInterfaces} from './Constants.sol';
import {
  SafeERC20
} from '@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol';
import {
  AccessControlEnumerable
} from '@openzeppelin/contracts/access/AccessControlEnumerable.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {Address} from '@openzeppelin/contracts/utils/Address.sol';

contract MoneyMarketManager is
  AccessControlEnumerable,
  IMoneyMarketManager,
  ReentrancyGuard
{
  using SafeERC20 for IERC20;
  using SafeERC20 for IMintableBurnableERC20;
  using Address for address;

  mapping(bytes32 => address) public idToMoneyMarketImplementation;
  mapping(address => bytes) public moneyMarketArgs;
  mapping(bytes32 => mapping(address => uint256)) public moneyMarketBalances;

  string public constant DEPOSIT_SIG = 'deposit(address,uint256,bytes,bytes)';
  string public constant WITHDRAW_SIG = 'withdraw(address,uint256,bytes,bytes)';
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

  event RegisteredImplementation(string id, address implementation, bytes args);
  event MintAndDeposit(address token, string moneyMarketId, uint256 amount);
  event RedeemAndBurn(address token, string moneyMarketId, uint256 amount);
  event WithdrawRevenues(
    address token,
    string moneyMarketId,
    uint256 amount,
    address receiver
  );

  constructor(address _synthereumFinder, Roles memory _roles) {
    synthereumFinder = ISynthereumFinder(_synthereumFinder);

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  function registerMoneyMarketImplementation(
    string memory id,
    address implementation,
    bytes memory extraArgs
  ) external override onlyMaintainer nonReentrant {
    idToMoneyMarketImplementation[keccak256(abi.encode(id))] = implementation;
    moneyMarketArgs[implementation] = extraArgs;

    emit RegisteredImplementation(id, implementation, extraArgs);
  }

  function deposit(
    IMintableBurnableERC20 token,
    uint256 amount,
    string memory moneyMarketId,
    bytes memory implementationCallArgs
  ) external override onlyMaintainer nonReentrant returns (uint256 tokensOut) {
    // trigger minting of synths from the printer contract
    address jarvisBrr =
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.JarvisBrrrrr
      );
    IJarvisBrrrrr(jarvisBrr).mint(token, amount);

    // deposit into money market through delegate-call
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    address implementation = idToMoneyMarketImplementation[hashId];

    moneyMarketBalances[hashId][address(token)] += amount;

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          DEPOSIT_SIG,
          address(token),
          amount,
          moneyMarketArgs[implementation],
          implementationCallArgs
        )
      );
    tokensOut = abi.decode(result, (uint256));

    emit MintAndDeposit(address(token), moneyMarketId, tokensOut);
  }

  function withdraw(
    IMintableBurnableERC20 token,
    uint256 amount,
    string memory moneyMarketId,
    bytes memory implementationCallArgs
  )
    external
    override
    onlyMaintainer
    nonReentrant
    returns (uint256 burningAmount)
  {
    // withdraw from money market through delegate call
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    address implementation = idToMoneyMarketImplementation[hashId];
    require(
      amount <= moneyMarketBalances[hashId][address(token)],
      'Max amount limit'
    );

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          address(token),
          amount,
          moneyMarketArgs[implementation],
          implementationCallArgs
        )
      );

    burningAmount = abi.decode(result, (uint256));
    moneyMarketBalances[hashId][address(token)] -= burningAmount;

    // trigger burning of tokens on the printer contract
    address jarvisBrr =
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.JarvisBrrrrr
      );
    token.safeIncreaseAllowance(jarvisBrr, burningAmount);
    IJarvisBrrrrr(jarvisBrr).redeem(token, burningAmount);

    emit RedeemAndBurn(address(token), moneyMarketId, burningAmount);
  }

  function withdrawRevenue(
    IMintableBurnableERC20 jSynthAsset,
    string memory moneyMarketId,
    bytes memory implementationCallArgs
  ) external override onlyMaintainer nonReentrant returns (uint256 jSynthOut) {
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    address implementation = idToMoneyMarketImplementation[hashId];
    bytes memory args = moneyMarketArgs[implementation];

    // get total balance from money market implementation (deposit + interest)
    uint256 totalBalance =
      IJarvisBrrMoneyMarket(implementation).getTotalBalance(
        address(jSynthAsset),
        args,
        implementationCallArgs
      );

    uint256 revenues =
      totalBalance - moneyMarketBalances[hashId][address(jSynthAsset)];
    require(revenues > 0, 'No revenues');

    // withdraw revenues
    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          address(jSynthAsset),
          revenues,
          args,
          implementationCallArgs
        )
      );

    // send them to dao
    jSynthOut = abi.decode(result, (uint256));
    jSynthAsset.transfer(msg.sender, jSynthOut);

    emit WithdrawRevenues(
      address(jSynthAsset),
      moneyMarketId,
      jSynthOut,
      msg.sender
    );
  }

  function getMoneyMarketDeposited(
    address jSynthAsset,
    string memory moneyMarketId
  ) external override returns (uint256 amount) {
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    amount = moneyMarketBalances[hashId][jSynthAsset];
  }
}
