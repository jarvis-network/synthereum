import React from 'react';

import { styled } from '../../Theme';

import { Dropdown } from '..';

export default {
  title: 'Dropdown/Dropdown',
  component: Dropdown,
};

const Header = styled.span`
  padding: 10px;
`;

const Content = styled.div`
  padding: 10px;
`;

const BorderedContent = styled.div`
  padding: 10px;
  background: ${props => props.theme.background.primary};
  border: 1px solid ${props => props.theme.border.primary};
`;

export const Default = () => (
  <Dropdown header={<Header>Dropdown header</Header>}>
    <Content>
      <p>Dropdown content can contain any ReactNote</p>
    </Content>
  </Dropdown>
);

export const WithAbsolutePosition = () => (
  <Dropdown header={<Header>Dropdown header</Header>} position="absolute">
    <BorderedContent>
      <p>
        Dropdown content can contain any ReactNote. It doesn&apos;t include
        shadow with absolute positionig mode.
      </p>
    </BorderedContent>
  </Dropdown>
);

export const WithContentOnTop = () => (
  <>
    <p>
      Sirloin tempor leberkas qui deserunt porchetta. Est elit leberkas, duis
      jerky capicola beef ribs veniam pork chop do officia ullamco pancetta
      turducken ipsum. Shankle meatloaf corned beef fatback, boudin ea strip
      steak pork loin sirloin incididunt hamburger rump irure. Ipsum voluptate
      shoulder sirloin cow. Mollit picanha non reprehenderit, meatball ut strip
      steak quis eiusmod kielbasa pork chop chuck.
    </p>
    <p>
      Pariatur sed ad bresaola filet mignon ipsum fatback, flank drumstick beef
      ribs adipisicing ham hock turkey. Pastrami dolore ipsum, swine landjaeger
      shankle consequat kielbasa consectetur picanha ribeye eiusmod hamburger.
      Ut turducken commodo chislic, buffalo ribeye et beef voluptate. Sed minim
      landjaeger consectetur.
    </p>
    <Dropdown
      header={<Header>Dropdown header</Header>}
      position="absolute"
      contentOnTop
    >
      <BorderedContent>
        <p>
          Dropdown content can contain any ReactNote. It doesn&apos;t include
          shadow with absolute positionig mode.
        </p>
      </BorderedContent>
    </Dropdown>
  </>
);
