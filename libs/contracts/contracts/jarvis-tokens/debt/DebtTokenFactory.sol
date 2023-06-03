// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {EnumerableSet} from '@openzeppelin/contracts/utils/structs/EnumerableSet.sol';
import {StringUtils} from '../../base/utils/StringUtils.sol';
import {DebtToken} from './DebtToken.sol';
import {ReentrancyGuard} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {StandardAccessControlEnumerable} from '../../common/roles/StandardAccessControlEnumerable.sol';

contract DebtTokenFactory is ReentrancyGuard, StandardAccessControlEnumerable {
  using EnumerableSet for EnumerableSet.Bytes32Set;
  using StringUtils for string;
  using StringUtils for bytes32;

  mapping(string => address) private debtTokens;

  EnumerableSet.Bytes32Set private syntheticTokens;

  event DebtTokenCreated(address indexed jAsset, address indexed debtToken);

  constructor(Roles memory _roles) {
    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  /**
   * @notice Create a debt-token associated to synthetic asset
   * @param _jFiat Synthetic asset
   * @param _capAmount Max balance of donated and bonded synthetic asset
   * @param _tokenName Name of the debt-token
   * @param _tokenSymbol Symbol of the debt-token
   * @param _roles Admin and maintainer roles
   * @return debtTokenContract Address of the debt-token deployed
   */
  function createDebtToken(
    IStandardERC20 _jFiat,
    uint256 _capAmount,
    string memory _tokenName,
    string memory _tokenSymbol,
    Roles memory _roles
  ) external onlyMaintainer nonReentrant returns (DebtToken debtTokenContract) {
    string memory symbol = _jFiat.symbol();
    require(
      syntheticTokens.add(symbol.stringToBytes32()),
      'Debt token already created'
    );
    debtTokenContract = new DebtToken(
      _jFiat,
      _capAmount,
      _tokenName,
      _tokenSymbol,
      _roles
    );
    address debtTokenAddr = address(debtTokenContract);

    debtTokens[symbol] = debtTokenAddr;

    emit DebtTokenCreated(address(_jFiat), debtTokenAddr);
  }

  /**
   * @notice Returns the address of the debt-token associated to a synthetic asset
   * @param _tokenSymbol Synthetic asset symbol
   * @return Address of the debt-token
   */
  function debtToken(string calldata _tokenSymbol)
    external
    view
    returns (address)
  {
    address debtTokenAddr = debtTokens[_tokenSymbol];
    require(debtTokenAddr != address(0), 'Debt token not supported');
    return debtTokenAddr;
  }

  /**
   * @notice Returns all the synthetic token symbol used
   * @return List of all synthetic token symbol
   */
  function getSyntheticTokens() external view returns (string[] memory) {
    uint256 numberOfSynthTokens = syntheticTokens.length();
    string[] memory synthTokens = new string[](numberOfSynthTokens);
    for (uint256 j = 0; j < numberOfSynthTokens; j++) {
      synthTokens[j] = syntheticTokens.at(j).bytes32ToString();
    }
    return synthTokens;
  }
}
