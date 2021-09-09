import { debounce } from 'lodash';
import { useEffect, useState } from 'react';
import { BehaviorSubject } from 'rxjs';

export function useBehaviorSubject<T>(
  subject: BehaviorSubject<T>,
  async?: boolean,
): T {
  const [state, setState] = useState(subject.value);
  useEffect(() => {
    const subscription = async
      ? subject.subscribe(debounce(setState, 0))
      : subject.subscribe(setState);

    return () => {
      subscription.unsubscribe();
    };
  }, [subject, async]);

  return state;
}
