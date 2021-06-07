import { useReduxSelector } from '@/state/useReduxSelector';
import {
  formatTimestamp,
  useBehaviorSubject,
  useCoreObservables,
} from '@jarvis-network/app-toolkit';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { useEffect, useRef, useState } from 'react';
import { Button, styled } from '@jarvis-network/ui';
import { useDispatch } from 'react-redux';
import { updateClaim } from '@/state/slices/claim';
import {
  NetworkName,
  Web3On,
} from '@jarvis-network/core-utils/dist/eth/web3-instance';
import { NonPayableTransactionObject } from '@jarvis-network/synthereum-contracts/dist/src/contracts/typechain';
import {
  Address,
  AddressOn,
} from '@jarvis-network/core-utils/dist/eth/address';
import { sendTx } from '@jarvis-network/core-utils/dist/eth/contracts/send-tx';
import { useAerariumMilitare } from '@/utils/useAerariumMilitare';
import { isSupportedNetwork } from '@jarvis-network/synthereum-contracts/dist/src/config';

import { MessageContainer } from './MessageContainer';

const Container = styled.div`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
`;

const Row = styled.div`
  padding: 10px 16px;
  border-bottom: 1px solid ${props => props.theme.border.secondary};

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 10px 24px;
  }
`;

const Spacer = styled.div`
  flex-grow: 1;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    flex-grow: 0;
  }
`;

const RowLabel = styled.span`
  color: ${props => props.theme.text.secondary};
`;

const AvailableNow = styled.div`
  margin: 10px 16px;
  padding: 14px;
  text-align: center;
  background-color: ${props => props.theme.background.secondary};
  border-radius: 10px;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    margin: 10px 24px;
  }
`;

const ClaimButton = styled(Button)`
  width: calc(100% - 2 * 16px);
  text-align: center;
  margin: 0 16px 16px;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    width: calc(100% - 2 * 24px);
    margin: 0 24px 24px;
  }
`;

export function Claim(): JSX.Element {
  const { web3$, networkId$ } = useCoreObservables();
  const web3 = useBehaviorSubject(web3$) as Web3On<NetworkName> | null;
  const networkId = useBehaviorSubject(networkId$);
  const { claim, auth } = useReduxSelector(state => ({
    claim: state.claim,
    auth: state.auth,
  }));
  const dispatch = useDispatch();
  const contractInfo = useAerariumMilitare();
  const [buttonClicked, setButtonClicked] = useState(false);

  useEffect(() => {
    if (
      !contractInfo ||
      contractInfo.networkId !== networkId ||
      !web3 ||
      !auth ||
      claim
    )
      return;

    const { instance: contract } = contractInfo;

    const cancelRef = { canceled: false };

    web3.eth.net.getId().then(web3NetworkId => {
      if (cancelRef.canceled) return;
      if (web3NetworkId !== networkId) return;

      Promise.all([
        contract.methods.investorInfo(auth.address as Address).call(),
        contract.methods.endTime().call(),
        contract.methods.startTime().call(),
        contract.methods
          .claimableJRT(auth.address as Address)
          .call()
          .catch(() => '0'), // Before startTime it throws
        contract.methods.claimedAmount(auth.address as Address).call(),
      ]).then(
        ([investorInfo, endTime, startTime, claimableJRT, claimedAmount]) => {
          if (cancelRef.canceled) return;

          dispatch(
            updateClaim({
              claimedAmount,
              claimableJRT,
              startTime: Number(startTime),
              endTime: Number(endTime),
              investorInfo,
            }),
          );
        },
      );
    });

    return () => {
      cancelRef.canceled = true;
    };
  }, [web3, claim, contractInfo, auth, networkId, dispatch]);

  const lastClaimRef = useRef<typeof claim>(null);
  const address = auth?.address;
  useEffect(() => {
    lastClaimRef.current = null;
  }, [address]);
  if (claim) {
    lastClaimRef.current = claim;
  }
  const lastClaim = lastClaimRef.current;

  useEffect(() => {
    setButtonClicked(false);

    if (lastClaim) {
      const availableNow = new FPN(lastClaim.claimableJRT, true).toNumber();
      if (!availableNow) {
        setTimeout(() => {
          dispatch(updateClaim(null));
        }, 30 * 1000);
      }
    }
  }, [lastClaim]);

  if (!isSupportedNetwork(networkId))
    return <MessageContainer>Unsupported Network</MessageContainer>;
  if (!lastClaim) return <MessageContainer>Loading...</MessageContainer>;

  const shouldLiquidate = lastClaim.endTime * 1000 < Date.now();
  const investorInfo = new FPN(lastClaim.investorInfo, true);
  const claimedAmount = new FPN(lastClaim.claimedAmount, true);
  const availableNow = new FPN(lastClaim.claimableJRT, true);

  return (
    <Container>
      <Row>
        <RowLabel>Total Allocated:</RowLabel> {investorInfo.format(5)} JRT
      </Row>
      <Row>
        <RowLabel>Last Allocation Date:</RowLabel>{' '}
        {formatTimestamp(lastClaim.endTime * 1000)}
      </Row>
      <Row>
        <RowLabel>Already Claimed:</RowLabel> {claimedAmount.format(5)} JRT
      </Row>
      <Spacer />
      <AvailableNow>Available now: {availableNow.format(5)} JRT</AvailableNow>
      <ClaimButton
        type="success"
        disabled={
          !contractInfo ||
          !web3 ||
          !auth ||
          buttonClicked ||
          (shouldLiquidate
            ? !investorInfo.sub(claimedAmount).toNumber()
            : !availableNow.toNumber())
        }
        onClick={() => {
          setButtonClicked(true);
          const reload = () => {
            dispatch(updateClaim(null));
          };

          if (!contractInfo) throw new Error('contract undefined');
          if (!auth) throw new Error('auth undefined');
          if (!web3) throw new Error('web3 undefined');

          sendTx(
            (shouldLiquidate
              ? contractInfo.instance.methods.liquidate([
                  auth.address as AddressOn<NetworkName>,
                ])
              : contractInfo.instance.methods.claim()) as NonPayableTransactionObject<
              void | string
            >,
            {
              web3,
              from: auth.address as AddressOn<NetworkName>,
            },
          )
            .then(result => result.promiEvent)
            .then(reload)
            .catch(reload);
        }}
      >
        Claim
      </ClaimButton>
    </Container>
  );
}
