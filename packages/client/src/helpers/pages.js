import React from "react";
import SwapHoriz from "@material-ui/icons/SwapHoriz";
import Receipt from "@material-ui/icons/Receipt";
import BarChart from "@material-ui/icons/BarChart";
import HelpOutline from "@material-ui/icons/HelpOutline";

const DashboardPages = [{
    title: "Exchange",
    link: "/",
    pageTitle: "Order",
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
  title: 'Help',
  link: '/help',
  icon: <HelpOutline />
}];

export { DashboardPages, SupportPages };
