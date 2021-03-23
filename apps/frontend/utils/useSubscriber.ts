import { useEffect } from 'react';
import { useDispatch } from 'react-redux';

export function useSubscriber(
  subscribe: () => void,
  unsubscribe?: () => void,
): void {
  const dispatch = useDispatch();

  useEffect(() => {
    dispatch(subscribe());

    if (!unsubscribe) {
      return;
    }

    return () => {
      dispatch(unsubscribe());
    };
  }, []);
}
