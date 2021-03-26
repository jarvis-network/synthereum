import React from 'react';
import { Button, styled } from '@jarvis-network/ui';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  height: 100%;
`;

const ImageContainer = styled.div`
  flex: 1;
  text-align: center;
  background: url('/images/manage-statue.svg') no-repeat center center;
  background-size: contain;
  margin: 40px;
`;

const TextTitle = styled.p`
  font-weight: bold;
  margin-top: 1em;
`;

const Text = styled.p`
  margin-top: 1em;
`;

const Link = styled.a`
  color: #0093ff;
  font-weight: bold;
  text-decoration: none;
`;

const SkipContainer = styled.div``;

const SkipButton = styled(Button)`
  margin-top: 1em;
  background: none;
  padding-right: 0;
  padding-left: 0;
  margin-left: auto;
  margin-right: 0;
  display: block;
  color: #c7c7c7;
  font-weight: bold;
`;

interface Props {
  onSkip: () => void;
}

export const Placeholder: React.FC<Props> = ({ onSkip }) => {
  return (
    <Container>
      <ImageContainer />
      <TextTitle>Lorem ipsum</TextTitle>
      <Text>
        You can find more information about our synthetic tokens{' '}
        <Link href="/">here</Link>
      </Text>
      <SkipContainer>
        <SkipButton onClick={onSkip} size="m">
          skip
        </SkipButton>
      </SkipContainer>
    </Container>
  );
};
