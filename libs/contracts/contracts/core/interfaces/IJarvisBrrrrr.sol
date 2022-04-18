// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >=0.8.0;
import {
  IMintableBurnableERC20
} from '../../tokens/interfaces/IMintableBurnableERC20.sol';

interface IJarvisBrrrrr {
  /**
   * @notice Registers an address implementing the IJarvisBrrMoneyMarket interface
   * @param id Identifier of the implementation
   * @param implementation Address of the implementation
   * @param extraArgs bytes Encoded args for the implementation
   */
  function registerMoneyMarketImplementation(
    string memory id,
    address implementation,
    bytes memory extraArgs
  ) external;

  /**
   * @notice Mints synthetic token without collateral to a pre-defined address (SynthereumMoneyMarketManager)
   * @param token Synthetic token address to mint
   * @param amount Amount of tokens to mint
   * @param moneyMarketId identifier of the money market implementation that deposits the tokens into money market
   * @return newCirculatingSupply New circulating supply in Money Market
   */
  function mint(
    IMintableBurnableERC20 token,
    uint256 amount,
    string memory moneyMarketId
  ) external returns (uint256 newCirculatingSupply);

  /**
   * @notice Burns synthetic token without releasing collateral from the pre-defined address (SynthereumMoneyMarketManager)
   * @param token Synthetic token address to burn
   * @param interestToken interest token address to withdraw from money market
   * @param amount Amount of tokens to burn
   * @param moneyMarketId identifier of the money market implementation contract to withdraw the tokens from money market
   * @return newCirculatingSupply New circulating supply in Money Market
   */
  function redeem(
    IMintableBurnableERC20 token,
    address interestToken,
    uint256 amount,
    string memory moneyMarketId
  ) external returns (uint256 newCirculatingSupply);

  /**
   * @notice Sets the max circulating supply that can be minted for a specific token - only manager can set this
   * @param token Synthetic token address to set
   * @param newMaxSupply New Max supply value of the token
   */
  function setMaxSupply(IMintableBurnableERC20 token, uint256 newMaxSupply)
    external;

  /**
   * @notice Returns the max circulating supply of a synthetic token
   * @param token Synthetic token address
   * @return maxCircSupply Max supply of the token
   */
  function maxSupply(IMintableBurnableERC20 token)
    external
    view
    returns (uint256 maxCircSupply);

  /**
   * @notice Returns the circulating supply of a synthetic token
   * @param token Synthetic token address
   * @return circSupply Circulating supply of the token
   */
  function supply(IMintableBurnableERC20 token)
    external
    view
    returns (uint256 circSupply);
}
