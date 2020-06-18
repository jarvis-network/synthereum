import React from "react";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";

const TokenPicker = ({ assets, token, onChange }) => {
  return (
    <FormControl>
        <Select value={token} onChange={event => onChange(event.target.value)}>
          {assets.map((asset, i) => (
            <MenuItem key={asset.symbol} value={i}>
              {asset.symbol}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
  );
};

export default TokenPicker;
