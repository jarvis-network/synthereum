// SPDX-License-Identifier: MIT
pragma solidity >=0.6.0 <0.8.0;

library EnumerableBytesSet {
  struct BytesSet {
    bytes32[] _values;
    mapping(bytes32 => uint256) _indexes;
  }

  function add(BytesSet storage set, bytes32 value) internal returns (bool) {
    if (!contains(set, value)) {
      set._values.push(value);

      set._indexes[value] = set._values.length;
      return true;
    } else {
      return false;
    }
  }

  function contains(BytesSet storage set, bytes32 value)
    internal
    view
    returns (bool)
  {
    return set._indexes[value] != 0;
  }

  function length(BytesSet storage set) internal view returns (uint256) {
    return set._values.length;
  }

  function at(BytesSet storage set, uint256 index)
    internal
    view
    returns (bytes32)
  {
    require(set._values.length > index, 'EnumerableSet: index out of bounds');
    return set._values[index];
  }
}
