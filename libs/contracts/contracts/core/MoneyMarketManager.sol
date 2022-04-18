// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IERC20} from '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import {ISynthereumFinder} from './interfaces/IFinder.sol';
import {IJarvisBrrrrr} from './interfaces/IJarvisBrrrrr.sol';
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

contract MoneyMarketmanager is
  AccessControlEnumerable,
  IMoneyMarketManager,
  ReentrancyGuard
{
  using SafeERC20 for IERC20;
  using Address for address;

  mapping(bytes32 => address) public idToMoneyMarketImplementation;
  mapping(address => bytes) public moneyMarketArgs;

  string public constant DEPOSIT_SIG = 'deposit(address,uint256,bytes)';
  string public constant WITHDRAW_SIG =
    'withdraw(address,address,uint256,bytes,address)';

  ISynthereumFinder public immutable synthereumFinder;

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

  event RegisteredImplementation(string id, address implementation, bytes args);

  constructor(ISynthereumFinder _synthereumFinder) {
    synthereumFinder = _synthereumFinder;
  }

  function registerMoneyMarketImplementation(
    string memory id,
    address implementation,
    bytes memory extraArgs
  ) external override onlyMoneyMarketManager() nonReentrant {
    idToMoneyMarketImplementation[keccak256(abi.encode(id))] = implementation;
    moneyMarketArgs[implementation] = extraArgs;

    emit RegisteredImplementation(id, implementation, extraArgs);
  }

  function deposit(
    IMintableBurnableERC20 token,
    uint256 amount,
    string memory moneyMarketId
  )
    external
    override
    onlyMoneyMarketManager()
    nonReentrant()
    returns (uint256 tokensOut)
  {
    // trigger minting of synths from the printer contract
    address jarvisBrr =
      ISynthereumFinder(finder).getImplementationAddress(
        SynthereumInterfaces.JarvisBrrrrr
      );
    IJarvisBrrrrr(jarvisBrr).mint(token, amount);

    // deposit into money market through delegate-call
    address implementation =
      idToMoneyMarketImplementation[keccak256(abi.encode(moneyMarketId))];
    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          DEPOSIT_SIG,
          address(token),
          amount,
          moneyMarketArgs[implementation]
        )
      );
    tokensOut = abi.decode(result, (uint256));
  }

  function redeem(
    IMintableBurnableERC20 token,
    address interestToken,
    uint256 amount,
    string memory moneyMarketId
  )
    external
    override
    onlyMoneyMarketManager()
    nonReentrant()
    returns (uint256 burningAmount)
  {
    address jarvisBrr =
      ISynthereumFinder(finder).getImplementationAddress(
        SynthereumInterfaces.JarvisBrrrrr
      );

    // withdraw from money market through delegate call
    address implementation =
      idToMoneyMarketImplementation[keccak256(abi.encode(moneyMarketId))];

    bytes memory result =
      implementation.functionDelegateCall(
        abi.encodeWithSignature(
          WITHDRAW_SIG,
          address(token),
          interestToken,
          amount,
          moneyMarketArgs[implementation]
        )
      );

    burningAmount = abi.decode(result, (uint256));

    // trigger burning of tokens on the printer contract
    IJarvisBrrrrr(jarvisBrr).redeem(token, burningAmount);
  }
}
