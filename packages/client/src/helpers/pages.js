import React from "react";
import SwapHoriz from "@material-ui/icons/SwapHoriz";
import Receipt from "@material-ui/icons/Receipt";
import BarChart from "@material-ui/icons/BarChart";
import HelpOutline from "@material-ui/icons/HelpOutline";
import MonetizationOnOutlinedIcon from '@material-ui/icons/MonetizationOnOutlined';
import CallReceivedIcon from '@material-ui/icons/CallReceived';


const DashboardPages = [{
    title: "Exchange",
    link: "/exchange",
    pageTitle: "Exchange",
    icon: <SwapHoriz />
  },
  {
    title: "Exchange Rates",
    link: "/exchangerates",
    pageTitle: "Exchange Rates",
    icon: <MonetizationOnOutlinedIcon />
  },
  {
    title: "Transactions",
    pageTitle: "Transactions",
    link: "/transactions",
    icon: <Receipt />
  },
  {
    title: "Insights",
    pageTitle: "Insights",
    link: "/insights",
    icon: <BarChart />
  },
  {
    title: "Faucet",
    pageTitle: "Faucet",
    link: "/",
    icon: <CallReceivedIcon />
  }
];

const SupportPages = [{
  title: 'Help',
  pageTitle: "Help",
  link: '/help',
  icon: <HelpOutline />
}];

export { DashboardPages, SupportPages };
