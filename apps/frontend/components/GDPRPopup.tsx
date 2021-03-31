import React from 'react';
import { AcceptBox } from '@jarvis-network/ui';

const text = (
  <>
    This website uses cookies
    <br />
    We use cookies to personalise content and ads, to provide social media
    features and to analyse our traffic. We also share information about your
    use of our site with our social media. You can read more on our policies{' '}
    <a
      href="https://help.jarvis.exchange/en/article/privacy-policy-1j6mkii/#3-5-how-information-is-stored"
      rel="noopener noreferrer"
      target="_blank"
    >
      here
    </a>
    .
  </>
);

export const GDPRPopup = () => {
  return (
    <AcceptBox text={text} buttonText="Allow all cookies" store="jarvis/gdpr" />
  );
};
