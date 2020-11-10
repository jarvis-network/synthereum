import React from 'react';
import { Icon, styled, Tabs } from '@jarvis-network/ui';

import { useReduxSelector } from '@/state/useReduxSelector';

interface Props {
  className?: string;
  title: string;
  mode?: 'tab' | 'back';
  onBack?: () => void;
}

const mainContentBackground = {
  night: '#2e3541',
  dark: '#292929',
  light: '#fff',
};

const Container = styled.div`
  box-shadow: ${props => props.theme.shadow.base};
  height: 100%;
  position: relative;
`;

const ColoredTabs = styled(Tabs)`
  > :first-child {
    background: ${props => props.theme.background.secondary};
  }
`;

const Header = styled.div`
  height: 51px;
  line-height: 51px;
  padding: 0 20px;
  font-weight: bold;
  font-size: 14px;
`;

const IconButton = styled.button`
  border: none;
  background: none;
  padding: 10px;
  cursor: pointer;
  outline: none !important;

  i svg {
    width: 16px;
    height: 16px;
    position: relative;
    top: 3px;
  }
`;

export const Card: React.FC<Props> = ({
  className,
  title,
  mode = 'tab',
  onBack,
  children,
}) => {
  const theme = useReduxSelector(state => state.theme);

  const boxStyle = {
    background: mainContentBackground[theme],
  };

  const content =
    mode === 'tab' ? (
      <ColoredTabs tabs={[{ title, content: children }]} selected={0} />
    ) : (
      <div className="box">
        <Header>
          <IconButton onClick={onBack}>
            <Icon icon="BsArrowLeft" />
          </IconButton>
          {title}
        </Header>
        {children}
      </div>
    );

  return (
    <Container style={boxStyle} className={className}>
      {content}
    </Container>
  );
};
