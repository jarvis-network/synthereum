import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

import { Img, ImgContainer } from '@/components/auth/flow/ModalComponents';
import { useReduxSelector } from '@/state/useReduxSelector';

import _ from 'lodash';
import { SupportedNetworkId } from '@jarvis-network/synthereum-config/dist';

import { toNetworkName } from '@jarvis-network/core-utils/dist/eth/networks';
import { useTheme } from '@jarvis-network/ui';

import { useDispatch } from 'react-redux';

import { Container, SubmitButton, SubmitContainer } from '../common';
import { Loader } from '../common/Loader';
import {
  tapAnimation,
  ActionVariants,
  TransactionStatusVariants,
  TransactionStatus,
} from '../common/variants';
import { ErrorMessageContainer } from '../common/shared';

import {
  BackButton,
  InnerContainer,
  LoadingSection,
  Title,
  TransactionContainer,
  ViewButton,
} from './style';
import { PreviewParamsRow, TransactionParams } from './TransactionParams';

interface Props {
  confirmHandler: () => void;
  showPreview: boolean;
  params: PreviewParamsRow[];
  backHandler?: () => void;
}

const TransactionHolder: React.FC<Props> = ({
  confirmHandler,
  params,
  showPreview = false,
  backHandler,
}) => {
  const dispatch = useDispatch();
  const theme = useTheme();

  const opType = useReduxSelector(state => state.transaction.opType);
  const txHash = useReduxSelector(state => state.transaction.txHash);
  const receipt = useReduxSelector(state => state.transaction.receipt);
  const networkId = useReduxSelector(state => state.app.networkId);
  const metaMaskError = useReduxSelector(state => state.transaction.error);
  const [alertVariant, setAlertVariant] = useState<ActionVariants>('');
  const [stage, setStage] = useState<TransactionStatusVariants>('initial');
  const [inProgress, setInProgress] = useState<boolean>(false);

  useEffect(() => {
    if (metaMaskError?.message) {
      setAlertVariant('error');
      setInProgress(false);
    }
  }, [metaMaskError]);
  useEffect(() => {
    if (opType !== 'cancel' && stage === 'preview') {
      setStage('metaMaskConfirmation');
    }

    if (opType === 'cancel' || opType === undefined) {
      setInProgress(false);
      setStage('preview');
    }
  }, [opType]);

  useEffect(() => {
    if (!_.isEmpty(txHash)) {
      setStage('sending');
    }
  }, [txHash]);

  useEffect(() => {
    if (!_.isEmpty(receipt)) {
      setStage('confirmed');
    }
  }, [receipt]);

  useEffect(() => {
    if (showPreview && stage === 'initial') {
      setStage('preview');
    }
  }, [showPreview]);

  return (
    <TransactionContainer>
      <InnerContainer>
        {stage === 'preview' && (
          <motion.div
            animate={stage}
            initial={{ opacity: 0, x: 600 }}
            variants={TransactionStatus}
          >
            <Container key="preview">
              {backHandler && (
                <BackButton
                  onClick={() => {
                    setStage('initial');
                    setTimeout(backHandler, 100);
                  }}
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
              {metaMaskError?.message && (
                <ErrorMessageContainer>
                  <motion.div
                    whileTap="tap"
                    animate={alertVariant}
                    variants={tapAnimation}
                  >
                    {metaMaskError?.message}
                  </motion.div>
                </ErrorMessageContainer>
              )}
              <SubmitContainer>
                {!inProgress ? (
                  <SubmitButton
                    style={{
                      background: theme.common.success,
                      text: theme.text.primary,
                    }}
                    animate={alertVariant}
                    onClick={() => {
                      dispatch({
                        type: 'transaction/reset',
                      });
                      setAlertVariant('');
                      setInProgress(true);
                      confirmHandler();
                    }}
                  >
                    Confirm
                  </SubmitButton>
                ) : (
                  <LoadingSection>
                    <Loader />
                  </LoadingSection>
                )}
              </SubmitContainer>
            </Container>
          </motion.div>
        )}
        {stage === 'metaMaskConfirmation' && (
          <motion.div
            animate={stage}
            initial={{ opacity: 0, x: 600 }}
            variants={TransactionStatus}
          >
            <Container key="MetaMaskConfirmationContainer">
              <Title>Please confirm your transaction in your wallet</Title>
              <TransactionParams params={params} />
              <LoadingSection>
                <Loader />
              </LoadingSection>
            </Container>
          </motion.div>
        )}
        {stage === 'sending' && (
          <motion.div
            animate={stage}
            initial={{ opacity: 0, x: 600 }}
            variants={TransactionStatus}
          >
            <Container key="SentContainer">
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
            </Container>
          </motion.div>
        )}
        {stage === 'confirmed' && (
          <motion.div
            animate={stage}
            initial={{ opacity: 0, x: 600 }}
            variants={TransactionStatus}
          >
            <Container key="ConfirmedContainer">
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
            </Container>
          </motion.div>
        )}
      </InnerContainer>
    </TransactionContainer>
  );
};

export default React.memo(TransactionHolder);
