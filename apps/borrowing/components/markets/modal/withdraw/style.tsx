import { styled } from '@jarvis-network/ui';

import { SubmitButton } from '../common';

export const Container = styled.div`
  height: 100%;
  width: 100%;
  display: flex;
  flex-direction: column;
  > :nth-child(n + 1) {
    flex: 1 1 auto;
  }
  >: nth-child(2) {
    flex: none !important;
    height: 48px;
    display: block;
  }
`;

export const WithdrawContainer = styled.div`
  overflow: hidden;
`;
export const InnerContainer = styled.div`
  display: flex;
  width: 100%;
  height: 100%;
`;
export const Title = styled.div`
  text-align: center;
  font-size: 18px;
  margin: 20px 0px;
`;
export const Note = styled.div`
  text-align: center;
  font-size: 12px;
`;
export const SubTitle = styled.div`
  text-align: center;
  font-size: 12px;
  margin-bottom: 10px;
  > span {
    font-size: 14px;
    font-weight: bold;
  }
`;
export const GotoWithdrawButton = styled(SubmitButton)`
  && {
    width: 200px;
    font-size: 16px;
    margin: 20px 10px;
  }
`;
