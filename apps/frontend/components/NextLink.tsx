import Link from 'next/link';
import React from 'react';

export const NextLinkAdapter: React.FC<{ to: string }> = ({ to, ...props }) => (
  <Link {...props} href={to} />
);
