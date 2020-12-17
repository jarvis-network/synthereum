import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

export const useSubscriber = (
  subscriber: Function,
  unsubscriber?: Function,
) => {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(subscriber());

    if (!unsubscriber) {
      return;
    }

    // eslint-disable-next-line consistent-return
    return () => {
      dispatch(unsubscriber());
    };
  }, []);
};
