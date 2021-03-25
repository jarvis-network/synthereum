import React from 'react';
import { PageProps } from '@/components/auth/flow/types';
import {
  BigP,
  Img,
  TutorialContent,
  ImgContainer,
  ChevronRight,
} from '@/components/auth/flow/ModalComponents';
import {
  Button,
  Flag,
  NotificationType,
  styled,
  themeValue,
  useNotifications,
} from '@jarvis-network/ui';
import { useAuth } from '@/utils/useAuth';

const TermsContainer = styled.div`
  display: flex;
  margin-top: 10px;
  margin-left: -16px;

  > * {
    flex: 1;

    &:not(:first-child) {
      margin-left: 22px;
    }
  }
`;

const Btn = styled(Button)`
  font-size: ${props => props.theme.font.sizes.s};
  border-color: ${props => props.theme.border.primary};
  height: 52px;
  padding: 0 10px;
  display: flex;
  justify-content: flex-start;
  align-items: center;
  background: none;
  color: currentColor;
  border-color: ${themeValue(
    { light: theme => theme.border.primary },
    theme => theme.border.secondary,
  )};

  > span {
    flex: 1;
    margin-left: 15px;
  }
`;

const DiagonalIcons = styled.div`
  width: 22px;
  height: 22px;
  position: relative;
  top: -2px;

  img {
    &:first-child {
      position: relative;
      top: 10px;
    }

    width: 11px;
    height: 11px;
  }
`;

const Content = styled.div``;

export const ServiceSelect: React.FC<PageProps> = () => {
  const notify = useNotifications();
  const authLogin = useAuth();

  const logIn = () => {
    authLogin?.login().then(loginSuccessful => {
      if (loginSuccessful) {
        notify('You have successfully signed in', {
          type: NotificationType.success,
          icon: '👍🏻',
        });
      }
    });
    requestAnimationFrame(() => {
      const showMoreButton = document.querySelector(
        '.bn-onboard-modal-select-wallets > div > button',
      );
      if (showMoreButton) {
        // @ts-ignore
        showMoreButton.click();
      }
    });
  };

  return (
    <TutorialContent>
      <ImgContainer>
        <Img src="/images/welcome-statue.svg" alt="" />
      </ImgContainer>

      <Content>
        <BigP>
          <b>No account</b> needed!
        </BigP>

        <TermsContainer>
          <Btn inverted type="dark" onClick={logIn}>
            <DiagonalIcons>
              <img src="/images/ledger.svg" alt="" />
              <img src="/images/metamask.svg" alt="" />
            </DiagonalIcons>
            <span>
              Sign Up/In
              <br />
              <b>with your wallet</b>
            </span>
            <ChevronRight />
          </Btn>
        </TermsContainer>
      </Content>
    </TutorialContent>
  );
};
