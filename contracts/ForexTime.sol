pragma solidity >=0.5.14 <0.7.0;

import "bokkypoobahsdatetimelibrary/contracts/BokkyPooBahsDateTimeContract.sol";

contract ForexTime is BokkyPooBahsDateTimeContract {
    uint256 constant closeDay = 5;
    uint256 constant closeHour = 21;
    uint256 constant openDay = 7;
    uint256 constant openHour = 22;

    modifier forexOpen() {
        uint256 dayOfWeek = getDayOfWeek(now);
        uint256 hour = getHour(now);

        require(
            dayOfWeek < closeDay
            || (dayOfWeek == closeDay && hour <= closeHour)
            || (dayOfWeek == openDay && hour >= openHour),
            "Market closed for the weekend"
        );
        _;
    }
}
