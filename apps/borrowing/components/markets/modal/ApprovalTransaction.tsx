import { useReduxSelector } from '@/state/useReduxSelector';
import { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';

interface Props {
  currency: string;
  text: string;
}
export const ApprovalTransaction: React.FC<Props> = ({ currency, text }) => {
  const dispatch = useDispatch();
  const [confirmButtonText, setConfirmButtonText] = useState(text);
  const approveConfirmation = useReduxSelector(
    state => state.approveTransaction.opType,
  );
  const approveTxSend = useReduxSelector(
    state => state.approveTransaction.txHash,
  );
  const approveTxConfirmed = useReduxSelector(
    state => state.approveTransaction.receipt,
  );
  useEffect(() => {
    if (approveConfirmation === 'approval') {
      setConfirmButtonText(`Approving ${currency}`);
    }
    if (approveConfirmation === 'cancel') {
      setConfirmButtonText(`Approve Cancel`);
      setTimeout(() => {
        setConfirmButtonText(text);
        dispatch({
          type: 'approvalTransaction/reset',
        });
      }, 2000);
    }
  }, [approveConfirmation]);
  useEffect(() => {
    if (approveTxSend) {
      setConfirmButtonText(`Confirming ${currency} Approval`);
    }
  }, [approveTxSend]);
  useEffect(() => {
    if (approveTxConfirmed) {
      setConfirmButtonText(text);
      setTimeout(() => {
        dispatch({
          type: 'approvalTransaction/reset',
        });
      }, 2000);
    }
  }, [approveTxConfirmed]);
  return <>{confirmButtonText}</>;
};
