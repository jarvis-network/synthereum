import React from 'react';
import { AcceptBox, styled } from '@jarvis-network/ui';

const Link = styled.a`
  text-decoration: none;
  color: #00b0f0;
`;

const text = (
  <>
    We use cookies to personalise content and ads, to provide social media
    features and to analyse our traffic. We also share information about your
    use of our site with our social media. You can read more on our policies{' '}
    <Link
      href="https://help.jarvis.exchange/en/article/privacy-policy-1j6mkii/#3-5-how-information-is-stored"
      rel="noopener noreferrer"
      target="_blank"
    >
      here
    </Link>
    .
  </>
);

export const GDPRPopup = () => {
  return (
    <AcceptBox text={text} buttonText="Allow all cookies" store="jarvis/gdpr" />
  );
};
