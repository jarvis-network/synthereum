import React from "react";
import { AcceptBox } from "../AcceptBox";
import { text as knobText } from "@storybook/addon-knobs";

export default {
  title: 'AcceptBox',
  component: AcceptBox,
};

export const AcceptBoxKnobs = () => {
  const text = knobText('Box text', 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla non erat vitae urna ornare consequat. Pellentesque sed blandit libero. Ut ut leo lobortis, placerat nisl at, dapibus leo. Curabitur ligula nisi, volutpat gravida sem.');
  const buttonText = knobText("Button text", "accept");
  const store = knobText("Local storage key", "jarvis/gdpr");

  return <AcceptBox text={text} buttonText={buttonText} store={store} />
}
