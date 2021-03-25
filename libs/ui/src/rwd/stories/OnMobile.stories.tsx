import React from "react";

import {OnMobile} from "../OnMobile";

export default {
  title: "common/OnMobile",
  component: OnMobile
}

export const Basic = () => (
  <div>
    On mobile device (resolution) you will see a cat emoji here:

    <OnMobile>
      🐈
    </OnMobile>
  </div>
)
