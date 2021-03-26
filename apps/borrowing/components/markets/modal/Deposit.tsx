import React from 'react';
import { Link } from '@/components/markets/modal/Link';
import { WithPlaceholder } from '@/components/markets/modal/WithPlaceholder';

const title = 'Lorem ipsum deposit';
const subtitle = (
  <>
    You can find more information about our synthetic tokens{' '}
    <Link href="/">here</Link>
  </>
);

export const Deposit: React.FC = () => {
  return (
    <WithPlaceholder title={title} subtitle={subtitle} skipKey="deposit">
      <div>Deposit</div>
    </WithPlaceholder>
  );
};
