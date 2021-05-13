// SPDX-License-Identifier: AGPL-3.0-only
pragma solidity ^0.6.12;

library StringUtils {
  function stringToBytes32(string memory _string)
    internal
    pure
    returns (bytes32 result)
  {
    bytes memory source = bytes(_string);
    if (source.length == 0) {
      return 0x0;
    } else if (source.length > 32) {
      revert('Bytes length bigger than 32');
    } else {
      assembly {
        result := mload(add(source, 32))
      }
    }
  }

  function bytes32ToString(bytes32 _bytes32)
    internal
    pure
    returns (string memory)
  {
    uint8 i = 0;
    while (i < 32 && _bytes32[i] != 0) {
      i++;
    }
    bytes memory bytesArray = new bytes(i);
    for (i = 0; i < 32 && _bytes32[i] != 0; i++) {
      bytesArray[i] = _bytes32[i];
    }
    return string(bytesArray);
  }
}
