import { useEffect, useState } from 'react';
import { BehaviorSubject } from 'rxjs';

export function useBehaviorSubject<T>(subject: BehaviorSubject<T>): T {
  const [state, setState] = useState(subject.value);
  useEffect(() => {
    const subscription = subject.subscribe(setState);

    return () => {
      subscription.unsubscribe();
    };
  }, [subject]);

  return state;
}
