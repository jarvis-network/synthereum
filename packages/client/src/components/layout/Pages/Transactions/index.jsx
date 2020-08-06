import React, { useState } from 'react';
import Grid from '@material-ui/core/Grid';
import FormControl from '@material-ui/core/FormControl';
import InputLabel from '@material-ui/core/InputLabel';
import Select from '@material-ui/core/Select';
import MenuItem from '@material-ui/core/MenuItem';

import TransactionTable from '../../../elements/TransactionTable';

const Transactions = ({ assets }) => {
  const [token, setToken] = useState(0);

  return (
    <Grid container spacing={4}>
      <Grid item md={2}>
        <FormControl>
          <InputLabel id="token-select-label">Token</InputLabel>
          <Select
            labelId="token-select-label"
            id="token-select"
            value={token}
            onChange={ev => setToken(ev.target.value)}
          >
            {assets.map((asset, index) => (
              <MenuItem key={asset.symbol} value={index}>
                {asset.symbol}
              </MenuItem>
            ))}
          </Select>
        </FormControl>
      </Grid>
      <Grid item md={12}>
        <TransactionTable assets={assets} token={token} />
      </Grid>
    </Grid>
  );
};

export default Transactions;
