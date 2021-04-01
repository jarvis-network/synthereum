import React from 'react';
import { WithPlaceholder } from '@/components/markets/modal/WithPlaceholder';
import { Link } from '@/components/markets/modal/Link';

const title = 'Lorem ipsum borrow';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);

export const Borrow: React.FC = () => (
  <WithPlaceholder title={title} subtitle={subtitle} skipKey="borrow">
    <div>borrow</div>
  </WithPlaceholder>
);
