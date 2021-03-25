import React from "react";

import {OnDesktop} from "../OnDesktop";

export default {
  title: "common/OnDesktop",
  component: OnDesktop
}

export const Basic = () => (
  <div>
    On desktop device (resolution) you will see a dog emoji here:

    <OnDesktop>
      🐕
    </OnDesktop>
  </div>
)
