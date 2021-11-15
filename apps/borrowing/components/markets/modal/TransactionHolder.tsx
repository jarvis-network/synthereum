import React from 'react';
import { motion } from 'framer-motion';

import { IconButton, styled } from '@jarvis-network/ui';

import { Img, ImgContainer } from '@/components/auth/flow/ModalComponents';
import { useReduxSelector } from '@/state/useReduxSelector';

import _ from 'lodash';
import { SupportedNetworkId } from '@jarvis-network/synthereum-config';

import { toNetworkName } from '@jarvis-network/core-utils/dist/eth/networks';

import { Asset, AssetSelect, SubmitButton, SubmitContainer } from './common';
import { Loader } from './common/Loader';

const TransactionStatus = {
  initial: {
    opacity: 1,
    x: 0,
    transition: {
      duration: 0.2,
    },
  },
  preview: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  metaMaskConfirmation: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  sending: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  confirmed: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
  failed: {
    x: 0,
    opacity: 1,
    transition: {
      duration: 0.2,
    },
  },
};

const PreviewContainer = styled.div`
  width: 520px;
`;
const MetaMaskConfirmationContainer = styled.div`
  width: 520px;
`;
const SentContainer = styled.div`
  width: 520px;
`;
const ConfirmedContainer = styled.div`
  width: 520px;
`;
const TransactionContainer = styled.div`
  overflow: hidden;
`;

const InnerContainer = styled.div`
  display: flex;
  width: 100%;
  position: relative;
  flex-direction: row;
`;

const Title = styled.div`
  text-align: center;
  font-size: 18px;
  margin: 20px 0px;
`;
const LoadingSection = styled.div`
  height: 100px;
`;

const ViewButton = styled.a`
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
const ValueBox = styled.div`
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

const BackButton = styled(IconButton)`
  position: absolute;
  top: 16px;
  left: 0px;

  svg {
    fill: #c7c7c7;
  }
`;

interface TransactionParamsProps {
  params: PreviewParamsRow[];
}
export const TransactionParams = ({ params }: TransactionParamsProps) => (
  <div>
    {params.map(param => (
      <div key={param.title.toLowerCase()}>
        <AssetSelect error={false}>
          <div>{param.title}</div>
          <ValueBox>
            <div>{param.value}</div>
            <Asset name={param.asset.name} />
          </ValueBox>
        </AssetSelect>
      </div>
    ))}
  </div>
);

interface Props {
  confirmHandler: () => void;
  showPreview: boolean;
  params: PreviewParamsRow[];
  backHandler?: () => void;
}
export interface PreviewParamsRow {
  title: string;
  asset: {
    name: string;
  };
  value: string;
}
let stage = 'initial';
const TransactionHolder: React.FC<Props> = ({
  confirmHandler,
  params,
  showPreview = false,
  backHandler,
}) => {
  const opType = useReduxSelector(state => state.transaction.opType);
  const txHash = useReduxSelector(state => state.transaction.txHash);
  const receipt = useReduxSelector(state => state.transaction.receipt);
  const networkId = useReduxSelector(state => state.app.networkId);

  if (opType !== 'cancel' && stage === 'preview') {
    stage = 'metaMaskConfirmation';
  }
  if (opType === 'cancel' || opType === undefined) {
    stage = 'initial';
  }
  if (!_.isEmpty(txHash)) {
    stage = 'sending';
  }
  if (!_.isEmpty(receipt)) {
    stage = 'confirmed';
  }
  if (showPreview && stage === 'initial') {
    stage = 'preview';
  }
  console.log(stage, opType);
  return (
    <TransactionContainer>
      <InnerContainer>
        {stage === 'preview' && (
          <motion.div
            animate={stage}
            initial={{ opacity: 0, x: 600 }}
            variants={TransactionStatus}
          >
            <PreviewContainer>
              {backHandler && (
                <BackButton
                  onClick={backHandler}
                  icon="IoIosArrowBack"
                  type="transparent"
                  size="xxl"
                  inline
                />
              )}
              <Title>Preview Transaction</Title>
              <TransactionParams params={params} />
              <br />
              <br />
              <SubmitContainer>
                <SubmitButton onClick={confirmHandler}>Confirm</SubmitButton>
              </SubmitContainer>
            </PreviewContainer>
          </motion.div>
        )}
        {stage === 'metaMaskConfirmation' && (
          <motion.div
            animate={stage}
            initial={{ opacity: 0, x: 600 }}
            variants={TransactionStatus}
          >
            <MetaMaskConfirmationContainer>
              <Title>Please confirm your transaction in your wallet</Title>
              <TransactionParams params={params} />
              <LoadingSection>
                <Loader />
              </LoadingSection>
            </MetaMaskConfirmationContainer>
          </motion.div>
        )}
        {stage === 'sending' && (
          <motion.div
            animate={stage}
            initial={{ opacity: 0, x: 600 }}
            variants={TransactionStatus}
          >
            <SentContainer>
              {backHandler && (
                <BackButton
                  onClick={backHandler}
                  icon="IoIosArrowBack"
                  type="transparent"
                  size="xxl"
                  inline
                />
              )}
              <Title>Your Transaction is Processing</Title>
              <TransactionParams params={params} />
              <LoadingSection>
                <Loader />
              </LoadingSection>
              <SubmitContainer>
                <ViewButton
                  href={`https://${toNetworkName(
                    networkId as SupportedNetworkId,
                  )}.etherscan.io/tx/${txHash}`}
                  target="blank"
                >
                  View your Transaction
                </ViewButton>
              </SubmitContainer>
            </SentContainer>
          </motion.div>
        )}
        {stage === 'confirmed' && (
          <motion.div
            animate={stage}
            initial={{ opacity: 0, x: 600 }}
            variants={TransactionStatus}
          >
            <ConfirmedContainer>
              {backHandler && (
                <BackButton
                  onClick={backHandler}
                  icon="IoIosArrowBack"
                  type="transparent"
                  size="xxl"
                  inline
                />
              )}
              <Title>Your Transaction has been Confirmed</Title>
              <ImgContainer>
                <Img
                  style={{
                    height: '100px',
                  }}
                  src="/images/welcome-statue.svg"
                  alt=""
                />
              </ImgContainer>

              <TransactionParams params={params} />
              <SubmitContainer>
                <ViewButton
                  href={`https://${toNetworkName(
                    networkId as SupportedNetworkId,
                  )}.etherscan.io/tx/${txHash}`}
                  target="blank"
                >
                  View your Transaction
                </ViewButton>
              </SubmitContainer>
            </ConfirmedContainer>
          </motion.div>
        )}
      </InnerContainer>
    </TransactionContainer>
  );
};

export default React.memo(TransactionHolder);
