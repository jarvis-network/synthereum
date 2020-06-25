import React from "react";
import FormControl from "@material-ui/core/FormControl";
import Select from "@material-ui/core/Select";
import MenuItem from "@material-ui/core/MenuItem";

import * as icons from "../../../assets/icons";

import useStyles from "./styles";


const TokenPicker = ({ assets, token, onChange }) => {

  const classes = useStyles();

  return (
    <FormControl>
        <Select className={classes.MuiSelect} disableUnderline={true} value={token} onChange={event => onChange(event.target.value)}>
          {assets.map((asset, i) => (
            <MenuItem key={asset.symbol} value={i} className={classes.TokenCell}>
            <img
                alt={asset.symbol}
                className={classes.TokenIcon}
                src={icons[asset.symbol]}
              />
              {asset.symbol}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
  );
};

export default TokenPicker;
