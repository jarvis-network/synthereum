// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.8.4;
import {
  IMintableBurnableERC20
} from '@jarvis-network/synthereum-contracts/contracts/tokens/interfaces/IMintableBurnableERC20.sol';

interface IMoneyMarketManager {
  /**
   * @notice Mints synthetic token without collateral to a pre-defined address (SynthereumMoneyMarketManager)
   * @param token Synthetic token address to mint
   * @param amount Amount of tokens to mint
   */
  function mint(IMintableBurnableERC20 token, uint256 amount) external;

  /**
   * @notice Burns synthetic token without releasing collateral from the pre-defined address (SynthereumMoneyMarketManager)
   * @param token Synthetic token address to burn
   * @param amount Amount of tokens to burn
   */
  function redeem(IMintableBurnableERC20 token, uint256 amount) external;

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
   * @return maxSupply Max supply of the token
   */
  function maxSupply(IMintableBurnableERC20 token)
    external
    view
    returns (uint256 maxSupply);

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
