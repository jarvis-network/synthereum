import React from "react";
import SwapHoriz from "@material-ui/icons/SwapHoriz";
import AccountBalance from "@material-ui/icons/AccountBalance";
import Receipt from "@material-ui/icons/Receipt";
import BarChart from "@material-ui/icons/BarChart";
import Settings from "@material-ui/icons/Settings";
import HelpOutline from "@material-ui/icons/HelpOutline";
import Description from "@material-ui/icons/Description";

const DashboardPages = [
  {
    title: "Order",
    link: "/",
    icon: <AccountBalance />
  },
  {
    title: "Exchange",
    link: "/exchange",
    pageTitle: "Exchange Rates",
    icon: <SwapHoriz />
  },
  {
    title: "Transactions",
    link: "/transactions",
    icon: <Receipt />
  },
  {
    title: "Insights",
    link: "/insights",
    icon: <BarChart />
  }
];

const SupportPages = [{
  title: 'Settings',
  link: '/settings',
  icon: <Settings />
},{
  title: 'Help',
  link: '/help',
  icon: <HelpOutline />
},{
  title: 'Docs',
  link: '/docs',
  icon: <Description />
}];

export { DashboardPages, SupportPages };
