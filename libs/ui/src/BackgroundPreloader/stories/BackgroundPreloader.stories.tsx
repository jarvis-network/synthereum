import React from "react";
import {select} from "@storybook/addon-knobs";

import {BackgroundPreloader} from "../BackgroundPreloader";
import {styled} from "../../Theme";
import {Background} from "../../Background";

export default {
  title: "background/BackgroundPreloader",
  component: BackgroundPreloader
}

// Taken from: https://imgur.com/gallery/w2w7YFp
const bgs = [
  "https://i.imgur.com/krNaVuU.jpeg",
  "https://i.imgur.com/blYDUbk.png",
  "https://i.imgur.com/54tE2NL.jpeg",
];

const Container = styled.div`
  height: 500px;
  width: 500px;
`

export const Preloader = () => {
  const bg = select('Wallpaper', bgs, bgs[0]);

  return (
    <div>
      Select another wallpaper in Knobs - it should switch without flicker.

      <BackgroundPreloader backgrounds={bgs} />
      <Container>
        <Background image={bg} />
      </Container>
    </div>
  )
}
