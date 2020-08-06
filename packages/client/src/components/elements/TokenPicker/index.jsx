import React from 'react';
import FormControl from '@material-ui/core/FormControl';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';
import InputAdornment from '@material-ui/core/InputAdornment';
import * as icons from '../../../assets/icons';

import useStyles from './styles';

const TokenPicker = ({ assets, token, onChange }) => {
  const classes = useStyles();
  return (
    <InputAdornment position="end">
      <FormControl>
        <Select
          className={classes.MuiSelect}
          disableUnderline={true}
          value={token}
          onChange={event => onChange(event.target.value)}
        >
          <MenuItem value="select" className={classes.TokenCell}>
            Select Token
          </MenuItem>
          {assets.map((asset, i) => (
            <MenuItem
              key={asset.symbol}
              value={i}
              className={classes.TokenCell}
            >
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
    </InputAdornment>
  );
};

export default TokenPicker;
