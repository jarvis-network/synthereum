import React from 'react';

import { Icon } from '../Icon';
import { styled } from '../Theme';

import { LoginButtonsMap } from './types';

const FacebookIcon = styled(Icon)`
  color: #4267b2;
  border-radius: 50%;
`;

const GoogleIcon = styled(Icon)`
  color: #db4437;
`;

const RedditIcon = styled(Icon)`
  color: #ff4301;
`;

const TwitchIcon = styled(Icon)`
  color: #6441a4;
`;

const DiscordIcon = styled(Icon)`
  color: #7289da;
`;

const AppleIcon = styled(Icon)`
  color: #000;
`;

const GitHubIcon = styled(Icon)`
  color: #000;
`;

const LinkedInIcon = styled(Icon)`
  color: #006192;
`;

const TwitterIcon = styled(Icon)`
  color: #1da1f2;
`;

export const ButtonsMap: LoginButtonsMap = {
  facebook: {
    label: 'Facebook',
    icon: <FacebookIcon icon="SiFacebook" />,
  },
  google: {
    label: 'Google',
    icon: <GoogleIcon icon="SiGoogle" />,
  },
  reddit: {
    label: 'Reddit',
    icon: <RedditIcon icon="SiReddit" />,
  },
  twitch: {
    label: 'Twitch',
    icon: <TwitchIcon icon="SiTwitch" />,
  },
  discord: {
    label: 'Discord',
    icon: <DiscordIcon icon="SiDiscord" />,
  },
  apple: {
    label: 'Apple',
    icon: <AppleIcon icon="SiApple" />,
  },
  github: {
    label: 'GitHub',
    icon: <GitHubIcon icon="SiGithub" />,
  },
  linkedin: {
    label: 'LinkedIn',
    icon: <LinkedInIcon icon="SiLinkedin" />,
  },
  twitter: {
    label: 'Twitter',
    icon: <TwitterIcon icon="SiTwitter" />,
  },
};
