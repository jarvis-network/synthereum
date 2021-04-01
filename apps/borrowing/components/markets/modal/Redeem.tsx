import React from 'react';
import { Link } from '@/components/markets/modal/Link';
import { WithPlaceholder } from '@/components/markets/modal/WithPlaceholder';

const title = 'Lorem ipsum redeem';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);

export const Redeem: React.FC = () => (
  <WithPlaceholder title={title} subtitle={subtitle} skipKey="redeem">
    <div>redeem</div>
  </WithPlaceholder>
);
