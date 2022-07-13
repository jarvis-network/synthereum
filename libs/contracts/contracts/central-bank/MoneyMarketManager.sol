// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from '../core/interfaces/IFinder.sol';
import {IJarvisBrrrrr} from './interfaces/IJarvisBrrrrr.sol';
import {IJarvisBrrMoneyMarket} from './interfaces/IJarvisBrrMoneyMarket.sol';
import {IMoneyMarketManager} from './interfaces/IMoneyMarketManager.sol';
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
import {Address} from '@openzeppelin/contracts/utils/Address.sol';

contract MoneyMarketManager is
  IMoneyMarketManager,
  ReentrancyGuard,
  AccessControlEnumerable
{
  using SafeERC20 for IERC20;
  using SafeERC20 for IMintableBurnableERC20;
  using Address for address;

  // Describe role structure
  struct Roles {
    address admin;
    address maintainer;
  }

  string private constant DEPOSIT_SIG = 'deposit(address,uint256,bytes,bytes)';
  string private constant WITHDRAW_SIG =
    'withdraw(address,uint256,bytes,bytes)';
  bytes32 public constant MAINTAINER_ROLE = keccak256('Maintainer');

  ISynthereumFinder public immutable synthereumFinder;

  mapping(bytes32 => Implementation) private idToImplementation;
  mapping(bytes32 => mapping(address => uint256)) private moneyMarketBalances;

  event RegisteredImplementation(
    string indexed id,
    address implementation,
    bytes args
  );
  event MintAndDeposit(
    address indexed token,
    string indexed moneyMarketId,
    uint256 amount
  );
  event RedeemAndBurn(
    address indexed token,
    string indexed moneyMarketId,
    uint256 amount
  );
  event WithdrawRevenues(
    address indexed token,
    string indexed moneyMarketId,
    uint256 amount,
    address receiver
  );

  modifier onlyMaintainer() {
    require(
      hasRole(MAINTAINER_ROLE, msg.sender),
      'Sender must be the maintainer'
    );
    _;
  }

  constructor(address _synthereumFinder, Roles memory _roles) {
    synthereumFinder = ISynthereumFinder(_synthereumFinder);

    _setRoleAdmin(DEFAULT_ADMIN_ROLE, DEFAULT_ADMIN_ROLE);
    _setRoleAdmin(MAINTAINER_ROLE, DEFAULT_ADMIN_ROLE);
    _setupRole(DEFAULT_ADMIN_ROLE, _roles.admin);
    _setupRole(MAINTAINER_ROLE, _roles.maintainer);
  }

  function registerMoneyMarketImplementation(
    string calldata id,
    address implementation,
    bytes calldata extraArgs
  ) external override onlyMaintainer nonReentrant {
    bytes32 implementationId = keccak256(abi.encode(id));
    require(implementationId != 0x00, 'Wrong module identifier');

    idToImplementation[implementationId] = Implementation(
      implementation,
      extraArgs
    );

    emit RegisteredImplementation(id, implementation, extraArgs);
  }

  function deposit(
    IMintableBurnableERC20 token,
    uint256 amount,
    string calldata moneyMarketId,
    bytes calldata implementationCallArgs
  ) external override onlyMaintainer nonReentrant returns (uint256 tokensOut) {
    // trigger minting of synths from the printer contract
    address jarvisBrr =
      synthereumFinder.getImplementationAddress(
        SynthereumInterfaces.JarvisBrrrrr
      );
    IJarvisBrrrrr(jarvisBrr).mint(token, amount);

    // deposit into money market through delegate-call
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    Implementation memory implementation = idToImplementation[hashId];

    moneyMarketBalances[hashId][address(token)] += amount;

    bytes memory result =
      implementation.implementationAddr.functionDelegateCall(
        abi.encodeWithSignature(
          DEPOSIT_SIG,
          address(token),
          amount,
          implementation.moneyMarketArgs,
          implementationCallArgs
        )
      );
    tokensOut = abi.decode(result, (uint256));

    emit MintAndDeposit(address(token), moneyMarketId, amount);
  }

  function withdraw(
    IMintableBurnableERC20 token,
    uint256 amount,
    string calldata moneyMarketId,
    bytes calldata implementationCallArgs
  )
    external
    override
    onlyMaintainer
    nonReentrant
    returns (uint256 burningAmount)
  {
    // withdraw from money market through delegate call
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    Implementation memory implementation = idToImplementation[hashId];
    require(
      amount <= moneyMarketBalances[hashId][address(token)],
      'Max amount limit'
    );

    bytes memory result =
      implementation.implementationAddr.functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          address(token),
          amount,
          implementation.moneyMarketArgs,
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
    address recipient,
    string memory moneyMarketId,
    bytes memory implementationCallArgs
  ) external override onlyMaintainer nonReentrant returns (uint256 jSynthOut) {
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    Implementation memory implementation = idToImplementation[hashId];

    // get total balance from money market implementation (deposit + interest)
    uint256 totalBalance =
      IJarvisBrrMoneyMarket(implementation.implementationAddr).getTotalBalance(
        address(jSynthAsset),
        implementation.moneyMarketArgs,
        implementationCallArgs
      );

    uint256 revenues =
      totalBalance - moneyMarketBalances[hashId][address(jSynthAsset)];
    require(revenues > 0, 'No revenues');

    // withdraw revenues
    bytes memory result =
      implementation.implementationAddr.functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          address(jSynthAsset),
          revenues,
          implementation.moneyMarketArgs,
          implementationCallArgs
        )
      );

    // send them to dao
    jSynthOut = abi.decode(result, (uint256));

    // burn eventual withdrawn excess
    if (jSynthOut > revenues) {
      address jarvisBrr =
        synthereumFinder.getImplementationAddress(
          SynthereumInterfaces.JarvisBrrrrr
        );
      uint256 burningAmount = jSynthOut - revenues;

      jSynthAsset.safeIncreaseAllowance(jarvisBrr, burningAmount);
      IJarvisBrrrrr(jarvisBrr).redeem(jSynthAsset, burningAmount);
      moneyMarketBalances[hashId][address(jSynthAsset)] -= burningAmount;
    }

    jSynthAsset.transfer(recipient, revenues);

    emit WithdrawRevenues(
      address(jSynthAsset),
      moneyMarketId,
      revenues,
      recipient
    );
  }

  function getMoneyMarketDeposited(
    string calldata moneyMarketId,
    address jSynthAsset
  ) external view override returns (uint256 amount) {
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    amount = moneyMarketBalances[hashId][jSynthAsset];
  }

  function getMoneyMarketImplementation(string calldata moneyMarketId)
    external
    view
    override
    returns (Implementation memory implementation)
  {
    bytes32 hashId = keccak256(abi.encode(moneyMarketId));
    implementation = idToImplementation[hashId];
    require(
      implementation.implementationAddr != address(0),
      'Implementation not supported'
    );
  }
}
