// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity >0.8.0;
import {IMintableBurnableERC20} from '../../tokens/interfaces/IMintableBurnableERC20.sol';

interface IJarvisBrrrrr {
  struct AccessContract {
    string contractName;
    address contractAddress;
  }

  /**
   * @notice Add a contract to the withelist containing names of the contracts that have access to this contract
   * @notice Only maintainer can call this function
   * @param _contractName Name of the contract to add
   */
  function addAccessContract(string calldata _contractName) external;

  /**
   * @notice Remove a contract from the withelist containing names of the contracts that have access to this contract
   * @notice Only maintainer can call this function
   * @param _contractName Name of the contract to remove
   */
  function removeAccessContract(string calldata _contractName) external;

  /**
   * @notice Sets the max circulating supply that can be minted for a specific token - only manager can set this
   * @notice Only maintainer can call this function
   * @param _token Synthetic token address to set
   * @param _newMaxSupply New Max supply value of the token
   */
  function setMaxSupply(IMintableBurnableERC20 _token, uint256 _newMaxSupply)
    external;

  /**
   * @notice Mints synthetic token without collateral to a pre-defined address (SynthereumMoneyMarketManager)
   * @param _token Synthetic token address to mint
   * @param _amount Amount of tokens to mint
   * @return newCirculatingSupply New circulating supply in Money Market
   */
  function mint(IMintableBurnableERC20 _token, uint256 _amount)
    external
    returns (uint256 newCirculatingSupply);

  /**
   * @notice Burns synthetic token without releasing collateral from the pre-defined address (SynthereumMoneyMarketManager)
   * @param _token Synthetic token address to burn
   * @param _amount Amount of tokens to burn
   * @return newCirculatingSupply New circulating supply in Money Market
   */
  function redeem(IMintableBurnableERC20 _token, uint256 _amount)
    external
    returns (uint256 newCirculatingSupply);

  /**
   * @notice Returns the max circulating supply of a synthetic token
   * @param _token Synthetic token address
   * @return maxCircSupply Max supply of the token
   */
  function maxSupply(IMintableBurnableERC20 _token)
    external
    view
    returns (uint256 maxCircSupply);

  /**
   * @notice Returns the circulating supply of a synthetic token
   * @param _token Synthetic token address
   * @return circSupply Circulating supply of the token
   */
  function supply(IMintableBurnableERC20 _token)
    external
    view
    returns (uint256 circSupply);

  /**
   * @notice Returns the list of contracts that has access to this contract
   * @return List of contracts (name and address from the finder)
   */
  function accessContractWhitelist()
    external
    view
    returns (AccessContract[] memory);

  /**
   * @notice Returns if a contract name has access to this contract
   * @return hasAccess True if has access otherwise false
   */
  function hasContractAccess(string calldata _contractName)
    external
    view
    returns (bool hasAccess);
}
