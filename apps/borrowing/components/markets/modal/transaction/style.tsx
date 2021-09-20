import { IconButton, styled } from '@jarvis-network/ui';
import { motion } from 'framer-motion';

export const TransactionContainer = styled(motion.div)`
  overflow: hidden;
`;

export const InnerContainer = styled.div`
  display: flex;
  width: 100%;
  position: relative;
  flex-direction: row;
`;

export const Title = styled.div`
  text-align: center;
  font-size: 18px;
  margin: 20px 0px;
`;
export const LoadingSection = styled.div`
  height: 100px;
`;

export const ViewButton = styled.a`
  font-size: 18px;
  width: 280px;
  height: 60px;
  text-align: center;
  margin: 10px 0px;
  cursor: pointer;
  text-transform: uppercase;
  &:disabled {
    color: ${props => props.theme.text.secondary};
  }
`;
export const ValueBox = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-content: stretch;
  align-items: center;

  > div:first-child {
    margin-top: 5px;
    margin-right: 10px;
    width: 200px;
    text-align: right;
  }
`;

export const BackButton = styled(IconButton)`
  position: absolute;
  top: 16px;
  left: 0px;

  svg {
    fill: #c7c7c7;
  }
`;
