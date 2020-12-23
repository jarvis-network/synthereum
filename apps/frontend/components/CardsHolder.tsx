import { styled } from '@jarvis-network/ui';

export const CardsHolder = styled.div`
  padding-top: calc(118px - 51px);
  height: 506px;
  display: flex;
  width: 1072px;
  margin: auto;

  > * {
    &:not(:first-child) {
      margin-left: 25px;
    }
  }
`;
