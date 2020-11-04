import { styled } from '@jarvis-network/ui';

const CardsHolder = styled.div`
  padding-top: calc(118px - 50px);
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

export default CardsHolder;
