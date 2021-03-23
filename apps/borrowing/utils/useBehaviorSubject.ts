import { useEffect, useState } from 'react';
import { BehaviorSubject } from 'rxjs';

export function useBehaviorSubject<T>(subject: BehaviorSubject<T>) {
  const [state, setState] = useState(subject.value);
  useEffect(() => {
    const subscription = subject.subscribe(value => {
      setState(value);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, [subject]);

  return state;
}
