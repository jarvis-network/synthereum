import React from 'react';
import { AcceptBox } from '@jarvis-network/ui';

const text = (
  <>
    This website uses cookies
    <br />
    We use cookies to personalise content and ads, to provide social media
    features and to analyse our traffic. We also share information about your
    use of our site with our social media,
  </>
);

export const GDPRPopup = () => {
  return (
    <AcceptBox text={text} buttonText="Allow all cookies" store="jarvis/gdpr" />
  );
};
