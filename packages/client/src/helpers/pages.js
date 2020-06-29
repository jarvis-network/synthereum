import React from "react";
import SwapHoriz from "@material-ui/icons/SwapHoriz";
import Receipt from "@material-ui/icons/Receipt";
import BarChart from "@material-ui/icons/BarChart";
import HelpOutline from "@material-ui/icons/HelpOutline";

const DashboardPages = [{
    title: "Exchange",
    link: "/",
    pageTitle: "Exchange",
    icon: <SwapHoriz />
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
  }
];

const SupportPages = [{
  title: 'Help',
  pageTitle: "Help",
  link: '/help',
  icon: <HelpOutline />
}];

export { DashboardPages, SupportPages };
