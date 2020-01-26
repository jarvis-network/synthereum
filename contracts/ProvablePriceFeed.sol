pragma solidity >=0.5.14 <0.7.0;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "protocol/core/contracts/PriceFeedInterface.sol";
import "protocol/core/contracts/Withdrawable.sol";
import "protocol/core/contracts/Testable.sol";
import "provable-eth-api/provableAPI_0.5.sol";
import "./ForexTime.sol";

contract ProvablePriceFeed is
    PriceFeedInterface,
    Withdrawable,
    Testable,
    usingProvable,
    ForexTime
{
    using SafeMath for uint256;

    uint8 constant DECIMALS = 18;

    // A single price update.
    struct PriceTick {
        uint256 timestamp;
        string price;
    }

    // Mapping a Provable query to the identifier it is for.
    mapping(bytes32 => bytes32) private queryIdentifiers;

    // Mapping from identifier to the latest price for that identifier.
    mapping(bytes32 => PriceTick) private prices;

    // Ethereum timestamp tolerance.
    // Note: this is technically the amount of time that a block timestamp can be *ahead* of the current time. However,
    // we are assuming that blocks will never get more than this amount *behind* the current time. The only requirement
    // limiting how early the timestamp can be is that it must have a later timestamp than its parent. However,
    // this bound will probably work reasonably well in both directions.
    uint256 constant private BLOCK_TIMESTAMP_TOLERANCE = 900;

    enum Roles {
        Governance,
        Writer,
        Withdraw
    }

    event PriceUpdated(bytes32 indexed identifier, uint256 indexed time, string price);
    event ProvableQueryLog(string message);
    event ProvableUpdate(string result);

    constructor(bool _isTest) public Testable(_isTest) {
        _createExclusiveRole(
            uint256(Roles.Governance),
            uint256(Roles.Governance),
            msg.sender
        );
        _createExclusiveRole(
            uint256(Roles.Writer),
            uint256(Roles.Governance),
            msg.sender
        );
        createWithdrawRole(
            uint256(Roles.Withdraw),
            uint256(Roles.Governance),
            msg.sender
        );
    }

    /**
     * @notice Whether this feed has ever published any prices for this identifier.
     */
    function isIdentifierSupported(bytes32 identifier)
        external
        view
        returns (bool isSupported)
    {
        isSupported = _isIdentifierSupported(identifier);
    }

    function latestPrice(bytes32 identifier)
        external
        view
        returns (uint256 publishTime, int256 price)
    {
        require(
            _isIdentifierSupported(identifier),
            "Identifier is not supported"
        );
        publishTime = prices[identifier].timestamp;
        price = int256(safeParseInt(prices[identifier].price, DECIMALS));
    }

    // TODO: Implement recursive Provable queries to create update loop
    function __callback(bytes32 _myid, string memory _result) public {
        if (msg.sender != provable_cbAddress()) revert();
        pushLatestPrice(queryIdentifiers[_myid], now, _result);
        delete queryIdentifiers[_myid];
        emit ProvableUpdate(_result);
    }

    function updatePrice(bytes32 identifier)
        public
        payable
        onlyRoleHolder(uint256(Roles.Writer))
        forexOpen
    {
        if (provable_getPrice("URL") <= address(this).balance) {
            string memory endpoint = "https://data.jarvis.exchange/jarvis/prices/history";
            string memory url = string(abi.encodePacked(
                "json(",
                endpoint,
                "?symbol=EURUSD&resolution=1&from=",
                uint2str(now - 60),
                "&to=",
                uint2str(now),
                ").c"
            ));
            emit ProvableQueryLog("Provable query was sent, update pending");
            bytes32 queryId = provable_query("URL", url);
            queryIdentifiers[queryId] = identifier;
        } else {
            emit ProvableQueryLog("Provable query not sent, insufficient funds");
        }
    }

    /**
     * @notice Adds a new price to the series for a given identifier.
     * @dev The pushed publishTime must be later than the last time pushed so far.
     */
    function pushLatestPrice(
        bytes32 identifier,
        uint256 publishTime,
        string memory newPrice
    ) private {
        require(
            publishTime <= getCurrentTime().add(BLOCK_TIMESTAMP_TOLERANCE),
            "Publish time is not within the block timestamp tolerance"
        );
        require(
            publishTime > prices[identifier].timestamp,
            "A more recent price has already been published"
        );
        prices[identifier] = PriceTick(publishTime, newPrice);
        emit PriceUpdated(identifier, publishTime, newPrice);
    }

    function _isIdentifierSupported(bytes32 identifier)
        private
        view
        returns (bool isSupported)
    {
        isSupported = prices[identifier].timestamp > 0;
    }
}
