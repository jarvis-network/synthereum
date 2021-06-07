import { Icon, styled } from '@jarvis-network/ui';
import { useState } from 'react';
import { FPN } from '@jarvis-network/core-utils/dist/base/fixed-point-number';
import { State } from '@/state/initialState';
import { formatTimestamp } from '@jarvis-network/app-toolkit';
import { networkNameToId } from '@jarvis-network/core-utils/dist/eth/networks';

const Header = styled.div`
  height: 50px;
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 16px;

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 0 24px;
    margin: 0 0 8px;
  }
`;

const Rows = styled.div`
  padding: 0 0 10px;
  font-size: 14px;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  padding: 0 16px;
  flex-wrap: wrap;

  > div {
    padding: 5px 0;
  }

  > div:first-child {
    padding-right: 10px;
  }

  @media screen and (min-width: ${props =>
      props.theme.rwd.breakpoints[props.theme.rwd.desktopIndex - 1]}px) {
    padding: 0 24px;
  }
`;

const SecondaryText = styled.span`
  color: ${props => props.theme.text.secondary};
  padding-right: 4px;
`;

const Link = styled.a`
  text-decoration: none;
`;

const CustomIcon = styled(Icon)`
  color: ${props => props.theme.text.primary};
  font-size: 16px;
  display: inline-block;
  line-height: 8px;
  margin-left: 2px;

  > svg {
    margin: 0 0 -2px;
  }
`;

const Spacer = styled.div`
  flex-grow: 1;
`;

const Amount = styled.span`
  padding-left: 6px;
`;

const JRT = styled.img`
  margin-left: 8px;
`;

export function HistoryItem({
  item,
  networkId,
}: {
  item: State['history'][number];
  networkId: number;
}): JSX.Element {
  const [isOpen, setIsOpen] = useState(false);
  return (
    <div>
      <Header onClick={() => setIsOpen(state => !state)}>
        <span>Claimed</span>
        <JRT src="/images/JRT.png" alt="JRT logo" width="24" height="24" />
        <Amount>{new FPN(item.amount, true).format(5)} JRT</Amount>
        <Spacer />
        <Icon
          icon="BsChevronDown"
          style={{ transform: isOpen ? 'rotate(180deg)' : undefined }}
        />
      </Header>
      {isOpen && (
        <Rows>
          <Row>
            <div>
              <SecondaryText>Type</SecondaryText> Claim
            </div>
            <div>
              <SecondaryText>Timestamp</SecondaryText>{' '}
              {formatTimestamp(item.timestamp * 1000)}
            </div>
          </Row>
          <Row>
            <div>
              <Link
                href={`https://${
                  networkId === networkNameToId.kovan ? 'kovan.' : ''
                }etherscan.io/tx/${item.transactionHash}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <SecondaryText>View on Etherscan</SecondaryText>
                <CustomIcon icon="IoMdOpen" />
              </Link>
            </div>{' '}
            <div>
              <SecondaryText>Status</SecondaryText> Confirmed
            </div>
          </Row>
        </Rows>
      )}
    </div>
  );
}
