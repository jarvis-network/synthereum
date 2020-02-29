import React, { useEffect, useState } from "react";
import { useWeb3Context } from "web3-react";

import Backdrop from "@material-ui/core/Backdrop";
import CircularProgress from "@material-ui/core/CircularProgress";

export default function App() {
  const context = useWeb3Context();

  const [loading, setLoading] = useState(true);

  useEffect(() => {
    context.setFirstValidConnector(['MetaMask', 'Infura']);
  }, [context]);

  useEffect(() => {
    if (context.active) {
      setLoading(false);
    }
  });

  if (!context.active && !context.error) {
    return (
      <Backdrop open={loading}>
        <CircularProgress color="inherit" />
      </Backdrop>
    );
  } else if (context.error) {
    return <div>Error</div>
  } else {
    return <></>;
  }
}
