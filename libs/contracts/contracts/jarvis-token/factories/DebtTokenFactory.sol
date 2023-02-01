// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity 0.8.9;

import {IStandardERC20} from '../../base/interfaces/IStandardERC20.sol';
import {DebtToken} from '../DebtToken.sol';
import {
  ReentrancyGuard
} from '@openzeppelin/contracts/security/ReentrancyGuard.sol';
import {
  StandardAccessControlEnumerable
} from '../../common/roles/StandardAccessControlEnumerable.sol';

contract DebtTokenFactory is ReentrancyGuard, StandardAccessControlEnumerable {
  mapping(string => address) private debtTokens;

  event DebtTokenCreated(address indexed jAsset, address indexed debtToken);

  constructor(Roles memory _roles) {
    _setAdmin(_roles.admin);
    _setMaintainer(_roles.maintainer);
  }

  /**
   * @notice Create a debt-token associated to synthetic asset
   * @param _jFiat Synthetic asset
   * @param _tokenName Name of the debt-token
   * @param _tokenSymbol Symbol of the debt-token
   * @param _roles Admin and maintainer roles
   * @return debtToken Address of the debt-token deployed
   */
  function createDebtToken(
    IStandardERC20 _jFiat,
    string memory _tokenName,
    string memory _tokenSymbol,
    Roles memory _roles
  ) external onlyMaintainer nonReentrant returns (address debtToken) {
    string memory symbol = _jFiat.symbol();
    require(debtTokens[symbol] == address(0), 'Debt token already created');

    debtToken = address(
      new DebtToken(_jFiat, _tokenName, _tokenSymbol, _roles)
    );

    debtTokens[symbol] = debtToken;

    emit DebtTokenCreated(address(_jFiat), debtToken);
  }

  function debtToken(string calldata _tokenSymbol)
    external
    view
    returns (address)
  {
    return debtTokens[_tokenSymbol];
  }
}
