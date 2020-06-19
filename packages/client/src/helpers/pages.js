import React from "react";
import SwapHoriz from "@material-ui/icons/SwapHoriz";
import AccountBalance from "@material-ui/icons/AccountBalance";
import Receipt from "@material-ui/icons/Receipt";
import BarChart from "@material-ui/icons/BarChart";

const DashboardPages = [
  {
    title: "Order",
    link: "/",
    icon: <AccountBalance />
  },
  {
    title: "Exchange",
    link: "/exchange",
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

export { DashboardPages };
