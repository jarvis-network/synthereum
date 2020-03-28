pragma solidity >=0.5.14 <0.7.0;

import {Ownable} from "@openzeppelin/contracts/ownership/Ownable.sol";
import {PriceFeedInterface} from "protocol/core/contracts/tokenized-derivative/PriceFeedInterface.sol";
import {AggregatorInterface} from "chainlink/v0.5/contracts/dev/AggregatorInterface.sol";

contract ChainlinkPriceFeed is PriceFeedInterface, Ownable {
    uint8 private constant AGGREGATOR_DECIMALS = 8;
    uint8 private constant DECIMALS = 18;
    // Used to scale aggregator answers up to DECIMAL places
    int256 private constant AGGREGATOR_SCALING_FACTOR = int256(
        10 ** uint256(DECIMALS - AGGREGATOR_DECIMALS)
    );

    // Mapping from identifier to the corresponding Chainlink aggregator.
    mapping(bytes32 => AggregatorInterface) private aggregators;

    /**
     * @notice Add a new or replace an existing Chainlink aggregator for an identifier
     * @param identifier The identifier for the aggregator
     * @param aggregator The Chainlink aggregator
     */
    function addAggregator(bytes32 identifier, AggregatorInterface aggregator) public onlyOwner {
        aggregators[identifier] = aggregator;
    }

    /**
     * @notice Whether this feed has ever published any prices for this identifier.
     * @param identifier The identifier to check for prices
     */
    function isIdentifierSupported(bytes32 identifier)
        external
        view
        returns (bool isSupported)
    {
        isSupported = _isIdentifierSupported(identifier);
    }

    /**
     * @notice Get the latest price for an identifier
     * @param identifier the identifier to get the price for
     * @return The latest price for the identifier
     */
    function latestPrice(bytes32 identifier)
        external
        view
        returns (uint256 publishTime, int256 price)
    {
        require(
            _isIdentifierSupported(identifier),
            "Identifier is not supported"
        );

        price = aggregators[identifier].latestAnswer() * AGGREGATOR_SCALING_FACTOR;
        publishTime = aggregators[identifier].latestTimestamp();
    }

    /**
     * @notice Allows owner to withdraw an amount of ether
     * @param amount The amount to withdraw
     */
    function withdraw(uint256 amount) external onlyOwner {
        require(amount <= address(this).balance);
        msg.sender.transfer(amount);
    }

    function _isIdentifierSupported(bytes32 identifier)
        private
        view
        returns (bool isSupported)
    {
        isSupported = address(aggregators[identifier]) != address(0)
            && aggregators[identifier].latestTimestamp() > 0;
    }
}
