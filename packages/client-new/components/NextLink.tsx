import Link from 'next/link';
import React from 'react';

export const NextLinkAdapter = ({ to, ...props }) => (
  <Link {...props} href={to} />
);
