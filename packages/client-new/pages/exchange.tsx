import React from "react";
import Link from "next/link";
import { useSelector } from 'react-redux'

import {State} from "state/initialState";

const exchange = () => {
  const theme = useSelector((state: State) => state.theme)

  return (
    <div>
      Exchange. Charts. Buttons. Money. Theme: {theme}.

      <br />
      <Link href={"/"}>Home</Link>
    </div>
  );
};


export default exchange;
