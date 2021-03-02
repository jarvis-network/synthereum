import React from 'react';
import { select } from '@storybook/addon-knobs';

import { emojiList } from '../stories/data';

import { styled } from '../../Theme';

import { Emoji } from '..';

export default {
  title: 'Emoji',
  component: Emoji,
};

const Container = styled.span`
  font-size: 124px;
`;

export const MoneyMouth = () => (
  <Container>
    <Emoji emoji="MoneyMouth" />
  </Container>
);

export const Camera = () => (
  <Container>
    <Emoji emoji="Camera" />
  </Container>
);

export const PoliceCarLight = () => (
  <Container>
    <Emoji emoji="PoliceCarLight" />
  </Container>
);

export const HammerAndWrench = () => (
  <Container>
    <Emoji emoji="HammerAndWrench" />
  </Container>
);

export const MoneyBag = () => (
  <Container>
    <Emoji emoji="MoneyMouth" />
  </Container>
);

export const Seedling = () => (
  <Container>
    <Emoji emoji="Seedling" />
  </Container>
);

export const Die = () => (
  <Container>
    <Emoji emoji="Die" />
  </Container>
);

export const Charts = () => (
  <Container>
    <Emoji emoji="Charts" />
  </Container>
);

export const Robot = () => (
  <Container>
    <Emoji emoji="Robot" />
  </Container>
);

export const House = () => (
  <Container>
    <Emoji emoji="House" />
  </Container>
);

export const Shield = () => (
  <Container>
    <Emoji emoji="Shield" />
  </Container>
);

export const CreditCard = () => (
  <Container>
    <Emoji emoji="CreditCard" />
  </Container>
);

export const GameController = () => (
  <Container>
    <Emoji emoji="GameController" />
  </Container>
);

export const HourglassNotDone = () => (
  <Container>
    <Emoji emoji="HourglassNotDone" />
  </Container>
);

export const ThumbsUp = () => (
  <Container>
    <Emoji emoji="ThumbsUp" />
  </Container>
);

export const RaisingHands = () => (
  <Container>
    <Emoji emoji="RaisingHands" />
  </Container>
);

export const WavingHand = () => (
  <Container>
    <Emoji emoji="WavingHand" />
  </Container>
);

export const Sparkles = () => (
  <Container>
    <Emoji emoji="Sparkles" />
  </Container>
);

export const ATMSign = () => (
  <Container>
    <Emoji emoji="ATMSign" />
  </Container>
);

export const Knobs = () => (
  <Container>
    <Emoji emoji={select('Name', emojiList, 'MoneyMouth')} />
  </Container>
);
