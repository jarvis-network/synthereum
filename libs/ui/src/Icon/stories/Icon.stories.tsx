import React from 'react';
import { select, number } from '@storybook/addon-knobs';

import { styled } from '../../Theme';

import { iconList, colorList } from './data';

import { Icon } from '..';

export default {
  title: 'Icon',
  component: Icon,
};

const Container = styled.span<{ size?: number }>`
  font-size: ${props => props.size || 100}px;
  vertical-align: middle;
`;

export const Download = () => (
  <Container>
    <Icon icon="BsDownload" />
  </Container>
);

export const Plus = () => (
  <Container>
    <Icon icon="BsPlus" />
  </Container>
);

export const UploadWithText = () => (
  <>
    <Container>
      <Icon icon="BsUpload" />
    </Container>
    <span>An upload icon.</span>
  </>
);

export const TwitterDefault = () => (
  <Container>
    <Icon icon="SiTwitter" />
  </Container>
);

export const GoogleRed = () => (
  <Container color="red">
    <Icon icon="SiGoogle" style={{ color: 'red' }} />
  </Container>
);

export const FacebookBlue = () => (
  <Container color="blue">
    <Icon icon="SiFacebook" style={{ color: 'blue' }} />
  </Container>
);

export const GithubCyan = () => (
  <Container>
    <Icon icon="SiGithub" style={{ color: 'cyan' }} />
  </Container>
);

export const LinkedinMagenta = () => (
  <Container color="magenta">
    <Icon icon="SiLinkedin" style={{ color: 'magenta' }} />
  </Container>
);

export const Knobs = () => {
  const icon = select('Name', iconList, iconList[0]);
  const fontSize = number('Font size', 100);
  const color = select('Color', colorList, colorList[0]);

  return (
    <Container size={fontSize}>
      <Icon icon={icon} style={{ color }} />
    </Container>
  );
};
