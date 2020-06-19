import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import { jarvisExchangeRate } from "../../../jarvisAPI.js";

import TICFactory from "../../../contracts/TICFactory.json";
import TIC from "../../../contracts/TIC.json";
import ExpiringMultiParty from "../../../contracts/ExpiringMultiParty.json";
import MCD_DAI from "../../../MCD_DAI.json";
import IERC20 from "../../../contracts/IERC20.json";

import defaultAssets from "../../../helpers/defaultAssets";
import {
    NavLink,
    Switch,
    Route,
    useLocation
  } from "react-router-dom";


import ExchangeRates from "../../elements/ExchangeRates";
import WalletBalance from "../../elements/WalletBalance";
import OrderForm from "../../elements/OrderForm";

import clsx from "clsx";
import { useTheme } from "@material-ui/core/styles";
import Drawer from "@material-ui/core/Drawer";
import AppBar from "@material-ui/core/AppBar";
import Toolbar from "@material-ui/core/Toolbar";
import List from "@material-ui/core/List";
// import CssBaseline from "@material-ui/core/CssBaseline";
import Typography from "@material-ui/core/Typography";
import Divider from "@material-ui/core/Divider";
import IconButton from "@material-ui/core/IconButton";
import MenuIcon from "@material-ui/icons/Menu";
import ChevronLeftIcon from "@material-ui/icons/ChevronLeft";
import ChevronRightIcon from "@material-ui/icons/ChevronRight";
import ListItem from "@material-ui/core/ListItem";
import ListItemIcon from "@material-ui/core/ListItemIcon";
import ListItemText from "@material-ui/core/ListItemText";
import InboxIcon from "@material-ui/icons/MoveToInbox";
import MailIcon from "@material-ui/icons/Mail";

import SwapHoriz from "@material-ui/icons/SwapHoriz";
import AccountBalance from "@material-ui/icons/AccountBalance";
import Receipt from "@material-ui/icons/Receipt";
import BarChart from "@material-ui/icons/BarChart";

import useStyles from "./styles";

const DashboardPages = [{
  title: 'Order',
  link: '/',
  icon: <AccountBalance />
},{
  title: 'Exchange',
  link: '/exchange',
  icon: <SwapHoriz />
},{
  title: 'Transactions',
  link: '/transactions',
  icon: <Receipt />
},{
title: 'Insights',
link: '/insights',
icon: <BarChart />
}];

export default function Wallet({ setLoading }) {

    const location = useLocation();
    let currentPage = location.pathname;
  

  const classes = useStyles();
  const theme = useTheme();
  const [open, setOpen] = React.useState(false);

  const handleDrawerOpen = () => {
    setOpen(true);
  };

  const handleDrawerClose = () => {
    setOpen(false);
  };

/** WALLET STUFF */

const context = useWeb3Context();

  // const [token, setToken] = useState(0);
  const [assets, setAssets] = useState(defaultAssets);
  const [syntheticTokens, setSyntheticTokens] = useState([]);
  const [dai, setDai] = useState(null);
  // Used to refresh stale data after a transaction is made
  const [lastTx, setLastTx] = useState("");

  useEffect(() => {
    if (context.active) {
      const { library: { eth: { Contract } } } = context;

      const factory = new Contract(
        TICFactory.abi,
        TICFactory.networks[context.networkId].address
      );

      let newAssets = [...assets];
      Promise.all(newAssets.map(asset => {
        return factory.methods.symbolToTIC(asset.symbol).call();
      })).then(addresses => {
        for (let i in newAssets) {
          newAssets[i].contract = new Contract(TIC.abi, addresses[i]);
        }

        return Promise.all(newAssets.map(asset => {
          return asset.contract.methods.derivative().call();
        }));
      }).then(derivatives => {
        for (let i in newAssets) {
          newAssets[i].derivative = new Contract(ExpiringMultiParty.abi, derivatives[i]);
        }

        setAssets(newAssets)

        return Promise.all(newAssets.map(asset => {
          return asset.derivative.methods.tokenCurrency().call();
        }));
      }).then(syntheticTokens => {
        let newSyntheticTokens = [];

        for (let i in newAssets) {
          newSyntheticTokens[i] = new Contract(IERC20.abi, syntheticTokens[i]);
        }

        setSyntheticTokens(newSyntheticTokens);
      });


      Promise.all(newAssets.map(asset => {
        return jarvisExchangeRate(asset.priceFeed);
      })).then(exchangeRates => {
        for (let i in newAssets) {
          newAssets[i].price = exchangeRates[i] ? exchangeRates[i] : 0;
        }

        setAssets(newAssets)
      });

      setDai(new Contract(IERC20.abi, MCD_DAI.networks[context.networkId].address));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [context, context.active]);

/** WALLET STUFF ENDS */

  return (
    <div className={classes.root}>
      <WalletBalance
          className={classes.table}
          assets={assets}
          syntheticTokens={syntheticTokens}
          token={0} // FIX THIS
          dai={dai}
          lastTx={lastTx}
        />
      <div className={classes.menuContainer}>
        <AppBar
          position="absolute"
          className={clsx(classes.appBar, {
            [classes.appBarShift]: open
          })}
        >
          <Toolbar>
            <IconButton
              color="inherit"
              aria-label="open drawer"
              onClick={handleDrawerOpen}
              edge="start"
              className={clsx(classes.menuButton, {
                [classes.hide]: open
              })}
            >
              <MenuIcon />
            </IconButton>
            <Typography variant="h6" noWrap>
              {(DashboardPages.find(page => page.link === currentPage) || {}).title || '404'}
            </Typography>
          </Toolbar>
        </AppBar>
        <Drawer
          variant="permanent"
          className={clsx(classes.drawer, {
            [classes.drawerOpen]: open,
            [classes.drawerClose]: !open
          })}
          classes={{
            paper: clsx({
              [classes.drawerOpen]: open,
              [classes.drawerClose]: !open
            })
          }}
        >
          <div className={classes.toolbar}>
            <IconButton onClick={handleDrawerClose}>
              {theme.direction === "rtl" ? (
                <ChevronRightIcon />
              ) : (
                <ChevronLeftIcon />
              )}
            </IconButton>
          </div>
          <Divider />
          <List>
            {DashboardPages.map((page, index) => (
                <NavLink to={page.link} className={classes.NavLink}>
              <ListItem button key={page}>
                <ListItemIcon>
                  {page.icon}
                </ListItemIcon>
                <ListItemText primary={page.title} />
              </ListItem>
              </NavLink>
            ))}
          </List>
          <Divider />
          <List>
            {["Settings","Help","Docs"].map((text, index) => (
              <ListItem button key={text}>
                <ListItemIcon>
                  {index % 2 === 0 ? <InboxIcon /> : <MailIcon />}
                </ListItemIcon>
                <ListItemText primary={text} />
              </ListItem>
            ))}
          </List>
        </Drawer>
        <main className={classes.content}>
            <div className={classes.toolbar} />
            <Switch>
          <Route path="/exchange">
          <ExchangeRates className={classes.table} assets={assets} />
          </Route>
          <Route path="/transactions">
            <h3>Transactions</h3>
          </Route>
          <Route path="/insights">
            <h3>Insights</h3>
          </Route>
          <Route path="/">
            <OrderForm
              className={classes.table}
              assets={assets}
              // token={token}
              dai={dai}
              syntheticTokens={syntheticTokens}
              setLoading={setLoading}
              setLastTx={setLastTx}
            />
          </Route>
          
        </Switch>
        </main>
      </div>
    </div>
  );
}
