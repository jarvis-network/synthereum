import React, { useState } from 'react';

import { ModalProps } from '../types';

import { Button } from '../../Button';

import { ModalContent } from '..';

export default {
  title: 'Modal/ModalContent',
  component: ModalContent,
};

type StatefulModalProps = Omit<ModalProps, 'onClose' | 'isOpened'> & {
  className?: string;
};

const StatefulModalContent: React.FC<StatefulModalProps> = ({ children }) => {
  const [isOpened, setOpened] = useState(false);
  const toggleOpened = () => setOpened(!isOpened);

  return (
    <>
      <Button onClick={toggleOpened}>Open modal</Button>
      <ModalContent isOpened={isOpened} onClose={toggleOpened} title="Example">
        {children}
      </ModalContent>
    </>
  );
};

export const Default = () => (
  <StatefulModalContent>
    <h3>Modal content example</h3>
    <p>
      Strip steak aliquip voluptate, pork rump chicken sausage landjaeger eu
      capicola lorem pork chop minim. Pork loin dolore laboris ea consectetur,
      excepteur anim shank occaecat frankfurter non. Capicola drumstick ullamco
      t-bone ad. Nulla pork belly kielbasa capicola swine meatball. Porchetta
      pastrami bacon jerky, anim ribeye aliquip. Non short ribs prosciutto magna
      meatloaf consequat, tri-tip venison sed frankfurter.
    </p>
    <p>
      Est doner t-bone meatloaf ut, laboris filet mignon. Kevin bacon ground
      round jerky, sint incididunt ex reprehenderit laboris proident excepteur.
      Porchetta excepteur pork chop exercitation. Veniam boudin sint ball tip.
      Tail ut cupidatat ex shank dolore. Exercitation strip steak andouille in
      dolore tri-tip sunt, enim ipsum porchetta doner.
    </p>
    <p>
      Flank bresaola shoulder laboris, proident in alcatra spare ribs ball tip
      ad corned beef chuck elit. Lorem shoulder dolore capicola kielbasa spare
      ribs. Ea voluptate landjaeger, sausage ut ad tongue alcatra commodo sunt.
      Boudin jerky kevin proident flank ribeye pancetta est. Dolore pastrami
      pancetta, proident irure tempor meatloaf sausage culpa doner cillum pork
      loin ut. Bresaola aliquip doner ham. Est kevin aute sed leberkas
      adipisicing officia, in qui sint do flank lorem fatback.
    </p>
    <p>
      Corned beef deserunt meatball pork. Esse tail bresaola, pig sausage
      alcatra sirloin. Doner veniam nisi est ham hamburger duis excepteur.
      Corned beef shank est quis eiusmod elit. Venison et ut rump short loin
      frankfurter. Dolor filet mignon cillum shankle. Deserunt ground round in,
      strip steak short ribs ex labore ut ea capicola tempor pork elit flank.
    </p>
  </StatefulModalContent>
);
